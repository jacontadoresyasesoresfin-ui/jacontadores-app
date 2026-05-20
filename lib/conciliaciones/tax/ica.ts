import type { FacturaElectronica, ResumenICA, ActividadICA } from '../models'
import { TARIFAS_ICA_BOGOTA, CIIU_EXCLUIDOS_ICA } from '../config'

function detectarTarifa(ciiu?: string): { key: string; nombre: string; tarifa: number } {
  if (!ciiu) return { key: 'servicios_generales', nombre: 'Demás servicios', tarifa: TARIFAS_ICA_BOGOTA.servicios_generales.tarifaPorMil }
  const p2 = ciiu.slice(0, 2)
  if (CIIU_EXCLUIDOS_ICA.includes(p2)) return { key: 'excluido', nombre: 'Excluido de ICA', tarifa: 0 }
  for (const [key, datos] of Object.entries(TARIFAS_ICA_BOGOTA)) {
    if (key === 'servicios_generales') continue
    if (datos.ciuuPrefijos.includes(p2) || datos.ciuuPrefijos.includes(ciiu.slice(0,3))) {
      return { key, nombre: datos.nombre, tarifa: datos.tarifaPorMil }
    }
  }
  return { key: 'servicios_generales', nombre: 'Demás servicios', tarifa: TARIFAS_ICA_BOGOTA.servicios_generales.tarifaPorMil }
}

export function calcularIca(
  facturas: FacturaElectronica[],
  nitEmpresa: string,
  periodo: string,
  municipio = 'Bogotá D.C.',
  ciuuPrincipal?: string,
): ResumenICA {
  const nit = nitEmpresa.replace(/\D/g,'')
  const acum: Record<string, { nombre: string; tarifa: number; base: number; n: number }> = {}
  let excluidos = 0

  for (const f of facturas) {
    if (f.nitEmisor.replace(/\D/g,'') !== nit) continue
    const signo = f.esNota ? -1 : 1
    const { key, nombre, tarifa } = detectarTarifa(ciuuPrincipal)
    if (key === 'excluido') { excluidos += f.subtotal * signo; continue }
    if (!acum[key]) acum[key] = { nombre, tarifa, base: 0, n: 0 }
    acum[key].base += f.subtotal * signo
    acum[key].n++
  }

  const actividades: ActividadICA[] = Object.entries(acum).map(([, d]) => ({
    ciiu: ciuuPrincipal ?? 'N/A',
    descripcion: d.nombre,
    municipio,
    tarifaPorMil: d.tarifa,
    baseGravable: d.base,
    impuestoEstimado: Math.round(d.base * d.tarifa / 1000),
    numFacturas: d.n,
  }))

  return {
    periodo, nitEmpresa, municipio, actividades,
    totalIngresosBrutos: actividades.reduce((s,a) => s+a.baseGravable,0) + excluidos,
    totalBaseGravable: actividades.reduce((s,a) => s+a.baseGravable,0),
    totalIngresosExcluidos: excluidos,
    totalImpuestoEstimado: actividades.reduce((s,a) => s+a.impuestoEstimado,0),
  }
}
