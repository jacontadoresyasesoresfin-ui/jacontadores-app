/**
 * Motor de conciliación bancaria inteligente.
 * 3 etapas: exacto → fuzzy → agrupados (many-to-one / one-to-many).
 */
import { randomUUID } from 'crypto'
import type {
  MovimientoBancario, FacturaElectronica, MovimientoSiigo,
  ResultadoMatch, Discrepancia, ConfiguracionConciliacion,
  EstadoConciliacion, SeveridadDiscrepancia,
  ResumenConciliacionBancaria, PartidaConciliatoria, TipoPartida,
} from './models'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function idMatch() { return 'MTH_' + randomUUID().replace(/-/g,'').slice(0,12).toUpperCase() }
function idDisc()  { return 'DSC_' + randomUUID().replace(/-/g,'').slice(0,12).toUpperCase() }

function diffDias(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000)
}

function pctDiff(a: number, b: number): number {
  const base = Math.max(a, b)
  if (base === 0) return 0
  return Math.abs(a - b) / base
}

/** Similitud entre textos usando token-sort (sin librería externa). */
function similitudTexto(a: string, b: string): number {
  const tokenize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ')
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (!ta || !tb) return 0
  // Levenshtein normalizado
  const lev = levenshtein(ta, tb)
  const maxLen = Math.max(ta.length, tb.length)
  return maxLen === 0 ? 1 : 1 - lev / maxLen
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    }
  }
  return dp[m][n]
}

// ─── MOTOR PRINCIPAL ──────────────────────────────────────────────────────────

export interface ResultadoConciliadorParcial {
  matches: ResultadoMatch[]
  discrepancias: Discrepancia[]
  log: string[]
}

export function ejecutarConciliacion(
  banco: MovimientoBancario[],
  facturas: FacturaElectronica[],
  siigo: MovimientoSiigo[],
  config: ConfiguracionConciliacion,
): ResultadoConciliadorParcial {
  const log: string[] = []
  const matches: ResultadoMatch[] = []
  const toleranciaM = config.toleranciaMontosPct
  const toleranciaD = config.toleranciaDias
  const umbralMin   = config.umbralConfianzaMin

  const registrar = (msg: string) => { log.push(msg) }

  // Reiniciar estados
  banco.forEach(m => { m.estado = 'no_conciliado'; m.matchIds = []; m.confianzaMatch = 0 })
  facturas.forEach(f => { f.estado = 'no_conciliado'; f.matchIds = []; f.confianzaMatch = 0 })
  siigo.forEach(s => { s.estado = 'no_conciliado'; s.matchIds = []; s.confianzaMatch = 0 })

  registrar(`Iniciando: ${banco.length} movimientos banco, ${facturas.length} facturas DIAN, ${siigo.length} registros Siigo`)

  // Índice de facturas por monto
  const idxFactMonto = new Map<number, FacturaElectronica[]>()
  for (const f of facturas) {
    const lista = idxFactMonto.get(f.total) ?? []
    lista.push(f)
    idxFactMonto.set(f.total, lista)
  }

  // ── ETAPA 1: Match exacto banco ↔ facturas ────────────────────────────────
  let n1 = 0
  for (const mov of banco) {
    if (mov.estado !== 'no_conciliado' || mov.tipo !== 'credito') continue
    const candidatas = idxFactMonto.get(mov.monto) ?? []
    for (const f of candidatas) {
      if (f.estado !== 'no_conciliado') continue
      const dd = diffDias(mov.fecha, f.fechaEmision)
      const ddVenc = f.fechaVencimiento ? diffDias(mov.fecha, f.fechaVencimiento) : 999
      if (Math.min(dd, ddVenc) > toleranciaD) continue
      let confianza = 0.97
      if (mov.referencia && f.numero && mov.referencia.includes(f.numero.replace(/\D/g,'')))
        confianza = 0.999
      const match = crearMatch([mov.id], [f.cufe], [], 'exacto', confianza,
                               mov.monto, f.total, Math.min(dd, ddVenc))
      matches.push(match)
      marcarBanco(mov, 'conciliado', match.idMatch, confianza)
      marcarFactura(f, 'conciliado', match.idMatch, confianza)
      n1++
      break
    }
  }
  registrar(`Etapa 1 (exacto): ${n1} matches`)

  // ── ETAPA 2: Match fuzzy banco ↔ facturas ─────────────────────────────────
  let n2 = 0
  const pendBanco   = () => banco.filter(m => m.estado === 'no_conciliado' && m.tipo === 'credito')
  const pendFact    = () => facturas.filter(f => f.estado === 'no_conciliado')

  for (const mov of pendBanco()) {
    let mejor: { f: FacturaElectronica; score: number; dd: number; dm: number } | null = null

    for (const f of pendFact()) {
      const dm = pctDiff(mov.monto, f.total)
      if (dm > toleranciaM * 10) continue
      const dd = Math.min(
        diffDias(mov.fecha, f.fechaEmision),
        f.fechaVencimiento ? diffDias(mov.fecha, f.fechaVencimiento) : 999,
      )
      if (dd > toleranciaD * 3) continue

      const scoreMonto = 1 - dm
      const scoreFecha = Math.max(0, 1 - dd / (toleranciaD * 3 + 1))
      const texBanco = `${mov.descripcion} ${mov.referencia ?? ''}`
      const texFact  = `${f.numero} ${f.nombreReceptor} ${f.nitReceptor}`
      const scoreDesc = similitudTexto(texBanco, texFact)
      const score = scoreMonto * 0.5 + scoreFecha * 0.3 + scoreDesc * 0.2

      if (score >= umbralMin && (!mejor || score > mejor.score)) {
        mejor = { f, score, dd, dm }
      }
    }

    if (mejor) {
      const estado: EstadoConciliacion = mejor.score >= 0.85 ? 'conciliado' : 'revision'
      const match = crearMatch([mov.id], [mejor.f.cufe], [], 'fuzzy', mejor.score,
                               mov.monto, mejor.f.total, Math.round(mejor.dd))
      matches.push(match)
      marcarBanco(mov, estado, match.idMatch, mejor.score)
      marcarFactura(mejor.f, estado, match.idMatch, mejor.score)
      n2++
    }
  }
  registrar(`Etapa 2 (fuzzy): ${n2} matches`)

  // ── ETAPA 3: Agrupados many-to-one y one-to-many ─────────────────────────
  let n3 = 0
  const creditosPend = banco.filter(m => m.tipo === 'credito' && m.estado === 'no_conciliado')
  const factPend     = facturas.filter(f => f.estado === 'no_conciliado')

  // Many-to-one: varios créditos → una factura (pagos parciales)
  for (const f of factPend) {
    if (f.estado !== 'no_conciliado') continue
    const candidatos = creditosPend.filter(
      m => m.estado === 'no_conciliado' && diffDias(m.fecha, f.fechaEmision) <= toleranciaD * 4
    )
    if (candidatos.length < 2) continue
    const grupo = buscarSubconjuntoSuma(candidatos.map(m => ({ id: m.id, monto: m.monto })),
                                        f.total, toleranciaM)
    if (grupo && grupo.length >= 2) {
      const movGrupo = grupo.map(g => banco.find(m => m.id === g.id)!)
      const match = crearMatch(grupo.map(g => g.id), [f.cufe], [], 'fuzzy', 0.80,
                               grupo.reduce((s,g) => s+g.monto,0), f.total, 0,
                               true, false)
      matches.push(match)
      movGrupo.forEach(m => marcarBanco(m, 'conciliado', match.idMatch, 0.80))
      marcarFactura(f, 'conciliado', match.idMatch, 0.80)
      n3++
    }
  }

  // One-to-many: un crédito → varias facturas (pago agrupado)
  const factPend2 = facturas.filter(f => f.estado === 'no_conciliado')
  for (const mov of banco.filter(m => m.tipo === 'credito' && m.estado === 'no_conciliado')) {
    const candidatas = factPend2.filter(
      f => f.estado === 'no_conciliado' && diffDias(mov.fecha, f.fechaEmision) <= toleranciaD * 4
    )
    if (candidatas.length < 2) continue
    const grupo = buscarSubconjuntoSuma(candidatas.map(f => ({ id: f.cufe, monto: f.total })),
                                        mov.monto, toleranciaM)
    if (grupo && grupo.length >= 2) {
      const factsGrupo = grupo.map(g => facturas.find(f => f.cufe === g.id)!)
      const match = crearMatch([mov.id], grupo.map(g => g.id), [], 'fuzzy', 0.80,
                               mov.monto, grupo.reduce((s,g) => s+g.monto,0), 0,
                               false, true)
      matches.push(match)
      marcarBanco(mov, 'conciliado', match.idMatch, 0.80)
      factsGrupo.forEach(f => marcarFactura(f, 'conciliado', match.idMatch, 0.80))
      n3++
    }
  }
  registrar(`Etapa 3 (agrupados): ${n3} matches`)

  // ── ETAPA 4: Siigo ↔ banco ────────────────────────────────────────────────
  let n4 = 0
  for (const mov of banco.filter(m => m.estado === 'no_conciliado')) {
    for (const s of siigo.filter(s => s.estado === 'no_conciliado')) {
      const dm = pctDiff(mov.monto, s.monto)
      if (dm > toleranciaM * 10) continue
      const dd = diffDias(mov.fecha, s.fecha)
      if (dd > toleranciaD * 2) continue
      const score = (1 - dm) * 0.6 + (1 - dd / (toleranciaD * 2 + 1)) * 0.4
      if (score >= umbralMin) {
        const estado: EstadoConciliacion = score >= 0.85 ? 'conciliado' : 'revision'
        const match = crearMatch([mov.id], [], [s.id], 'fuzzy', score,
                                 mov.monto, s.monto, Math.round(dd))
        matches.push(match)
        marcarBanco(mov, estado, match.idMatch, score)
        s.estado = estado; s.matchIds.push(match.idMatch); s.confianzaMatch = score
        n4++
        break
      }
    }
  }
  registrar(`Etapa 4 (Siigo↔banco): ${n4} matches`)

  // ── DISCREPANCIAS ─────────────────────────────────────────────────────────
  const discrepancias = detectarDiscrepancias(banco, facturas, matches)
  registrar(`Discrepancias detectadas: ${discrepancias.length}`)

  const nc = banco.filter(m => m.estado === 'conciliado').length
  registrar(`Resultado: ${nc}/${banco.length} movimientos banco conciliados`)

  return { matches, discrepancias, log }
}

// ─── DISCREPANCIAS ────────────────────────────────────────────────────────────

function detectarDiscrepancias(
  banco: MovimientoBancario[],
  facturas: FacturaElectronica[],
  matches: ResultadoMatch[],
): Discrepancia[] {
  const hoy = new Date().toISOString().slice(0, 10)
  const discs: Discrepancia[] = []

  for (const mov of banco) {
    if (mov.tipo === 'credito' && mov.estado === 'no_conciliado') {
      const sev: SeveridadDiscrepancia = mov.monto > 1_000_000 ? 'alta' : 'media'
      discs.push({
        id: idDisc(),
        tipo: 'pago_sin_factura',
        severidad: sev,
        descripcion: `Crédito de $${fmtCOP(mov.monto)} el ${mov.fecha} (${mov.descripcion.slice(0,50)}) sin factura DIAN asociada.`,
        montoInvolucrado: mov.monto,
        idsRelacionados: [mov.id],
        recomendacion: 'Verificar si existe la factura electrónica en el portal DIAN o si es un anticipo, préstamo u otro ingreso no facturado.',
        fechaDeteccion: hoy,
      })
    }
    if (mov.tipo === 'debito' && mov.estado === 'no_conciliado' && mov.monto > 500_000) {
      discs.push({
        id: idDisc(),
        tipo: 'debito_sin_soporte',
        severidad: 'baja',
        descripcion: `Débito de $${fmtCOP(mov.monto)} el ${mov.fecha} (${mov.descripcion.slice(0,50)}) sin soporte en Siigo.`,
        montoInvolucrado: mov.monto,
        idsRelacionados: [mov.id],
        recomendacion: 'Verificar si existe factura de compra o gasto registrado en el sistema contable.',
        fechaDeteccion: hoy,
      })
    }
  }

  for (const f of facturas) {
    if (f.estado === 'no_conciliado' && !f.esNota) {
      const venc = f.fechaVencimiento ?? f.fechaEmision
      const diasMora = Math.floor((new Date(hoy).getTime() - new Date(venc).getTime()) / 86_400_000)
      const sev: SeveridadDiscrepancia = diasMora > 30 ? 'alta' : 'media'
      discs.push({
        id: idDisc(),
        tipo: 'factura_sin_pago',
        severidad: sev,
        descripcion: `Factura ${f.numero} de ${f.nombreReceptor} por $${fmtCOP(f.total)} sin pago registrado.${diasMora > 0 ? ` Vencida hace ${diasMora} días.` : ''}`,
        montoInvolucrado: f.total,
        idsRelacionados: [f.cufe],
        recomendacion: 'Verificar si el pago fue recibido por otro medio o si está en proceso de cobro.',
        fechaDeteccion: hoy,
      })
    }
    if (f.esNota && f.estado === 'no_conciliado') {
      discs.push({
        id: idDisc(),
        tipo: 'nota_credito_pendiente',
        severidad: 'media',
        descripcion: `Nota crédito/débito ${f.numero} de ${f.nombreEmisor} por $${fmtCOP(f.total)} sin aplicar.`,
        montoInvolucrado: f.total,
        idsRelacionados: [f.cufe],
        recomendacion: `Aplicar a la factura referenciada${f.numeroReferenciado ? ` (${f.numeroReferenciado})` : ''}.`,
        fechaDeteccion: hoy,
      })
    }
  }

  for (const m of matches) {
    if (m.diferenciaMonto > 1_000) {
      discs.push({
        id: idDisc(),
        tipo: 'diferencia_monto',
        severidad: 'media',
        descripcion: `Match con diferencia de $${fmtCOP(m.diferenciaMonto)} (confianza: ${(m.confianza*100).toFixed(0)}%).`,
        montoInvolucrado: m.diferenciaMonto,
        idsRelacionados: [...m.idsBanco, ...m.idsFacturas],
        recomendacion: 'Verificar notas crédito/débito, descuentos o retenciones que expliquen la diferencia.',
        fechaDeteccion: hoy,
      })
    }
  }

  return discs
}

// ─── BÚSQUEDA DE SUBCONJUNTO ─────────────────────────────────────────────────

function buscarSubconjuntoSuma(
  items: Array<{ id: string; monto: number }>,
  objetivo: number,
  toleranciaPct: number,
): Array<{ id: string; monto: number }> | null {
  const N = Math.min(items.length, 12)
  for (let r = 2; r <= N; r++) {
    const grupos = combinaciones(items.slice(0, N), r)
    for (const grupo of grupos) {
      const suma = grupo.reduce((s, g) => s + g.monto, 0)
      if (pctDiff(suma, objetivo) <= toleranciaPct * 5) return grupo
    }
  }
  return null
}

function combinaciones<T>(arr: T[], k: number): T[][] {
  if (k === 1) return arr.map(x => [x])
  const result: T[][] = []
  for (let i = 0; i <= arr.length - k; i++) {
    const rest = combinaciones(arr.slice(i + 1), k - 1)
    for (const r of rest) result.push([arr[i], ...r])
  }
  return result
}

// ─── HELPERS INTERNOS ────────────────────────────────────────────────────────

function crearMatch(
  idsBanco: string[], idsFacturas: string[], idsSiigo: string[],
  tipo: 'exacto' | 'fuzzy' | 'manual',
  confianza: number,
  montoBanco: number, montoFactura: number, dd: number,
  esPagoParcial = false, esPagoAgrupado = false,
): ResultadoMatch {
  return {
    idMatch: idMatch(),
    idsBanco, idsFacturas, idsSiigo,
    tipoMatch: tipo,
    confianza,
    montoBanco, montoFactura,
    diferenciaMonto: Math.abs(montoBanco - montoFactura),
    diferenciaDias: dd,
    fechaMatch: new Date().toISOString().slice(0, 10),
    esPagoParcial, esPagoAgrupado,
  }
}

function marcarBanco(mov: MovimientoBancario, estado: EstadoConciliacion, matchId: string, conf: number) {
  mov.estado = estado; mov.matchIds.push(matchId); mov.confianzaMatch = conf
}

function marcarFactura(f: FacturaElectronica, estado: EstadoConciliacion, matchId: string, conf: number) {
  f.estado = estado; f.matchIds.push(matchId); f.confianzaMatch = conf
}

function fmtCOP(n: number): string {
  return new Intl.NumberFormat('es-CO').format(Math.round(n))
}

// ─── CONCILIACIÓN BANCARIA FORMAL ────────────────────────────────────────────
// Compara el extracto bancario (PDF/Excel) contra los registros en Siigo
// de las cuentas bancarias (PUC 11xx).  Produce el informe de "partidas
// conciliatorias" que el contador entrega junto al balance mensual.

const RE_CUENTA_BANCO = /^11/  // Bancos y cajas: 1105 (caja), 1110 (bancos), 1115, etc.

function idPartida() {
  return 'PRT_' + randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
}

function partida(
  tipo: TipoPartida,
  descripcion: string,
  fecha: string,
  monto: number,
  idOrigen: string,
  cuentaContable?: string,
  numeroDocumento?: string,
): PartidaConciliatoria {
  return { id: idPartida(), tipo, descripcion, fecha, monto, idOrigen, cuentaContable, numeroDocumento }
}

/** Compara monto con tolerancia absoluta de $1 o 0.1% */
function montosIguales(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1, Math.min(a, b) * 0.001)
}

/**
 * Genera el resumen de conciliación bancaria formal (formato colombiano).
 *
 * Requiere:
 *   - banco: movimientos del extracto bancario (PDF o Excel)
 *   - siigo: todos los movimientos del Libro Auxiliar
 *   - matches: resultado de ejecutarConciliacion() para marcar conciliados
 */
export function calcularConciliacionBancaria(
  banco: MovimientoBancario[],
  siigo: MovimientoSiigo[],
  config: ConfiguracionConciliacion,
): ResumenConciliacionBancaria | undefined {
  if (banco.length === 0 && siigo.length === 0) return undefined

  // Filtrar Siigo solo a cuentas bancarias y de caja (PUC 11xx)
  const siigoBank = siigo.filter(s => s.cuentaContable && RE_CUENTA_BANCO.test(s.cuentaContable))

  // Calcular saldo según extracto bancario
  // Si los movimientos tienen saldo, tomar el último; si no, calcular
  const ultimoConSaldo = [...banco].reverse().find(m => m.saldo != null && m.saldo > 0)
  let saldoSegunBanco: number
  if (ultimoConSaldo?.saldo) {
    saldoSegunBanco = ultimoConSaldo.saldo
  } else {
    const totalCreditos = banco.filter(m => m.tipo === 'credito').reduce((s, m) => s + m.monto, 0)
    const totalDebitos  = banco.filter(m => m.tipo === 'debito').reduce((s, m) => s + m.monto, 0)
    saldoSegunBanco = totalCreditos - totalDebitos
  }

  // Calcular saldo según libros Siigo (cuentas banco)
  const ultimoSiigoBanco = [...siigoBank].reverse().find(s => s.saldo != null && s.saldo! > 0)
  let saldoSegunLibros: number
  if (ultimoSiigoBanco?.saldo) {
    saldoSegunLibros = ultimoSiigoBanco.saldo
  } else if (siigoBank.length > 0) {
    const tc = siigoBank.reduce((s, m) => s + m.credito, 0)
    const td = siigoBank.reduce((s, m) => s + m.debito,  0)
    saldoSegunLibros = tc - td
  } else {
    saldoSegunLibros = saldoSegunBanco  // sin datos Siigo, no hay diferencia calculable
  }

  // ── Identificar partidas conciliatorias ──────────────────────────────────
  // Tolerancia: mismo monto ± 0.1% y fecha dentro de 10 días
  const DIAS_TOL = 10

  // Créditos banco sin match → depósitos en tránsito
  const depositosTransito: PartidaConciliatoria[] = banco
    .filter(m => m.tipo === 'credito' && m.estado === 'no_conciliado')
    .map(m => partida(
      'deposito_transito',
      `Depósito en tránsito — ${m.descripcion.slice(0, 60)}`,
      m.fecha, m.monto, m.id, undefined, m.referencia,
    ))

  // Débitos en Siigo sin match en banco → cheques/pagos pendientes de cobro
  const chequesPendientes: PartidaConciliatoria[] = siigoBank
    .filter(s => s.debito > 0 && s.estado === 'no_conciliado')
    .map(s => partida(
      'cheque_circulacion',
      `Pago/cheque pendiente — ${s.descripcion?.slice(0, 60) ?? s.numeroDocumento ?? ''}`,
      s.fecha, s.debito, s.id, s.cuentaContable, s.numeroDocumento,
    ))

  // Débitos banco sin match → notas débito del banco no contabilizadas
  const notasDebitoBanco: PartidaConciliatoria[] = banco
    .filter(m => m.tipo === 'debito' && m.estado === 'no_conciliado')
    .map(m => partida(
      'nota_debito_banco',
      `Cargo banco no contabilizado — ${m.descripcion.slice(0, 60)}`,
      m.fecha, m.monto, m.id,
    ))

  // Créditos Siigo banco sin match → notas crédito no contabilizadas
  const notasCreditoBanco: PartidaConciliatoria[] = siigoBank
    .filter(s => s.credito > 0 && s.estado === 'no_conciliado')
    .map(s => partida(
      'nota_credito_banco',
      `Abono banco no contabilizado — ${s.descripcion?.slice(0, 60) ?? ''}`,
      s.fecha, s.credito, s.id, s.cuentaContable, s.numeroDocumento,
    ))

  // Errores de registro: matches con diferencia significativa de monto
  const erroresRegistro: PartidaConciliatoria[] = []

  // ── Calcular saldos ajustados ─────────────────────────────────────────────
  const totalDepositos  = depositosTransito.reduce((s, p) => s + p.monto, 0)
  const totalCheques    = chequesPendientes.reduce((s, p) => s + p.monto, 0)
  const totalNDebito    = notasDebitoBanco.reduce((s, p) => s + p.monto, 0)
  const totalNCredito   = notasCreditoBanco.reduce((s, p) => s + p.monto, 0)

  // Fórmula conciliación bancaria colombiana:
  // Saldo ajustado banco = Saldo banco - Depósitos en tránsito + Cheques pendientes
  // Saldo ajustado libros = Saldo libros - Notas débito + Notas crédito
  const saldoAjustadoBanco  = saldoSegunBanco  - totalDepositos + totalCheques
  const saldoAjustadoLibros = saldoSegunLibros - totalNDebito   + totalNCredito
  const diferencia          = Math.abs(saldoAjustadoBanco - saldoAjustadoLibros)

  return {
    cuentaBancaria: config.numeroCuenta,
    saldoSegunBanco,
    saldoSegunLibros,
    depositosTransito,
    chequesPendientes,
    notasDebitoBanco,
    notasCreditoBanco,
    erroresRegistro,
    totalDepositosTransito: totalDepositos,
    totalChequesPendientes: totalCheques,
    totalNotasDebito:       totalNDebito,
    totalNotasCredito:      totalNCredito,
    saldoAjustadoBanco,
    saldoAjustadoLibros,
    diferencia,
    totalMovimientosBanco:       banco.length,
    totalMovimientosSiigoBanco:  siigoBank.length,
  }
}
