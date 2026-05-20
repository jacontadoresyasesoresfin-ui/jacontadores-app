/**
 * POST /api/conciliaciones/procesar
 * Recibe archivos (extracto banco, XMLs DIAN, Siigo) + configuración
 * y retorna el ResultadoConciliacion completo como JSON.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

import { parsearExtractoBancario }   from '@/lib/conciliaciones/parsers/banco'
import { parsearXmlDian }            from '@/lib/conciliaciones/parsers/dian-xml'
import { parsearSiigo }              from '@/lib/conciliaciones/parsers/siigo'
import { ejecutarConciliacion }      from '@/lib/conciliaciones/conciliador'
import { calcularIva }               from '@/lib/conciliaciones/tax/iva'
import { calcularRetefuente }        from '@/lib/conciliaciones/tax/retefuente'
import { calcularIca }               from '@/lib/conciliaciones/tax/ica'
import type { ResultadoConciliacion, ConfiguracionConciliacion, KpisConciliacion }
  from '@/lib/conciliaciones/models'
import { FORMATOS_BANCO }            from '@/lib/conciliaciones/config'

// Desactivar el body parser de Next.js para manejar FormData directamente
export const config = { api: { bodyParser: false } }

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const form = await req.formData()

    // ── Configuración ──────────────────────────────────────────────────────
    const cfg: ConfiguracionConciliacion = {
      periodoInicio:       form.get('periodoInicio') as string ?? '',
      periodoFin:          form.get('periodoFin')   as string ?? '',
      nitEmpresa:          form.get('nitEmpresa')   as string ?? '',
      nombreEmpresa:       form.get('nombreEmpresa') as string ?? '',
      banco:               form.get('banco')         as string ?? 'bancolombia',
      numeroCuenta:        form.get('numeroCuenta')  as string ?? undefined,
      municipioIca:        form.get('municipioIca')  as string ?? 'Bogotá D.C.',
      ciuuPrincipal:       form.get('ciuuPrincipal') as string ?? undefined,
      toleranciaMontosPct: parseFloat(form.get('toleranciaMontosPct') as string ?? '0.001'),
      toleranciaDias:      parseInt(form.get('toleranciaDias') as string ?? '5'),
      umbralConfianzaMin:  parseFloat(form.get('umbralConfianzaMin') as string ?? '0.50'),
      incluirNotasCredito: form.get('incluirNotasCredito') !== 'false',
      calcularIva:         form.get('calcularIva')   !== 'false',
      calcularRfte:        form.get('calcularRfte')  !== 'false',
      calcularIca:         form.get('calcularIca')   !== 'false',
    }

    const erroresIngesta: string[] = []

    // ── Extracto bancario ──────────────────────────────────────────────────
    const archivoBanco = form.get('banco_archivo') as File | null
    const banco: Awaited<ReturnType<typeof parsearExtractoBancario>>['movimientos'] = []

    if (archivoBanco && archivoBanco.size > 0) {
      const buf = Buffer.from(await archivoBanco.arrayBuffer())
      const formatoKey = (cfg.banco in FORMATOS_BANCO
        ? cfg.banco : 'bancolombia') as keyof typeof FORMATOS_BANCO
      const res = parsearExtractoBancario(buf, archivoBanco.name, formatoKey,
                                          undefined, cfg.numeroCuenta)
      banco.push(...res.movimientos)
      erroresIngesta.push(...res.errores)
    }

    // ── Facturas DIAN (múltiples XMLs) ─────────────────────────────────────
    const facturas: Awaited<ReturnType<typeof calcularIva>> extends any ? any : never = []
    const archivosXml = form.getAll('dian_xmls') as File[]

    for (const archivo of archivosXml) {
      if (!archivo || archivo.size === 0) continue
      const buf = Buffer.from(await archivo.arrayBuffer())

      if (archivo.name.toLowerCase().endsWith('.zip')) {
        // Descomprimir ZIP y parsear cada XML dentro
        const { parsearZipDian } = await import('./_zip-helper')
        const { facturas: fs, errores } = await parsearZipDian(buf)
        facturas.push(...fs)
        erroresIngesta.push(...errores)
      } else {
        const factura = parsearXmlDian(buf, archivo.name)
        if (factura) facturas.push(factura)
        else erroresIngesta.push(`No se pudo parsear: ${archivo.name}`)
      }
    }

    // ── Siigo ──────────────────────────────────────────────────────────────
    const siigo: Awaited<ReturnType<typeof parsearSiigo>>['movimientos'] = []
    const archivosSiigo = form.getAll('siigo_archivos') as File[]
    for (const archivo of archivosSiigo) {
      if (!archivo || archivo.size === 0) continue
      const buf = Buffer.from(await archivo.arrayBuffer())
      const tipo = form.get('siigo_tipo') as string ?? 'auto'
      const res = parsearSiigo(buf, archivo.name, tipo)
      siigo.push(...res.movimientos)
      erroresIngesta.push(...res.errores)
    }

    // ── Conciliación ───────────────────────────────────────────────────────
    const { matches, discrepancias, log } = ejecutarConciliacion(banco, facturas, siigo, cfg)

    // ── Motores tributarios ────────────────────────────────────────────────
    const periodoStr = `${cfg.periodoInicio.slice(0,7)} — ${cfg.periodoFin.slice(0,7)}`
    const nit        = cfg.nitEmpresa

    const resumenIva   = cfg.calcularIva  && facturas.length > 0
      ? calcularIva(facturas, nit, periodoStr) : undefined
    const resumenRfte  = cfg.calcularRfte && (facturas.length > 0 || siigo.length > 0)
      ? calcularRetefuente(facturas, siigo, nit, periodoStr) : undefined
    const resumenIca   = cfg.calcularIca  && facturas.length > 0
      ? calcularIca(facturas, nit, periodoStr, cfg.municipioIca, cfg.ciuuPrincipal) : undefined

    // ── KPIs ───────────────────────────────────────────────────────────────
    const totalCreditos = banco.filter(m => m.tipo === 'credito').reduce((s,m) => s+m.monto, 0)
    const totalDebitos  = banco.filter(m => m.tipo === 'debito').reduce((s,m) => s+m.monto, 0)
    const nBancoConc    = banco.filter(m => m.estado === 'conciliado').length
    const nBancoNoConc  = banco.filter(m => m.estado === 'no_conciliado').length
    const nFactConc     = facturas.filter((f: any) => f.estado === 'conciliado').length
    const nFactNoConc   = facturas.filter((f: any) => f.estado === 'no_conciliado').length

    const kpis: KpisConciliacion = {
      totalBancoCreditos: totalCreditos,
      totalBancoDebitos:  totalDebitos,
      totalFacturasVentas: facturas
        .filter((f: any) => !f.esNota && f.nitEmisor.replace(/\D/g,'') === nit.replace(/\D/g,''))
        .reduce((s: number, f: any) => s + f.total, 0),
      numBancoConciliados:     nBancoConc,
      numBancoNoConciliados:   nBancoNoConc,
      numFacturasConciliadas:  nFactConc,
      numFacturasNoConciliadas:nFactNoConc,
      porcentajeConciliadoBanco:    banco.length > 0 ? nBancoConc / banco.length * 100 : 0,
      porcentajeConciliadoFacturas: facturas.length > 0 ? nFactConc / facturas.length * 100 : 0,
    }

    const resultado: ResultadoConciliacion = {
      config: cfg,
      fechaProceso: new Date().toISOString(),
      version: '1.0.0',
      movimientosBanco: banco,
      facturasDian: facturas,
      movimientosSiigo: siigo,
      matches,
      discrepancias,
      resumenIva,
      resumenRetefuente: resumenRfte,
      resumenIca,
      kpis,
      logProceso: [
        ...erroresIngesta.map(e => `⚠️ ${e}`),
        ...log,
      ],
    }

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[conciliaciones/procesar]', error)
    return NextResponse.json(
      { error: 'Error interno procesando la conciliación', detalle: String(error) },
      { status: 500 },
    )
  }
}
