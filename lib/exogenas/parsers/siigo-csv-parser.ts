/**
 * Parser del Libro Auxiliar de Siigo → AsientoContable[]
 *
 * Soporta:
 * - Siigo Nube (Cloud) — separador punto y coma
 * - Siigo Escritorio — separador coma o tabulación
 * - Codificación UTF-8 y Windows-1252 (latin1)
 * - Números colombianos: 1.234.567,00
 * - Fechas DD/MM/YYYY y YYYY-MM-DD
 * - NIT con y sin dígito de verificación (900123456-1 o 900123456)
 */
import type { AsientoContable, TerceroExogena, TipoDocumentoDIAN } from '../types'
import { parsearNombreColombia, esPersonaJuridica } from '../utils/nombre-parser'

export interface ResultadoParseoCsv {
  asientos: AsientoContable[]
  advertencias: string[]
  totalFilas: number
  filasFallidas: number
  periodoDetectado?: string
  empresaDetectada?: string
}

// ── Mapeo de columnas reconocidas (insensible a mayúsculas/tildes) ────────────
const ALIAS_COLUMNAS: Record<string, string> = {
  // Cuenta PUC
  'codigo': 'cuenta', 'código': 'cuenta', 'cta': 'cuenta',
  'cuenta': 'cuenta', 'cod cuenta': 'cuenta', 'codigo cuenta': 'cuenta',
  'código cuenta': 'cuenta', 'cuenta contable': 'cuenta',
  // Nombre cuenta
  'nombre cuenta': 'nombreCuenta', 'nombre cta': 'nombreCuenta',
  'descripcion cuenta': 'nombreCuenta', 'descripción cuenta': 'nombreCuenta',
  // Tercero
  'tercero': 'terceroId', 'nit': 'terceroId', 'nit/cc': 'terceroId',
  'nit cc': 'terceroId', 'documento': 'terceroId', 'identificacion': 'terceroId',
  'identificación': 'terceroId',
  // Nombre tercero
  'nombre tercero': 'nombreTercero', 'razon social': 'nombreTercero',
  'razón social': 'nombreTercero', 'nombre': 'nombreTercero',
  'nombre cliente': 'nombreTercero', 'nombre proveedor': 'nombreTercero',
  // Comprobante
  'tipo comprobante': 'tipoComp', 'tipo doc': 'tipoComp', 'tipo': 'tipoComp',
  'comprobante': 'tipoComp',
  // Número
  'numero': 'numComp', 'número': 'numComp', 'num comprobante': 'numComp',
  'número comprobante': 'numComp', 'numero comprobante': 'numComp',
  'consecutivo': 'numComp', 'no.': 'numComp',
  // Fecha
  'fecha': 'fecha',
  // Descripción
  'detalle': 'descripcion', 'descripcion': 'descripcion',
  'descripción': 'descripcion', 'concepto': 'descripcion',
  'glosa': 'descripcion', 'nota': 'descripcion',
  // Valores
  'debito': 'debito', 'débito': 'debito', 'debe': 'debito',
  'debitos': 'debito', 'débitos': 'debito',
  'credito': 'credito', 'crédito': 'credito', 'haber': 'credito',
  'creditos': 'credito', 'créditos': 'credito',
  'valor': 'valor', 'monto': 'valor',
  // Naturaleza (algunas exportaciones incluyen columna D/C)
  'naturaleza': 'naturaleza', 'dc': 'naturaleza', 'd/c': 'naturaleza',
}

export function parsearSiigoCsv(texto: string): ResultadoParseoCsv {
  const advertencias: string[] = []

  // Normalizar saltos de línea
  const lineas = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  // Detectar delimitador
  const sep = detectarDelimitador(lineas)

  // Extraer metadata del encabezado (empresa, período)
  const meta = extraerMetadata(lineas, sep)

  // Encontrar fila de encabezados de columnas
  const { indiceHeader, columnas } = encontrarHeader(lineas, sep)
  if (indiceHeader === -1) {
    return { asientos: [], advertencias: ['No se encontró la fila de encabezados. Verifique que el archivo sea el Libro Auxiliar de Siigo.'], totalFilas: 0, filasFallidas: 0 }
  }

  // Parsear filas de datos
  const asientos: AsientoContable[] = []
  let filasFallidas = 0
  let idCounter = 1

  for (let i = indiceHeader + 1; i < lineas.length; i++) {
    const linea = lineas[i].trim()
    if (!linea) continue

    const celdas = parsearFila(linea, sep)
    if (celdas.length < 3) continue

    // Omitir filas de subtotales/totales
    const primerasCeldas = celdas.slice(0, 3).join(' ').toUpperCase()
    if (
      primerasCeldas.includes('TOTAL') ||
      primerasCeldas.includes('SUBTOTAL') ||
      primerasCeldas.includes('SUMA') ||
      primerasCeldas.includes('SALDO FINAL')
    ) continue

    try {
      const fila = mapearColumnas(celdas, columnas)

      // Ignorar si no tiene cuenta PUC ni valor
      if (!fila.cuenta) continue
      const debito = parsearMoneda(fila.debito ?? fila.valor ?? '0')
      const credito = parsearMoneda(fila.credito ?? '0')
      if (debito === 0 && credito === 0) continue

      // Determinar naturaleza y monto
      let naturaleza: 'debito' | 'credito'
      let monto: number

      if (fila.naturaleza) {
        const nat = fila.naturaleza.toUpperCase().trim()
        naturaleza = (nat === 'D' || nat === 'DEBITO' || nat === 'DÉBITO') ? 'debito' : 'credito'
        monto = debito > 0 ? debito : credito
      } else if (debito > 0) {
        naturaleza = 'debito'
        monto = debito
      } else {
        naturaleza = 'credito'
        monto = credito
      }

      // Tercero
      const tercero = construirTercero(fila.terceroId ?? '', fila.nombreTercero ?? '')

      const asiento: AsientoContable = {
        id: `SIIGO-${String(idCounter++).padStart(5, '0')}`,
        fecha: parsearFecha(fila.fecha ?? ''),
        cuentaPuc: normalizarCuenta(fila.cuenta),
        nombreCuenta: fila.nombreCuenta?.trim() ?? '',
        naturaleza,
        monto,
        tercero,
        documentoId: fila.tipoComp && fila.numComp ? `${fila.tipoComp.trim()}-${fila.numComp.trim()}` : fila.numComp?.trim() ?? '',
        descripcion: fila.descripcion?.trim() ?? '',
      }

      asientos.push(asiento)
    } catch {
      filasFallidas++
      if (filasFallidas <= 3) {
        advertencias.push(`Fila ${i + 1} ignorada — no se pudo interpretar: ${lineas[i].slice(0, 80)}`)
      }
    }
  }

  if (asientos.length === 0) {
    advertencias.push('No se encontraron movimientos. Verifique que exportó el Libro Auxiliar con la opción de "Detalle de movimientos".')
  }

  return {
    asientos,
    advertencias,
    totalFilas: asientos.length + filasFallidas,
    filasFallidas,
    periodoDetectado: meta.periodo,
    empresaDetectada: meta.empresa,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectarDelimitador(lineas: string[]): string {
  const muestra = lineas.slice(0, 20).join('\n')
  const conteos = {
    ';': (muestra.match(/;/g) ?? []).length,
    ',': (muestra.match(/,/g) ?? []).length,
    '\t': (muestra.match(/\t/g) ?? []).length,
  }
  return Object.entries(conteos).sort((a, b) => b[1] - a[1])[0][0]
}

function extraerMetadata(lineas: string[], sep: string): { empresa?: string; periodo?: string } {
  let empresa: string | undefined
  let periodo: string | undefined

  for (const linea of lineas.slice(0, 15)) {
    const texto = linea.replace(/["']/g, '').toLowerCase()
    if (texto.includes('empresa') || texto.includes('razón social') || texto.includes('razon social')) {
      empresa = linea.split(sep).map(c => c.replace(/["']/g, '').trim()).filter(Boolean).pop()
    }
    if (texto.includes('período') || texto.includes('periodo') || texto.includes('fecha')) {
      periodo = linea.split(sep).map(c => c.replace(/["']/g, '').trim()).filter(Boolean).pop()
    }
  }

  return { empresa, periodo }
}

function encontrarHeader(lineas: string[], sep: string): { indiceHeader: number; columnas: string[] } {
  const palabrasClave = ['cuenta', 'código', 'codigo', 'fecha', 'debito', 'débito', 'credito', 'crédito', 'debe', 'haber', 'tercero', 'nit']

  for (let i = 0; i < Math.min(lineas.length, 30); i++) {
    const linea = lineas[i].toLowerCase().replace(/["']/g, '')
    const coincidencias = palabrasClave.filter(p => linea.includes(p))
    if (coincidencias.length >= 2) {
      const columnas = parsearFila(lineas[i], sep)
        .map(c => c.toLowerCase().replace(/["']/g, '').trim())
        .map(c => ALIAS_COLUMNAS[c] ?? c)
      return { indiceHeader: i, columnas }
    }
  }
  return { indiceHeader: -1, columnas: [] }
}

function parsearFila(linea: string, sep: string): string[] {
  if (!linea.includes('"')) return linea.split(sep)

  // Manejar campos entre comillas (pueden contener el separador)
  const celdas: string[] = []
  let dentro = false
  let celda = ''
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (c === '"') { dentro = !dentro; continue }
    if (c === sep && !dentro) { celdas.push(celda); celda = ''; continue }
    celda += c
  }
  celdas.push(celda)
  return celdas
}

function mapearColumnas(celdas: string[], columnas: string[]): Record<string, string> {
  const fila: Record<string, string> = {}
  columnas.forEach((col, i) => {
    if (col && celdas[i] !== undefined) fila[col] = celdas[i].replace(/["']/g, '').trim()
  })
  return fila
}

function parsearMoneda(valor: string): number {
  if (!valor || valor.trim() === '') return 0
  // Formato colombiano: 1.234.567,00 → quitar puntos, reemplazar coma por punto
  const limpio = valor.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const num = parseFloat(limpio)
  return isNaN(num) ? 0 : Math.abs(num)
}

function parsearFecha(fecha: string): string {
  if (!fecha) return new Date().toISOString().slice(0, 10)

  // DD/MM/YYYY
  const m1 = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha

  // DD-MM-YYYY
  const m2 = fecha.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`

  return new Date().toISOString().slice(0, 10)
}

function normalizarCuenta(cuenta: string): string {
  // Quitar puntos y guiones al inicio, mantener el código limpio
  return cuenta.replace(/[.\s]/g, '').toUpperCase()
}

function construirTercero(idRaw: string, nombreRaw: string): TerceroExogena {
  // Quitar puntos de miles del NIT (900.123.456-1 → 900123456-1)
  const idLimpio = idRaw.replace(/\./g, '').trim()
  let numeroId = idLimpio
  let dv = ''

  // DV separado por guión → definitivamente NIT
  const conDv = idLimpio.match(/^(\d+)-(\d)$/)
  if (conDv) { numeroId = conDv[1]; dv = conDv[2] }
  const soloDigitos = numeroId.replace(/\D/g, '')

  const nombre = nombreRaw.trim()
  const esPJ = esPersonaJuridica(nombre)

  // tipoDocumento: tiene DV o es empresa → NIT ('3'); CC/CE → '1'
  const tipoDocumento: TipoDocumentoDIAN = (conDv || esPJ) ? '3' : '1'

  const nombres = !esPJ ? parsearNombreColombia(nombre) : null

  return {
    tipoDocumento,
    numeroId:        soloDigitos,
    dv:              dv || undefined,
    paisCodigo:      'CO',
    razonSocial:     esPJ ? nombre : undefined,
    primerApellido:  nombres?.primerApellido  || undefined,
    segundoApellido: nombres?.segundoApellido || undefined,
    primerNombre:    nombres?.primerNombre    || undefined,
    otrosNombres:    nombres?.otrosNombres    || undefined,
    tipoTercero:     esPJ ? 'persona_juridica' : 'persona_natural',
  }
}
