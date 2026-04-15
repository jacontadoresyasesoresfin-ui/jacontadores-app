import { ClientData } from './data-service'

const COP = (n: number) => `COP $${Math.round(n).toLocaleString('es-CO')}`

const HEADER = (title: string, subtitle: string, clientName: string) => `
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #14B8A6;">
    <div>
      <div style="font-size:11px;color:#888;letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:4px;">J&amp;A CONTADORES - CONSULTORES</div>
      <h1 style="margin:0;font-size:26px;font-weight:900;color:#0B0E11;">${title}</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#555;">${subtitle}</p>
    </div>
    <div style="text-align:right;">
      <div style="font-size:13px;font-weight:700;color:#0B0E11;">${clientName}</div>
      <div style="font-size:11px;color:#888;margin-top:4px;">Generado: ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      <div style="font-size:11px;color:#888;">${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>
`

const FOOTER = () => `
  <div style="margin-top:40px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:10px;color:#999;">
    <span>J&amp;A Contadores - Consultores — Informe generado automáticamente desde datos reales</span>
    <span>Página 1 de 1</span>
  </div>
`

const BASE_STYLES = `
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #222; background: #fff; padding: 32px 40px; }
    h2 { font-size: 16px; font-weight: 800; color: #0B0E11; margin: 24px 0 12px; letter-spacing: -0.3px; }
    h3 { font-size: 13px; font-weight: 700; color: #444; margin: 16px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #0B2447; color: #FFFFFF; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; }
    td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; color: #333; font-size: 12px; }
    tr:nth-child(even) td { background: #fafafa; }
    .badge { display:inline-block; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:700; }
    .badge-green { background:#d1fae5; color:#065f46; }
    .badge-yellow { background:#fef3c7; color:#92400e; }
    .badge-red { background:#fee2e2; color:#991b1b; }
    .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
    .kpi-card { background:#f8f8f8; border:1px solid #e8e8e8; border-radius:8px; padding:14px 16px; }
    .kpi-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:4px; }
    .kpi-value { font-size:18px; font-weight:900; color:#0B0E11; }
    .kpi-change-up { font-size:11px; color:#059669; font-weight:600; margin-top:4px; }
    .kpi-change-down { font-size:11px; color:#dc2626; font-weight:600; margin-top:4px; }
    .alert-box { background:#fffbeb; border:1px solid #fcd34d; border-radius:6px; padding:10px 14px; margin:4px 0; font-size:12px; color:#78350f; }
    @media print {
      body { padding: 20px 28px; }
      @page { margin: 1cm; }
    }
  </style>
`

function openReport(htmlBody: string, autoprint = true) {
    const win = window.open('', '_blank')
    if (!win) { alert('Permite las ventanas emergentes para generar el informe.'); return }
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">${BASE_STYLES}<title>Informe J&A Contadores</title></head><body>${htmlBody}</body></html>`)
    win.document.close()
    if (autoprint) {
        win.onload = () => { win.focus(); win.print() }
        setTimeout(() => { if (!win.closed) { win.focus(); win.print() } }, 800)
    }
}

// ─────────────────────────────────────────────────────────
// 1. REPORTE DE VENTAS
// ─────────────────────────────────────────────────────────
export function printSalesReport(data: ClientData, clientName: string, period: string, autoprint = true) {
    const periodLabel = period === 'week' ? 'Semana actual' : period === 'month' ? 'Mes actual' : 'Año actual'

    const historyRows = data.salesHistory.slice(-20).map(h => `
    <tr><td>${h.date}</td><td style="text-align:right;font-weight:600;">${COP(h.amount)}</td></tr>
  `).join('')

    const topClientRows = data.recurringCustomers.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight:600;">${c.name}</td>
      <td style="text-align:center;">${c.count}</td>
      <td style="text-align:right;font-weight:700;color:#059669;">${COP(c.total)}</td>
    </tr>
  `).join('')

    const topProductRows = data.topProducts.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight:600;">${p.name}</td>
      <td style="text-align:center;">${p.count}</td>
      <td style="text-align:right;font-weight:700;">${COP(p.total)}</td>
    </tr>
  `).join('')

    const html = `
    ${HEADER('Reporte de Ventas', `Período: ${periodLabel}`, clientName)}

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Ventas Totales</div>
        <div class="kpi-value" style="font-size:15px;">${data.metrics.sales.value}</div>
        <div class="kpi-change-up">↑ ${data.metrics.sales.change}% vs período anterior</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Facturas Emitidas</div>
        <div class="kpi-value">${data.metrics.productsSold.value}</div>
        <div class="kpi-change-up">↑ ${data.metrics.productsSold.change}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Clientes Únicos</div>
        <div class="kpi-value">${data.metrics.newClients.value}</div>
        <div class="kpi-change-up">↑ ${data.metrics.newClients.change}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Proyección 30 días</div>
        <div class="kpi-value" style="font-size:14px;">${COP(data.prediction.nextMonth)}</div>
        <div class="kpi-change-up">Crecimiento: ${data.prediction.growthRate.toFixed(1)}%</div>
      </div>
    </div>

    <h2>Historial de Ventas (últimas 20 fechas)</h2>
    <table>
      <thead><tr><th>Fecha</th><th style="text-align:right;">Monto</th></tr></thead>
      <tbody>${historyRows || '<tr><td colspan="2" style="text-align:center;color:#888;">Sin datos de historial</td></tr>'}</tbody>
    </table>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:8px;">
      <div>
        <h2>Top Clientes por Facturación</h2>
        <table>
          <thead><tr><th>#</th><th>Cliente</th><th style="text-align:center;">Facturas</th><th style="text-align:right;">Total</th></tr></thead>
          <tbody>${topClientRows || '<tr><td colspan="4" style="text-align:center;color:#888;">Sin datos</td></tr>'}</tbody>
        </table>
      </div>
      <div>
        <h2>Top Productos / Servicios</h2>
        <table>
          <thead><tr><th>#</th><th>Descripción</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Total</th></tr></thead>
          <tbody>${topProductRows || '<tr><td colspan="4" style="text-align:center;color:#888;">Sin datos</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    ${FOOTER()}
  `
    openReport(html, autoprint)
}

// ─────────────────────────────────────────────────────────
// 2. REPORTE FINANCIERO
// ─────────────────────────────────────────────────────────
export function printFinancialReport(data: ClientData, clientName: string, autoprint = true) {
    const t = data.taxData

    const monthlyRows = t.monthlyBreakdown.map(m => `
    <tr>
      <td style="font-weight:600;">${m.month}</td>
      <td style="text-align:right;">${COP(m.ventas)}</td>
      <td style="text-align:right;">${COP(m.iva)}</td>
      <td style="text-align:right;">${COP(m.reteFuente)}</td>
      <td style="text-align:right;">${COP(m.reteICA)}</td>
      <td style="text-align:right;font-weight:700;color:#059669;">${COP(m.neto)}</td>
    </tr>
  `).join('')

    const html = `
    ${HEADER('Estado Financiero', 'Resumen de resultados y cartera', clientName)}

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Ventas Brutas</div>
        <div class="kpi-value" style="font-size:14px;">${COP(t.totalVentasBruto)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Impuestos Totales</div>
        <div class="kpi-value" style="font-size:14px;color:#dc2626;">${COP(t.totalImpuestosCargo)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Cartera Total (Est.)</div>
        <div class="kpi-value" style="font-size:14px;">${data.portfolio.total}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Cartera Vencida</div>
        <div class="kpi-value" style="font-size:14px;color:#dc2626;">${data.metrics.overdue.value}</div>
      </div>
    </div>

    <h2>Estado de Cartera</h2>
    <table>
      <thead><tr><th>Categoría</th><th style="text-align:right;">Valor</th><th style="text-align:right;">%</th><th>Estado</th></tr></thead>
      <tbody>
        <tr><td>Cartera Vigente</td><td style="text-align:right;">${data.portfolio.current.value}</td><td style="text-align:right;">${data.portfolio.current.percent}%</td><td><span class="badge badge-green">✓ Al día</span></td></tr>
        <tr><td>Por Vencer</td><td style="text-align:right;">${data.portfolio.dueSoon.value}</td><td style="text-align:right;">${data.portfolio.dueSoon.percent}%</td><td><span class="badge badge-yellow">⚠ Próxima</span></td></tr>
        <tr><td>Cartera Vencida</td><td style="text-align:right;">${data.portfolio.overdue.value}</td><td style="text-align:right;">${data.portfolio.overdue.percent}%</td><td><span class="badge badge-red">✗ Vencida</span></td></tr>
      </tbody>
    </table>

    <h2>Desglose Mensual</h2>
    <table>
      <thead><tr><th>Mes</th><th style="text-align:right;">Ventas</th><th style="text-align:right;">IVA</th><th style="text-align:right;">ReteFuente</th><th style="text-align:right;">ReteICA</th><th style="text-align:right;">Neto</th></tr></thead>
      <tbody>${monthlyRows || '<tr><td colspan="6" style="text-align:center;color:#888;">Sin datos mensuales</td></tr>'}</tbody>
    </table>

    <h2>Proyección Financiera</h2>
    <table>
      <thead><tr><th>Indicador</th><th style="text-align:right;">Valor</th></tr></thead>
      <tbody>
        <tr><td>Proyección ventas próximos 30 días</td><td style="text-align:right;font-weight:700;">${COP(data.prediction.nextMonth)}</td></tr>
        <tr><td>Tasa de crecimiento estimada</td><td style="text-align:right;font-weight:700;">${data.prediction.growthRate.toFixed(2)}%</td></tr>
        <tr><td>Tasa efectiva tributaria</td><td style="text-align:right;font-weight:700;">${t.tasaEfectivaTributaria}%</td></tr>
        <tr><td>Base gravable renta estimada</td><td style="text-align:right;font-weight:700;">${COP(t.baseGravableRenta)}</td></tr>
        <tr><td>Impuesto de renta estimado (35%)</td><td style="text-align:right;font-weight:700;color:#dc2626;">${COP(t.impuestoRentaEstimado)}</td></tr>
      </tbody>
    </table>

    ${FOOTER()}
  `
    openReport(html, autoprint)
}

// ─────────────────────────────────────────────────────────
// 3. ANÁLISIS DE CLIENTES
// ─────────────────────────────────────────────────────────
export function printClientsReport(data: ClientData, clientName: string, autoprint = true) {
    const clientRows = data.recurringCustomers.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight:600;">${c.name}</td>
      <td style="text-align:center;">${c.count}</td>
      <td style="text-align:right;">${COP(c.total)}</td>
      <td style="text-align:right;">${COP(c.total / Math.max(c.count, 1))}</td>
    </tr>
  `).join('')

    const totalRevenue = data.metrics.sales.rawValue

    const html = `
    ${HEADER('Análisis de Clientes', 'Segmentación y comportamiento de clientes', clientName)}

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Clientes Únicos</div>
        <div class="kpi-value">${data.metrics.newClients.value}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Clientes Recurrentes</div>
        <div class="kpi-value">${data.recurringCustomers.filter(c => c.count > 1).length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Facturación Total</div>
        <div class="kpi-value" style="font-size:14px;">${data.metrics.sales.value}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Ticket Promedio</div>
        <div class="kpi-value" style="font-size:14px;">${COP(totalRevenue / Math.max(data.metrics.productsSold.rawValue, 1))}</div>
      </div>
    </div>

    <h2>Ranking de Clientes por Facturación</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Nombre / Razón Social</th>
          <th style="text-align:center;">Facturas</th>
          <th style="text-align:right;">Total Facturado</th>
          <th style="text-align:right;">Ticket Promedio</th>
        </tr>
      </thead>
      <tbody>${clientRows || '<tr><td colspan="5" style="text-align:center;color:#888;">Sin datos de clientes</td></tr>'}</tbody>
    </table>

    <h2>Actividad Reciente</h2>
    <table>
      <thead><tr><th>Fecha</th><th>Cliente</th><th>Tipo</th><th style="text-align:right;">Monto</th></tr></thead>
      <tbody>
        ${data.recentActivity.map(a => `
          <tr>
            <td>${a.time}</td>
            <td style="font-weight:600;">${a.client}</td>
            <td>${a.text}</td>
            <td style="text-align:right;font-weight:700;color:#059669;">${a.amount}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    ${FOOTER()}
  `
    openReport(html, autoprint)
}

// ─────────────────────────────────────────────────────────
// 4. TENDENCIAS / IMPUESTOS
// ─────────────────────────────────────────────────────────
export function printTaxReport(data: ClientData, clientName: string, autoprint = true) {
    const t = data.taxData

    const alertRows = t.alertas.map(a => `<div class="alert-box">${a}</div>`).join('')

    const html = `
    ${HEADER('Informe Tributario', 'Obligaciones fiscales estimadas — Ley Colombiana', clientName)}

    <div style="background:#fffbeb;border:2px solid #F0B90B;border-radius:8px;padding:10px 16px;margin-bottom:20px;font-size:11px;color:#78350f;">
      ⚠️ Este informe es una <strong>estimación referencial</strong>. Los valores no reemplazan una declaración oficial ante la DIAN. Consúltelo con su contador.
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Ventas Brutas</div>
        <div class="kpi-value" style="font-size:14px;">${COP(t.totalVentasBruto)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">IVA Generado</div>
        <div class="kpi-value" style="font-size:14px;">${COP(t.totalIVACobrado)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">IVA a Pagar (Est.)</div>
        <div class="kpi-value" style="font-size:14px;color:#dc2626;">${COP(t.totalIVAPorPagar)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Tasa Efectiva</div>
        <div class="kpi-value">${t.tasaEfectivaTributaria}%</div>
      </div>
    </div>

    <h2>Resumen de Impuestos</h2>
    <table>
      <thead><tr><th>Impuesto</th><th>Base</th><th style="text-align:right;">Valor Estimado</th></tr></thead>
      <tbody>
        <tr><td>IVA Cobrado (19%)</td><td>Sobre ventas</td><td style="text-align:right;font-weight:700;">${COP(t.totalIVACobrado)}</td></tr>
        <tr><td>IVA a Pagar (neto)</td><td>Cobrado - Descontable</td><td style="text-align:right;font-weight:700;color:#dc2626;">${COP(t.totalIVAPorPagar)}</td></tr>
        <tr><td>Retención en la Fuente (3.5%)</td><td>Sobre ventas base</td><td style="text-align:right;font-weight:700;">${COP(t.totalReteFuente)}</td></tr>
        <tr><td>ReteIVA (15%)</td><td>Sobre IVA</td><td style="text-align:right;font-weight:700;">${COP(t.totalReteIVA)}</td></tr>
        <tr><td>ReteICA Bogotá (4.14‰)</td><td>Actividades comerciales</td><td style="text-align:right;font-weight:700;">${COP(t.totalReteICA)}</td></tr>
        <tr style="background:#fff3cd;"><td style="font-weight:700;">Total Impuestos Cargo</td><td>—</td><td style="text-align:right;font-weight:900;color:#dc2626;">${COP(t.totalImpuestosCargo)}</td></tr>
      </tbody>
    </table>

    <h2>Impuesto de Renta (Estimado)</h2>
    <table>
      <thead><tr><th>Concepto</th><th style="text-align:right;">Valor</th></tr></thead>
      <tbody>
        <tr><td>Base Gravable</td><td style="text-align:right;">${COP(t.baseGravableRenta)}</td></tr>
        <tr><td>Impuesto de Renta estimado (35%)</td><td style="text-align:right;font-weight:700;color:#dc2626;">${COP(t.impuestoRentaEstimado)}</td></tr>
        <tr><td>Régimen Sugerido</td><td style="text-align:right;font-weight:700;">${t.regimenSugerido}</td></tr>
      </tbody>
    </table>

    <h2>Declaraciones Periódicas</h2>
    <table>
      <thead><tr><th>Tipo</th><th style="text-align:right;">Valor Estimado</th></tr></thead>
      <tbody>
        <tr><td>IVA Bimestral (promedio)</td><td style="text-align:right;font-weight:700;">${COP(t.ivaDeclaracionBimestral)}</td></tr>
        <tr><td>IVA Cuatrimestral (promedio)</td><td style="text-align:right;font-weight:700;">${COP(t.ivaDeclaracionCuatrimestral)}</td></tr>
        <tr><td>Total Facturas analizadas</td><td style="text-align:right;">${t.totalFacturas}</td></tr>
      </tbody>
    </table>

    ${t.alertas.length > 0 ? `<h2>Alertas y Recomendaciones</h2>${alertRows}` : ''}

    ${FOOTER()}
  `
    openReport(html, autoprint)
}
