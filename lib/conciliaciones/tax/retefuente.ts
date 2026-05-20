/**
 * Motor Retefuente — Decreto 1625/2016 + Comunicado DIAN 070/2026.
 * UVT 2026: $52.374
 */
import type { FacturaElectronica, MovimientoSiigo, ResumenRetefuente, ConceptoRetefuente } from '../models'
import { CONCEPTOS_RETEFUENTE, UVT_2026 } from '../config'

function clasificarConcepto(desc: string): string {
  const d = desc.toLowerCase()
  for (const [key, cfg] of Object.entries(CONCEPTOS_RETEFUENTE)) {
    if (cfg.palabrasClave.some(kw => d.includes(kw))) return key
  }
  if (/arrend|arrient/.test(d))   return 'arrendamiento_inmuebles'
  if (/honor|consul|asesor/.test(d)) return 'honorarios_pj'
  if (/servicio|manten|soport/.test(d)) return 'servicios_generales'
  return 'compras_generales'
}

export function calcularRetefuente(
  facturas: FacturaElectronica[],
  siigo: MovimientoSiigo[],
  nitEmpresa: string,
  periodo: string,
): ResumenRetefuente {
  const nit = nitEmpresa.replace(/\D/g,'')
  const uvt = UVT_2026
  const acum: Record<string, { bp: number; vp: number; ntp: number; bs: number; vs: number; nts: number }> = {}

  const init = (key: string) => {
    if (!acum[key]) acum[key] = { bp: 0, vp: 0, ntp: 0, bs: 0, vs: 0, nts: 0 }
  }

  for (const f of facturas) {
    const signo = f.esNota ? -1 : 1
    const esEmitida = f.nitEmisor.replace(/\D/g,'') === nit
    for (const ret of f.retenciones) {
      const n = ret.nombre.toLowerCase()
      if (n.includes('ica') || (n.includes('iva') && n.includes('rete'))) continue
      // Determinar concepto por tarifa
      let concepto = 'compras_generales'
      for (const [key, cfg] of Object.entries(CONCEPTOS_RETEFUENTE)) {
        if (Math.abs(cfg.tarifa - ret.tarifaPct / 100) < 0.001) { concepto = key; break }
      }
      init(concepto)
      if (esEmitida) {
        acum[concepto].bs += ret.baseGravable * signo
        acum[concepto].vs += ret.valor * signo
        acum[concepto].nts++
      } else {
        acum[concepto].bp += ret.baseGravable * signo
        acum[concepto].vp += ret.valor * signo
        acum[concepto].ntp++
      }
    }
  }

  for (const s of siigo) {
    if (!s.retefuente || s.retefuente === 0) continue
    const clave = clasificarConcepto(s.descripcion ?? '')
    init(clave)
    if (['cxp','movimiento'].includes(s.tipoExportacion)) {
      acum[clave].bp += s.monto; acum[clave].vp += s.retefuente; acum[clave].ntp++
    } else {
      acum[clave].bs += s.monto; acum[clave].vs += s.retefuente; acum[clave].nts++
    }
  }

  const conceptos: ConceptoRetefuente[] = Object.entries(acum)
    .filter(([, d]) => d.vp > 0 || d.vs > 0)
    .map(([key, d]) => {
      const cfg = CONCEPTOS_RETEFUENTE[key] ?? CONCEPTOS_RETEFUENTE.sin_retencion
      return {
        codigoConcepto: cfg.codigoFormato1001,
        nombre: cfg.nombre,
        tarifaPct: cfg.tarifa * 100,
        baseMinimaUvt: cfg.baseUvt,
        baseMinimaCop: cfg.baseUvt * uvt,
        basePracticada: d.bp, valorPracticado: d.vp, numTransPracticadas: d.ntp,
        baseSufrida: d.bs,    valorSufrido:    d.vs, numTransSufridas:    d.nts,
      }
    })

  const totalPracticado = conceptos.reduce((s,c) => s+c.valorPracticado, 0)
  const totalSufrido    = conceptos.reduce((s,c) => s+c.valorSufrido,    0)

  return {
    periodo, nitEmpresa,
    uvtVigente: uvt,
    conceptos,
    totalPracticado,
    totalSufrido,
    saldoNeto: totalPracticado - totalSufrido,
  }
}
