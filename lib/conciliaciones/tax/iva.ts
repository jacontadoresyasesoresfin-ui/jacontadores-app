import type { FacturaElectronica, ResumenIVA, LineaIVA } from '../models'

export function calcularIva(facturas: FacturaElectronica[], nitEmpresa: string, periodo: string): ResumenIVA {
  const nit = nitEmpresa.replace(/\D/g, '')
  const gen:  Record<string, { n: number; base: number; iva: number }> = {}
  const desc: Record<string, { n: number; base: number; iva: number }> = {}

  for (const f of facturas) {
    const signo = f.esNota ? -1 : 1
    const esEmitida = f.nitEmisor.replace(/\D/g,'') === nit
    const acum = esEmitida ? gen : desc

    for (const imp of f.impuestos) {
      if (imp.nombre.toUpperCase() !== 'IVA') continue
      const key = imp.tarifaPct > 0 ? String(Math.round(imp.tarifaPct)) : '0'
      if (!acum[key]) acum[key] = { n: 0, base: 0, iva: 0 }
      acum[key].n++
      acum[key].base += imp.baseGravable * signo
      acum[key].iva  += imp.valor * signo
    }

    if (f.impuestos.filter(i => i.nombre.toUpperCase() === 'IVA').length === 0) {
      const ivaTotal = f.impuestos.filter(i => i.nombre.toUpperCase() === 'IVA').reduce((s,i) => s+i.valor, 0)
      const key = ivaTotal > 0 ? '19' : 'excluido'
      if (!acum[key]) acum[key] = { n: 0, base: 0, iva: 0 }
      acum[key].n++
      acum[key].base += f.subtotal * signo
      acum[key].iva  += ivaTotal * signo
    }
  }

  const lineasGenerado: LineaIVA[] = Object.entries(gen).map(([t,d]) => ({
    tipo: 'generado', tarifa: t, numFacturas: d.n, baseGravable: d.base, valorIva: d.iva,
  }))
  const lineasDescontable: LineaIVA[] = Object.entries(desc).map(([t,d]) => ({
    tipo: 'descontable', tarifa: t, numFacturas: d.n, baseGravable: d.base, valorIva: d.iva,
  }))

  const totalIvaGenerado    = lineasGenerado.reduce((s,l) => s+l.valorIva, 0)
  const totalIvaDescontable = lineasDescontable.reduce((s,l) => s+l.valorIva, 0)
  const saldo = totalIvaGenerado - totalIvaDescontable

  return {
    periodo, nitEmpresa,
    lineasGenerado,
    totalBaseVentas: lineasGenerado.filter(l => !['excluido','exento'].includes(l.tarifa)).reduce((s,l) => s+l.baseGravable,0),
    totalIvaGenerado,
    lineasDescontable,
    totalBaseCompras: lineasDescontable.filter(l => !['excluido','exento'].includes(l.tarifa)).reduce((s,l) => s+l.baseGravable,0),
    totalIvaDescontable,
    saldoAPagar:    saldo >= 0 ? saldo : 0,
    saldoAFavor:    saldo <  0 ? Math.abs(saldo) : 0,
    ivaBimestral:   saldo >= 0 ? saldo / 3 : 0,
    ivaCuatrimestral: saldo >= 0 ? saldo / 2 : 0,
  }
}
