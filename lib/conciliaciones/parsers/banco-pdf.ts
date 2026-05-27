/**
 * Parser de extractos bancarios en PDF para bancos colombianos.
 *
 * Arquitectura: detección automática del banco → estrategia específica → fallback genérico.
 *
 * Estrategias implementadas:
 *   • Davivienda  — formato "DD MM $ X,XXX.XX+/-  DOC  Descripción  Oficina"
 *   • Bancolombia — formato "DD/MM/YYYY  Descripción  Débito  Crédito  Saldo"
 *   • BBVA        — formato "DD/MM/YYYY  Concepto  Cargo  Abono  Saldo"
 *   • Bogotá      — similar a Bancolombia
 *   • Genérico    — busca fechas + montos en cualquier formato
 *
 * LIMITACIÓN: PDFs escaneados (imágenes sin capa de texto OCR) no son soportados.
 */
import { createHash } from 'crypto'
import type { MovimientoBancario, TipoMovimiento } from '../models'

// ─── POLYFILL DOMMatrix ───────────────────────────────────────────────────────
// pdf.js (usado por pdf-parse) requiere DOMMatrix para transformaciones de matriz.
// Esta API existe en el navegador y en Node.js >= 19.2. En Node.js < 19 la
// simulamos con un stub suficiente para que el parser funcione.
if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  ;(globalThis as any).DOMMatrix = class DOMMatrix {
    m11=1;m12=0;m13=0;m14=0;m21=0;m22=1;m23=0;m24=0
    m31=0;m32=0;m33=1;m34=0;m41=0;m42=0;m43=0;m44=1
    isIdentity=true;is2D=true
    a=1;b=0;c=0;d=1;e=0;f=0
    constructor(_?: string | number[]) {}
    multiply()          { return new (globalThis as any).DOMMatrix() }
    translate()         { return new (globalThis as any).DOMMatrix() }
    scale()             { return new (globalThis as any).DOMMatrix() }
    scale3d()           { return new (globalThis as any).DOMMatrix() }
    rotate()            { return new (globalThis as any).DOMMatrix() }
    rotateFromVector()  { return new (globalThis as any).DOMMatrix() }
    rotateAxisAngle()   { return new (globalThis as any).DOMMatrix() }
    skewX()             { return new (globalThis as any).DOMMatrix() }
    skewY()             { return new (globalThis as any).DOMMatrix() }
    flipX()             { return new (globalThis as any).DOMMatrix() }
    flipY()             { return new (globalThis as any).DOMMatrix() }
    inverse()           { return new (globalThis as any).DOMMatrix() }
    invertSelf()        { return this }
    multiplySelf()      { return this }
    preMultiplySelf()   { return this }
    translateSelf()     { return this }
    scaleSelf()         { return this }
    scale3dSelf()       { return this }
    rotateSelf()        { return this }
    rotateFromVectorSelf() { return this }
    rotateAxisAngleSelf()  { return this }
    skewXSelf()         { return this }
    skewYSelf()         { return this }
    setMatrixValue()    { return this }
    transformPoint(p?: any) { return { x: p?.x ?? 0, y: p?.y ?? 0, z: 0, w: 1 } }
    toFloat32Array()    { return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]) }
    toFloat64Array()    { return new Float64Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]) }
    toString()          { return 'matrix(1, 0, 0, 1, 0, 0)' }
    toJSON()            { return { isIdentity: true, is2D: true } }
    static fromMatrix()       { return new (globalThis as any).DOMMatrix() }
    static fromFloat32Array() { return new (globalThis as any).DOMMatrix() }
    static fromFloat64Array() { return new (globalThis as any).DOMMatrix() }
  }
}

// ─── EXTRACTOR PDF ────────────────────────────────────────────────────────────
// pdf-parse v2 cambió completamente la API: ya no exporta una función sino
// la clase PDFParse con constructor({ data: Buffer }) y método getText().
// Se carga con eval('require') para que Next.js/webpack no lo bundle como
// módulo ESM — de lo contrario falla en el servidor standalone de cPanel.
async function extraerTextoPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line no-eval
  const req = eval('require') as NodeRequire
  const { PDFParse } = req('pdf-parse') as { PDFParse: new (opts: object) => { getText(opts?: object): Promise<{ pages: Array<{ text: string; num: number }>; text: string }> } }
  const parser = new PDFParse({ data: buffer, verbosity: 0 })
  const resultado = await parser.getText({ normalizeWhitespace: true })
  // Unir páginas con salto de línea — más limpio que result.text que añade separadores
  return resultado.pages.map(p => p.text).join('\n')
}

// ─── TIPOS INTERNOS ───────────────────────────────────────────────────────────

export interface ResultadoParserPdf {
  movimientos: MovimientoBancario[]
  errores: string[]
  lineasDetectadas: number
  banco?: string
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function generarId(banco: string, fecha: string, desc: string, monto: number, idx: number): string {
  return 'PDF_' + createHash('md5')
    .update(`${banco}|${fecha}|${desc.slice(0, 30)}|${monto}|${idx}`)
    .digest('hex').slice(0, 12).toUpperCase()
}

/** Normaliza DD/MM/YYYY, DD-MM-YYYY o YYYY-MM-DD a ISO YYYY-MM-DD */
function normalizarFecha(raw: string): string | null {
  const m1 = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const m2 = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/)
  if (m2) return `20${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`
  return null
}

/** Monto en formato internacional: 1,234,567.89 → 1234567.89 */
function parsearMontoInt(raw: string): number {
  return Math.abs(parseFloat(raw.replace(/,/g, '').replace(/\$/g, '').trim()) || 0)
}

/** Monto en formato colombiano: 1.234.567,89 → 1234567.89 */
function parsearMontoCOP(raw: string): number {
  return Math.abs(parseFloat(raw.replace(/\./g, '').replace(',', '.').replace(/\$/g, '').trim()) || 0)
}

/**
 * Parsea un monto en cualquier formato colombiano o internacional.
 * Detecta automáticamente el separador de miles/decimal.
 */
function parsearMontoAmbiguo(raw: string): number {
  const s = raw.replace(/\$/g, '').replace(/\s/g, '').trim()
  if (!s) return 0
  // Colombiano con decimal: 1.234.567,89
  if (/^[\d.]+,\d{1,2}$/.test(s)) return parsearMontoCOP(s)
  // Internacional con decimal: 1,234,567.89
  if (/^[\d,]+\.\d{1,2}$/.test(s)) return parsearMontoInt(s)
  // Solo puntos (miles colombiano): 1.234.567
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, '')) || 0
  // Solo comas (miles internacional): 1,234,567
  if (/^\d{1,3}(,\d{3})+$/.test(s)) return parseFloat(s.replace(/,/g, '')) || 0
  // Número plano
  return Math.abs(parseFloat(s) || 0)
}

function nuevoMovimiento(
  banco: string, fecha: string, descripcion: string,
  tipo: TipoMovimiento, monto: number, saldo: number | undefined,
  cuenta: string | undefined, idx: number,
): MovimientoBancario {
  return {
    id: generarId(banco, fecha, descripcion, monto, idx),
    fecha,
    descripcion: descripcion.slice(0, 150),
    tipo, monto, saldo,
    banco, cuenta,
    estado: 'no_conciliado', matchIds: [], confianzaMatch: 0,
  }
}

// ─── DETECCIÓN DE BANCO ───────────────────────────────────────────────────────

type BancoDetectado = 'davivienda' | 'bancolombia' | 'bbva' | 'bogota' | 'generico'

function detectarBanco(texto: string): { banco: BancoDetectado; nombre: string } {
  const t = texto.toLowerCase()
  if (t.includes('davivienda'))   return { banco: 'davivienda',   nombre: 'Davivienda'     }
  if (t.includes('bancolombia'))  return { banco: 'bancolombia',  nombre: 'Bancolombia'    }
  if (t.includes('bbva'))         return { banco: 'bbva',         nombre: 'BBVA Colombia'  }
  if (t.includes('banco de bogot')) return { banco: 'bogota',     nombre: 'Banco de Bogotá'}
  if (t.includes('banco bogot'))  return { banco: 'bogota',       nombre: 'Banco de Bogotá'}
  return { banco: 'generico', nombre: 'Banco' }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ESTRATEGIA 1 — DAVIVIENDA
//  Formato extracto cuenta ahorros / corriente Davivienda:
//
//    INFORME DEL MES: ABRIL /2026
//    ...
//    Saldo Anterior $74,717,164.92
//    Nuevo Saldo    $13,809,076.41
//    ...
//    Fecha  Valor          Doc.   Clase de Movimiento           Oficina
//    01 04  $ 839.00-      0401   Cobro Deposito Nacional       BTA PROCESOS ESP.
//    05 04  $ 2,800,000.00- 5271  Pagos por Internet RUNT 2.0   Compras y Pagos PSE
//    06 04  $ 368,600.00+  1000   Abono Transferencia 5504884…  App Davivienda
//
//  Notas:
//    • Fecha = "DD MM" (día + número de mes). Año viene del header.
//    • Monto con separador de miles = coma, decimal = punto (formato internacional).
//    • El signo + / - al FINAL del monto indica crédito / débito.
//    • Descripción puede continuar en línea(s) siguiente(s) sin prefijo de fecha.
// ─────────────────────────────────────────────────────────────────────────────

// Detecta inicio de fila de transacción Davivienda: "DD MM $ AMOUNT+/-"
// Soporta formato internacional (1,234.00) y colombiano (1.234,00)
const RE_DAVI_TX = /^(\d{1,2})\s+(\d{1,2})\s+\$\s*([\d.,]+)\s*([+-])\s*(\d{2,})?[^\w]*(.*)/

// Líneas que nunca son continuación de descripción
const RE_DAVI_SKIP = /^(fecha\s+valor|cuenta\s+de\s+(ahorros|corriente)|banco\s+davivienda|nit\.|apreciado\s+cliente|saldo\s+(anterior|promedio|nuevo)|m[aá]s\s+cr[eé]ditos|menos\s+d[eé]bitos|informe\s+del\s+mes|este\s+producto|cualquier\s+diferencia|recuerde|h\.0|vigilado|superintendencia|\d{1,4}\s*$|la\s+importancia)/i

function parsearDavivienda(
  texto: string,
  cuenta?: string,
): ResultadoParserPdf {
  const movimientos: MovimientoBancario[] = []
  const errores: string[] = []

  // ── Extraer año del header ─────────────────────────────────────────────────
  const añoMatch = texto.match(/(?:INFORME\s+DEL\s+MES|\/)\s*(\d{4})/i)
    ?? texto.match(/\b(202[0-9])\b/)
  const año = añoMatch ? parseInt(añoMatch[1]) : new Date().getFullYear()

  // ── Extraer saldos de resumen para validación ──────────────────────────────
  const saldoNuevoMatch = texto.match(/Nuevo\s+Saldo\s+\$?\s*([\d,]+\.\d{2})/i)
  const saldoNuevo = saldoNuevoMatch ? parsearMontoInt(saldoNuevoMatch[1]) : undefined

  // ── Procesar líneas con estado "transacción en curso" ─────────────────────
  const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  interface TxEnCurso {
    dd: string; mm: string
    monto: number; signo: '+' | '-'
    doc: string; partesDesc: string[]
  }
  let tx: TxEnCurso | null = null

  const emitirTx = () => {
    if (!tx || tx.monto <= 0) { tx = null; return }
    const mes  = tx.mm.padStart(2, '0')
    const dia  = tx.dd.padStart(2, '0')
    const fecha = `${año}-${mes}-${dia}`
    const tipo: TipoMovimiento = tx.signo === '+' ? 'credito' : 'debito'
    const desc = tx.partesDesc.join(' ').replace(/\s{2,}/g, ' ').trim()
    movimientos.push(nuevoMovimiento(
      'Davivienda', fecha, desc || `Movimiento ${tx.doc}`,
      tipo, tx.monto, undefined, cuenta, movimientos.length,
    ))
    tx = null
  }

  for (const linea of lineas) {
    const m = linea.match(RE_DAVI_TX)
    if (m) {
      emitirTx()
      const monto = parsearMontoAmbiguo(m[3])
      if (monto > 0) {
        tx = {
          dd: m[1], mm: m[2],
          monto, signo: m[4] as '+' | '-',
          doc: m[5] ?? '',
          partesDesc: m[6] ? [m[6].trim()] : [],
        }
      }
    } else if (tx) {
      // Línea de continuación: agregar a descripción si no es ruido
      if (!RE_DAVI_SKIP.test(linea) && linea.length > 2) {
        tx.partesDesc.push(linea)
      }
    }
  }
  emitirTx()

  if (movimientos.length === 0) {
    errores.push(
      'Davivienda: no se encontraron transacciones con el formato esperado "DD MM $ monto+/-". ' +
      'Se intentará el parser genérico como alternativa.',
    )
  }

  return { movimientos, errores, lineasDetectadas: movimientos.length, banco: 'Davivienda' }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ESTRATEGIA 2 — BANCOLOMBIA
//  Formato extracto cuenta Bancolombia:
//
//    DD/MM/YYYY  Descripción  [Débito]  [Crédito]  Saldo
//
//  Notas:
//    • Fecha al inicio de línea en formato DD/MM/YYYY.
//    • Dos columnas de monto en formato colombiano 1.234.567,89.
//    • Una de las dos columnas es 0 o está vacía; la otra es el movimiento.
//    • El saldo va al final.
// ─────────────────────────────────────────────────────────────────────────────

const RE_BC_FECHA = /^(\d{1,2}\/\d{1,2}\/\d{4})\b/
const RE_COP_MONTO = /\d{1,3}(?:\.\d{3})*,\d{2}/g

function extraerMontosCOP(txt: string): number[] {
  return [...txt.matchAll(RE_COP_MONTO)].map(m =>
    parseFloat(m[0].replace(/\./g, '').replace(',', '.')) || 0,
  ).filter(n => n >= 100)
}

function parsearBancolombia(
  texto: string,
  cuenta?: string,
): ResultadoParserPdf {
  const movimientos: MovimientoBancario[] = []
  const errores: string[] = []
  let lineasConFecha = 0
  let saldoAnterior: number | null = null

  // Separar en "filas": insertar \n antes de cada DD/MM/YYYY para deshacer collapsing
  const textoSeparado = texto.replace(/(\d{1,2}\/\d{1,2}\/\d{4})/g, '\n$1')
  const lineas = textoSeparado.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 10)

  for (const linea of lineas) {
    const mFecha = linea.match(RE_BC_FECHA)
    if (!mFecha) continue
    lineasConFecha++

    const fecha = normalizarFecha(mFecha[1])
    if (!fecha) continue

    const resto = linea.slice(mFecha[0].length).trim()
    const montos = extraerMontosCOP(resto)
    if (montos.length === 0) continue

    let descripcion = resto
      .replace(RE_COP_MONTO, '')
      .replace(/\s{2,}/g, ' ').trim()
    if (!descripcion) descripcion = 'Movimiento Bancolombia'

    let monto: number
    let saldo: number | undefined
    let tipo: TipoMovimiento

    if (montos.length >= 3) {
      saldo = montos[montos.length - 1]
      const debito  = montos[montos.length - 3]
      const credito = montos[montos.length - 2]
      if (debito > 0 && credito === 0)       { tipo = 'debito';  monto = debito  }
      else if (credito > 0 && debito === 0)  { tipo = 'credito'; monto = credito }
      else {
        tipo = saldoAnterior != null
          ? (saldo > saldoAnterior ? 'credito' : 'debito')
          : (debito >= credito ? 'debito' : 'credito')
        monto = tipo === 'debito' ? debito : credito
      }
      saldoAnterior = saldo
    } else if (montos.length === 2) {
      monto = montos[0]; saldo = montos[1]
      tipo = saldoAnterior != null
        ? (saldo >= saldoAnterior ? 'credito' : 'debito')
        : inferirTipoKeywords(descripcion)
      saldoAnterior = saldo
    } else {
      monto = montos[0]
      tipo  = inferirTipoKeywords(descripcion)
    }

    if (monto <= 0) continue
    movimientos.push(nuevoMovimiento('Bancolombia', fecha, descripcion, tipo, monto, saldo, cuenta, movimientos.length))
  }

  if (movimientos.length === 0)
    errores.push('Bancolombia: no se detectaron transacciones. Verifique que el PDF sea el extracto digital original.')

  return { movimientos, errores, lineasDetectadas: lineasConFecha, banco: 'Bancolombia' }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ESTRATEGIA 3 — GENÉRICA (BBVA, Bogotá y otros)
//  Busca fechas en cualquier formato y extrae montos adyacentes.
//  También detecta signos explícitos +/-.
// ─────────────────────────────────────────────────────────────────────────────

const RE_FECHA_GEN = /(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}-\d{2}-\d{4})/g

function parsearGenerico(
  texto: string,
  nombreBanco: string,
  cuenta?: string,
): ResultadoParserPdf {
  const movimientos: MovimientoBancario[] = []
  const errores: string[] = []

  // Insertar saltos antes de fechas para separar filas colapsadas
  const textoProcesado = texto.replace(RE_FECHA_GEN, '\n$1')
  const lineas = textoProcesado.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 10)

  const RE_INICIO = /^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/
  let lineasConFecha = 0
  let saldoAnterior: number | null = null

  for (const linea of lineas) {
    const mf = linea.match(RE_INICIO)
    if (!mf) continue

    // Intentar primero detectar signo explícito tipo Davivienda
    const mSign = linea.match(/\$\s*([\d,]+(?:\.\d{2})?)\s*([+-])/)
    if (mSign) {
      const fecha = normalizarFecha(mf[1])
      if (!fecha) continue
      lineasConFecha++
      const monto = parsearMontoInt(mSign[1])
      if (monto <= 0) continue
      const tipo: TipoMovimiento = mSign[2] === '+' ? 'credito' : 'debito'
      const desc = linea.replace(mf[0], '').replace(/\$[\d,. ]+[+-]/, '').replace(/\s{2,}/g, ' ').trim()
      movimientos.push(nuevoMovimiento(nombreBanco, fecha, desc || 'Movimiento', tipo, monto, undefined, cuenta, movimientos.length))
      continue
    }

    // Intentar formato colombiano
    const fecha = normalizarFecha(mf[1])
    if (!fecha) continue
    const resto = linea.slice(mf[0].length).trim()
    lineasConFecha++

    const montosCOP = extraerMontosCOP(resto)
    if (montosCOP.length > 0) {
      let monto: number; let saldo: number | undefined; let tipo: TipoMovimiento
      if (montosCOP.length >= 3) {
        saldo = montosCOP[montosCOP.length - 1]
        const a = montosCOP[montosCOP.length - 3], b = montosCOP[montosCOP.length - 2]
        if (a > 0 && b === 0) { tipo = 'debito'; monto = a }
        else if (b > 0 && a === 0) { tipo = 'credito'; monto = b }
        else {
          tipo = saldoAnterior != null ? (saldo >= saldoAnterior ? 'credito' : 'debito') : 'debito'
          monto = tipo === 'debito' ? a : b
        }
        saldoAnterior = saldo
      } else if (montosCOP.length === 2) {
        monto = montosCOP[0]; saldo = montosCOP[1]
        tipo = saldoAnterior != null ? (saldo >= saldoAnterior ? 'credito' : 'debito') : inferirTipoKeywords(resto)
        saldoAnterior = saldo
      } else {
        monto = montosCOP[0]; tipo = inferirTipoKeywords(resto)
      }
      if (monto <= 0) continue
      const desc = resto.replace(RE_COP_MONTO, '').replace(/\s{2,}/g, ' ').trim()
      movimientos.push(nuevoMovimiento(nombreBanco, fecha, desc || 'Movimiento', tipo, monto, saldo, cuenta, movimientos.length))
      continue
    }

    // Fallback: montos con coma decimal internacional
    const montosInt = [...resto.matchAll(/\d{1,3}(?:,\d{3})*\.\d{2}/g)].map(m => parsearMontoInt(m[0])).filter(n => n >= 100)
    if (montosInt.length > 0) {
      const monto = montosInt[0]
      const saldo = montosInt[1]
      const tipo = inferirTipoKeywords(resto)
      const desc = resto.replace(/\d{1,3}(?:,\d{3})*\.\d{2}/g, '').replace(/\s{2,}/g, ' ').trim()
      movimientos.push(nuevoMovimiento(nombreBanco, fecha, desc || 'Movimiento', tipo, monto, saldo, cuenta, movimientos.length))
    }
  }

  if (lineasConFecha === 0)
    errores.push(`${nombreBanco}: no se encontraron fechas en el texto extraído. El PDF podría ser un escaneado o tener un formato no reconocido.`)
  else if (movimientos.length === 0)
    errores.push(`${nombreBanco}: se detectaron ${lineasConFecha} fechas pero no se pudieron extraer montos.`)

  return { movimientos, errores, lineasDetectadas: lineasConFecha, banco: nombreBanco }
}

// ─── INFERENCIA DE TIPO POR PALABRAS CLAVE ───────────────────────────────────

function inferirTipoKeywords(desc: string): TipoMovimiento {
  const RE_C = /consignaci[oó]n|abono|pago\s*pse|ingreso|nota\s*cr[eé]dito|devoluci[oó]n|reintegro|recaudo|dep[oó]sito|rendimiento|transferencia\s*recib/i
  const RE_D = /retiro|compra|pago\s+a\s|pago\s+serv|cargo|comisi[oó]n|cuota|gmf|4x1000|impuesto|gravamen|cheque|descuento|transferencia\s*(envia|otra)/i
  if (RE_C.test(desc)) return 'credito'
  if (RE_D.test(desc)) return 'debito'
  return 'debito'
}

// ─── ENTRADA PÚBLICA ─────────────────────────────────────────────────────────

export async function parsearExtractoBancarioPdf(
  buffer: Buffer,
  nombreBancoHint = 'Banco',
  cuenta?: string,
): Promise<ResultadoParserPdf> {
  // ── Extraer texto del PDF ──────────────────────────────────────────────────
  let textoRaw = ''
  try {
    textoRaw = await extraerTextoPdf(buffer)
  } catch (e) {
    return {
      movimientos: [], errores: [
        `No se pudo extraer texto del PDF: ${String(e).slice(0, 200)}. ` +
        'Si el PDF está protegido o es un escaneado, solicite el extracto en formato Excel (.xlsx).',
      ], lineasDetectadas: 0,
    }
  }

  if (!textoRaw || textoRaw.trim().length < 30) {
    return {
      movimientos: [], errores: [
        'El PDF no contiene texto legible. Es un extracto ESCANEADO (imagen). ' +
        'Descargue el extracto DIGITAL desde la aplicación o página web del banco. ' +
        'Si el banco no ofrece PDF digital, solicite el extracto en formato Excel (.xlsx).',
      ], lineasDetectadas: 0,
    }
  }

  // ── Detectar banco y aplicar estrategia específica ────────────────────────
  const { banco, nombre } = detectarBanco(textoRaw)
  const nombreFinal = nombre || nombreBancoHint

  let resultado: ResultadoParserPdf

  switch (banco) {
    case 'davivienda':
      resultado = parsearDavivienda(textoRaw, cuenta)
      break
    case 'bancolombia':
      resultado = parsearBancolombia(textoRaw, cuenta)
      break
    case 'bbva':
    case 'bogota':
    default:
      resultado = parsearGenerico(textoRaw, nombreFinal, cuenta)
      break
  }

  // Si el parser específico no encontró movimientos, intentar el genérico como fallback
  if (resultado.movimientos.length === 0 && banco !== 'generico') {
    const fallback = parsearGenerico(textoRaw, nombreFinal, cuenta)
    if (fallback.movimientos.length > 0) {
      return {
        ...fallback,
        errores: [...resultado.errores, ...fallback.errores],
      }
    }
    // Fallback también falló — devolver errores combinados con diagnóstico
    return {
      movimientos: [],
      errores: [
        ...resultado.errores,
        ...fallback.errores,
        `Diagnóstico: se extrajo texto del PDF (${textoRaw.trim().length} caracteres). ` +
        'Si las cifras del extracto usan formato diferente al esperado, ' +
        'descargue el extracto en formato Excel (.xlsx) desde el portal del banco.',
      ],
      lineasDetectadas: resultado.lineasDetectadas,
      banco: resultado.banco,
    }
  }

  return resultado
}
