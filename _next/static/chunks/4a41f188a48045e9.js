(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,86536,t=>{"use strict";let e=(0,t.i(75254).default)("eye",[["path",{d:"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",key:"1nclc0"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);t.s(["Eye",()=>e],86536)},40160,t=>{"use strict";let e=(0,t.i(75254).default)("download",[["path",{d:"M12 15V3",key:"m9g1x1"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["path",{d:"m7 10 5 5 5-5",key:"brsn70"}]]);t.s(["Download",()=>e],40160)},31278,t=>{"use strict";let e=(0,t.i(75254).default)("loader-circle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]]);t.s(["Loader2",()=>e],31278)},8112,t=>{"use strict";var e=t.i(43476),i=t.i(71645),a=t.i(40160),d=t.i(78583),o=t.i(25652),l=t.i(12426),r=t.i(1928),s=t.i(61911),n=t.i(86536),c=t.i(31278),p=t.i(38768);let g=t=>`COP $${Math.round(t).toLocaleString("es-CO")}`,x=(t,e,i)=>`
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #14B8A6;">
    <div>
      <div style="font-size:11px;color:#888;letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:4px;">J&amp;A CONTADORES - CONSULTORES</div>
      <h1 style="margin:0;font-size:26px;font-weight:900;color:#0B0E11;">${t}</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#555;">${e}</p>
    </div>
    <div style="text-align:right;">
      <div style="font-size:13px;font-weight:700;color:#0B0E11;">${i}</div>
      <div style="font-size:11px;color:#888;margin-top:4px;">Generado: ${new Date().toLocaleDateString("es-CO",{year:"numeric",month:"long",day:"numeric"})}</div>
      <div style="font-size:11px;color:#888;">${new Date().toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}</div>
    </div>
  </div>
`,h=()=>`
  <div style="margin-top:40px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:10px;color:#999;">
    <span>J&amp;A Contadores - Consultores — Informe generado autom\xe1ticamente desde datos reales</span>
    <span>P\xe1gina 1 de 1</span>
  </div>
`,f=`
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
`;function v(t,e=!0){let i=window.open("","_blank");i?(i.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">${f}<title>Informe J&A Contadores</title></head><body>${t}</body></html>`),i.document.close(),e&&(i.onload=()=>{i.focus(),i.print()},setTimeout(()=>{i.closed||(i.focus(),i.print())},800))):alert("Permite las ventanas emergentes para generar el informe.")}let u="#13213C",y="#B8960C",m="#1C2B45",b="#4B5563",$="#9CA3AF",k="#E5E7EB",C="#F8FAFC",w={background:"#FFFFFF",border:`1px solid ${k}`,borderRadius:"2px",boxShadow:"0 1px 2px rgba(0,0,0,0.05)",padding:"20px"};function j(){let{data:t,clientName:f,loading:j}=(0,p.useClient)(),[S,z]=(0,i.useState)("month"),[A,I]=(0,i.useState)(null);if(j||!t)return(0,e.jsxs)("div",{style:{padding:"32px",display:"flex",alignItems:"center",gap:"12px",color:b,fontSize:"14px"},children:[(0,e.jsx)("div",{style:{width:"16px",height:"16px",border:`2px solid ${k}`,borderTopColor:u,borderRadius:"50%",animation:"spin 1s linear infinite"}}),"Configurando centro de reportes...",(0,e.jsx)("style",{children:"@keyframes spin { to { transform: rotate(360deg); } }"})]});let F=(e,i)=>{I(e),setTimeout(()=>{let a=f||"Mi Empresa";1===e?function(t,e,i,a=!0){let d=t.salesHistory.slice(-20).map(t=>`
    <tr><td>${t.date}</td><td style="text-align:right;font-weight:600;">${g(t.amount)}</td></tr>
  `).join(""),o=t.recurringCustomers.map((t,e)=>`
    <tr>
      <td>${e+1}</td>
      <td style="font-weight:600;">${t.name}</td>
      <td style="text-align:center;">${t.count}</td>
      <td style="text-align:right;font-weight:700;color:#059669;">${g(t.total)}</td>
    </tr>
  `).join(""),l=t.topProducts.map((t,e)=>`
    <tr>
      <td>${e+1}</td>
      <td style="font-weight:600;">${t.name}</td>
      <td style="text-align:center;">${t.count}</td>
      <td style="text-align:right;font-weight:700;">${g(t.total)}</td>
    </tr>
  `).join("");v(`
    ${x("Reporte de Ventas",`Per\xedodo: ${"week"===i?"Semana actual":"month"===i?"Mes actual":"Año actual"}`,e)}

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Ventas Totales</div>
        <div class="kpi-value" style="font-size:15px;">${t.metrics.sales.value}</div>
        <div class="kpi-change-up">↑ ${t.metrics.sales.change}% vs per\xedodo anterior</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Facturas Emitidas</div>
        <div class="kpi-value">${t.metrics.productsSold.value}</div>
        <div class="kpi-change-up">↑ ${t.metrics.productsSold.change}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Clientes \xdanicos</div>
        <div class="kpi-value">${t.metrics.newClients.value}</div>
        <div class="kpi-change-up">↑ ${t.metrics.newClients.change}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Proyecci\xf3n 30 d\xedas</div>
        <div class="kpi-value" style="font-size:14px;">${g(t.prediction.nextMonth)}</div>
        <div class="kpi-change-up">Crecimiento: ${t.prediction.growthRate.toFixed(1)}%</div>
      </div>
    </div>

    <h2>Historial de Ventas (\xfaltimas 20 fechas)</h2>
    <table>
      <thead><tr><th>Fecha</th><th style="text-align:right;">Monto</th></tr></thead>
      <tbody>${d||'<tr><td colspan="2" style="text-align:center;color:#888;">Sin datos de historial</td></tr>'}</tbody>
    </table>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:8px;">
      <div>
        <h2>Top Clientes por Facturaci\xf3n</h2>
        <table>
          <thead><tr><th>#</th><th>Cliente</th><th style="text-align:center;">Facturas</th><th style="text-align:right;">Total</th></tr></thead>
          <tbody>${o||'<tr><td colspan="4" style="text-align:center;color:#888;">Sin datos</td></tr>'}</tbody>
        </table>
      </div>
      <div>
        <h2>Top Productos / Servicios</h2>
        <table>
          <thead><tr><th>#</th><th>Descripci\xf3n</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Total</th></tr></thead>
          <tbody>${l||'<tr><td colspan="4" style="text-align:center;color:#888;">Sin datos</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    ${h()}
  `,a)}(t,a,S,i):2===e?function(t,e,i=!0){let a=t.taxData,d=a.monthlyBreakdown.map(t=>`
    <tr>
      <td style="font-weight:600;">${t.month}</td>
      <td style="text-align:right;">${g(t.ventas)}</td>
      <td style="text-align:right;">${g(t.iva)}</td>
      <td style="text-align:right;">${g(t.reteFuente)}</td>
      <td style="text-align:right;">${g(t.reteICA)}</td>
      <td style="text-align:right;font-weight:700;color:#059669;">${g(t.neto)}</td>
    </tr>
  `).join("");v(`
    ${x("Estado Financiero","Resumen de resultados y cartera",e)}

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Ventas Brutas</div>
        <div class="kpi-value" style="font-size:14px;">${g(a.totalVentasBruto)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Impuestos Totales</div>
        <div class="kpi-value" style="font-size:14px;color:#dc2626;">${g(a.totalImpuestosCargo)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Cartera Total (Est.)</div>
        <div class="kpi-value" style="font-size:14px;">${t.portfolio.total}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Cartera Vencida</div>
        <div class="kpi-value" style="font-size:14px;color:#dc2626;">${t.metrics.overdue.value}</div>
      </div>
    </div>

    <h2>Estado de Cartera</h2>
    <table>
      <thead><tr><th>Categor\xeda</th><th style="text-align:right;">Valor</th><th style="text-align:right;">%</th><th>Estado</th></tr></thead>
      <tbody>
        <tr><td>Cartera Vigente</td><td style="text-align:right;">${t.portfolio.current.value}</td><td style="text-align:right;">${t.portfolio.current.percent}%</td><td><span class="badge badge-green">✓ Al d\xeda</span></td></tr>
        <tr><td>Por Vencer</td><td style="text-align:right;">${t.portfolio.dueSoon.value}</td><td style="text-align:right;">${t.portfolio.dueSoon.percent}%</td><td><span class="badge badge-yellow">⚠ Pr\xf3xima</span></td></tr>
        <tr><td>Cartera Vencida</td><td style="text-align:right;">${t.portfolio.overdue.value}</td><td style="text-align:right;">${t.portfolio.overdue.percent}%</td><td><span class="badge badge-red">✗ Vencida</span></td></tr>
      </tbody>
    </table>

    <h2>Desglose Mensual</h2>
    <table>
      <thead><tr><th>Mes</th><th style="text-align:right;">Ventas</th><th style="text-align:right;">IVA</th><th style="text-align:right;">ReteFuente</th><th style="text-align:right;">ReteICA</th><th style="text-align:right;">Neto</th></tr></thead>
      <tbody>${d||'<tr><td colspan="6" style="text-align:center;color:#888;">Sin datos mensuales</td></tr>'}</tbody>
    </table>

    <h2>Proyecci\xf3n Financiera</h2>
    <table>
      <thead><tr><th>Indicador</th><th style="text-align:right;">Valor</th></tr></thead>
      <tbody>
        <tr><td>Proyecci\xf3n ventas pr\xf3ximos 30 d\xedas</td><td style="text-align:right;font-weight:700;">${g(t.prediction.nextMonth)}</td></tr>
        <tr><td>Tasa de crecimiento estimada</td><td style="text-align:right;font-weight:700;">${t.prediction.growthRate.toFixed(2)}%</td></tr>
        <tr><td>Tasa efectiva tributaria</td><td style="text-align:right;font-weight:700;">${a.tasaEfectivaTributaria}%</td></tr>
        <tr><td>Base gravable renta estimada</td><td style="text-align:right;font-weight:700;">${g(a.baseGravableRenta)}</td></tr>
        <tr><td>Impuesto de renta estimado (35%)</td><td style="text-align:right;font-weight:700;color:#dc2626;">${g(a.impuestoRentaEstimado)}</td></tr>
      </tbody>
    </table>

    ${h()}
  `,i)}(t,a,i):3===e?function(t,e,i=!0){let a=t.recurringCustomers.map((t,e)=>`
    <tr>
      <td>${e+1}</td>
      <td style="font-weight:600;">${t.name}</td>
      <td style="text-align:center;">${t.count}</td>
      <td style="text-align:right;">${g(t.total)}</td>
      <td style="text-align:right;">${g(t.total/Math.max(t.count,1))}</td>
    </tr>
  `).join(""),d=t.metrics.sales.rawValue;v(`
    ${x("Análisis de Clientes","Segmentación y comportamiento de clientes",e)}

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Clientes \xdanicos</div>
        <div class="kpi-value">${t.metrics.newClients.value}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Clientes Recurrentes</div>
        <div class="kpi-value">${t.recurringCustomers.filter(t=>t.count>1).length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Facturaci\xf3n Total</div>
        <div class="kpi-value" style="font-size:14px;">${t.metrics.sales.value}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Ticket Promedio</div>
        <div class="kpi-value" style="font-size:14px;">${g(d/Math.max(t.metrics.productsSold.rawValue,1))}</div>
      </div>
    </div>

    <h2>Ranking de Clientes por Facturaci\xf3n</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Nombre / Raz\xf3n Social</th>
          <th style="text-align:center;">Facturas</th>
          <th style="text-align:right;">Total Facturado</th>
          <th style="text-align:right;">Ticket Promedio</th>
        </tr>
      </thead>
      <tbody>${a||'<tr><td colspan="5" style="text-align:center;color:#888;">Sin datos de clientes</td></tr>'}</tbody>
    </table>

    <h2>Actividad Reciente</h2>
    <table>
      <thead><tr><th>Fecha</th><th>Cliente</th><th>Tipo</th><th style="text-align:right;">Monto</th></tr></thead>
      <tbody>
        ${t.recentActivity.map(t=>`
          <tr>
            <td>${t.time}</td>
            <td style="font-weight:600;">${t.client}</td>
            <td>${t.text}</td>
            <td style="text-align:right;font-weight:700;color:#059669;">${t.amount}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    ${h()}
  `,i)}(t,a,i):4===e&&function(t,e,i=!0){let a=t.taxData,d=a.alertas.map(t=>`<div class="alert-box">${t}</div>`).join("");v(`
    ${x("Informe Tributario","Obligaciones fiscales estimadas — Ley Colombiana",e)}

    <div style="background:#fffbeb;border:2px solid #F0B90B;border-radius:8px;padding:10px 16px;margin-bottom:20px;font-size:11px;color:#78350f;">
      ⚠️ Este informe es una <strong>estimaci\xf3n referencial</strong>. Los valores no reemplazan una declaraci\xf3n oficial ante la DIAN. Cons\xfaltelo con su contador.
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Ventas Brutas</div>
        <div class="kpi-value" style="font-size:14px;">${g(a.totalVentasBruto)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">IVA Generado</div>
        <div class="kpi-value" style="font-size:14px;">${g(a.totalIVACobrado)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">IVA a Pagar (Est.)</div>
        <div class="kpi-value" style="font-size:14px;color:#dc2626;">${g(a.totalIVAPorPagar)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Tasa Efectiva</div>
        <div class="kpi-value">${a.tasaEfectivaTributaria}%</div>
      </div>
    </div>

    <h2>Resumen de Impuestos</h2>
    <table>
      <thead><tr><th>Impuesto</th><th>Base</th><th style="text-align:right;">Valor Estimado</th></tr></thead>
      <tbody>
        <tr><td>IVA Cobrado (19%)</td><td>Sobre ventas</td><td style="text-align:right;font-weight:700;">${g(a.totalIVACobrado)}</td></tr>
        <tr><td>IVA a Pagar (neto)</td><td>Cobrado - Descontable</td><td style="text-align:right;font-weight:700;color:#dc2626;">${g(a.totalIVAPorPagar)}</td></tr>
        <tr><td>Retenci\xf3n en la Fuente (3.5%)</td><td>Sobre ventas base</td><td style="text-align:right;font-weight:700;">${g(a.totalReteFuente)}</td></tr>
        <tr><td>ReteIVA (15%)</td><td>Sobre IVA</td><td style="text-align:right;font-weight:700;">${g(a.totalReteIVA)}</td></tr>
        <tr><td>ReteICA Bogot\xe1 (4.14‰)</td><td>Actividades comerciales</td><td style="text-align:right;font-weight:700;">${g(a.totalReteICA)}</td></tr>
        <tr style="background:#fff3cd;"><td style="font-weight:700;">Total Impuestos Cargo</td><td>—</td><td style="text-align:right;font-weight:900;color:#dc2626;">${g(a.totalImpuestosCargo)}</td></tr>
      </tbody>
    </table>

    <h2>Impuesto de Renta (Estimado)</h2>
    <table>
      <thead><tr><th>Concepto</th><th style="text-align:right;">Valor</th></tr></thead>
      <tbody>
        <tr><td>Base Gravable</td><td style="text-align:right;">${g(a.baseGravableRenta)}</td></tr>
        <tr><td>Impuesto de Renta estimado (35%)</td><td style="text-align:right;font-weight:700;color:#dc2626;">${g(a.impuestoRentaEstimado)}</td></tr>
        <tr><td>R\xe9gimen Sugerido</td><td style="text-align:right;font-weight:700;">${a.regimenSugerido}</td></tr>
      </tbody>
    </table>

    <h2>Declaraciones Peri\xf3dicas</h2>
    <table>
      <thead><tr><th>Tipo</th><th style="text-align:right;">Valor Estimado</th></tr></thead>
      <tbody>
        <tr><td>IVA Bimestral (promedio)</td><td style="text-align:right;font-weight:700;">${g(a.ivaDeclaracionBimestral)}</td></tr>
        <tr><td>IVA Cuatrimestral (promedio)</td><td style="text-align:right;font-weight:700;">${g(a.ivaDeclaracionCuatrimestral)}</td></tr>
        <tr><td>Total Facturas analizadas</td><td style="text-align:right;">${a.totalFacturas}</td></tr>
      </tbody>
    </table>

    ${a.alertas.length>0?`<h2>Alertas y Recomendaciones</h2>${d}`:""}

    ${h()}
  `,i)}(t,a,i),I(null)},100)},T=[{id:1,title:"Reporte de Ventas",description:"Análisis detallado de ventas, historial y top clientes por período operativo.",icon:r.ShoppingCart,color:u,dataPoints:`${t.metrics.productsSold.value} facturas`},{id:2,title:"Estado Financiero",description:"Resumen consolidado de cartera, liquidez y proyecciones de flujo de caja.",icon:l.DollarSign,color:u,dataPoints:`Salud: ${t.portfolio.current.percent}%`},{id:3,title:"Análisis de Clientes",description:"Segmentación estratégica y comportamiento de cuentas clave por volumen.",icon:s.Users,color:u,dataPoints:`${t.recurringCustomers.length} recurrentes`},{id:4,title:"Informe Tributario",description:"Estimaciones de IVA, retenciones y renta anual según normativa vigente DIAN.",icon:o.TrendingUp,color:y,dataPoints:"Carga Est. Calculada"}],R=[{label:"Facturación",value:t.metrics.sales.value,color:u,icon:l.DollarSign},{label:"Docs Emitidos",value:t.metrics.productsSold.value,color:u,icon:d.FileText},{label:"Nuevos Clientes",value:t.metrics.newClients.value,color:u,icon:s.Users},{label:"Cartera Crítica",value:t.portfolio.overdue.value,color:"#EF4444",icon:o.TrendingUp}];return(0,e.jsxs)("div",{style:{display:"flex",flexDirection:"column",gap:"24px",paddingBottom:"32px"},children:[(0,e.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-end",borderBottom:`1px solid ${k}`,paddingBottom:"20px"},children:[(0,e.jsxs)("div",{children:[(0,e.jsxs)("h1",{style:{fontSize:"20px",fontWeight:700,color:u,margin:0},children:["Centro de Reportes ",(0,e.jsx)("span",{style:{color:y},children:"Corporativos"})]}),(0,e.jsx)("p",{style:{fontSize:"12px",color:b,marginTop:"4px"},children:"Generación de informes de auditoría y estados financieros certificados"})]}),(0,e.jsx)("div",{style:{display:"flex",background:C,border:`1px solid ${k}`,padding:"4px",borderRadius:"2px"},children:[{id:"week",label:"Semana"},{id:"month",label:"Mensual"},{id:"year",label:"Anual"}].map(t=>(0,e.jsx)("button",{onClick:()=>z(t.id),style:{border:"none",padding:"4px 12px",fontSize:"10px",fontWeight:700,borderRadius:"1px",cursor:"pointer",transition:"all 0.2s",background:S===t.id?u:"transparent",color:S===t.id?"white":b},children:t.label},t.id))})]}),(0,e.jsx)("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:"16px"},children:R.map((t,i)=>(0,e.jsxs)("div",{style:{...w,borderLeft:`4px solid ${t.color}`},children:[(0,e.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"},children:[(0,e.jsx)("p",{style:{fontSize:"9px",fontWeight:700,color:b,textTransform:"uppercase",margin:0},children:t.label}),(0,e.jsx)(t.icon,{style:{width:"12px",height:"12px",color:t.color}})]}),(0,e.jsx)("p",{style:{fontSize:"16px",fontWeight:700,color:m,margin:0,fontFamily:"monospace"},children:t.value})]},i))}),(0,e.jsx)("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(400px, 1fr))",gap:"20px"},children:T.map(t=>{let i=t.icon,d=A===t.id;return(0,e.jsx)("div",{style:w,children:(0,e.jsxs)("div",{style:{display:"flex",gap:"20px"},children:[(0,e.jsx)("div",{style:{width:"40px",height:"40px",background:C,border:`1px solid ${k}`,borderRadius:"2px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},children:(0,e.jsx)(i,{style:{width:"20px",height:"20px",color:t.color}})}),(0,e.jsxs)("div",{style:{flex:1},children:[(0,e.jsx)("h3",{style:{fontSize:"14px",fontWeight:700,color:m,margin:"0 0 4px 0"},children:t.title}),(0,e.jsx)("p",{style:{fontSize:"11px",color:b,margin:"0 0 12px 0",lineHeight:1.5},children:t.description}),(0,e.jsxs)("div",{style:{display:"flex",gap:"8px",marginBottom:"16px"},children:[(0,e.jsx)("span",{style:{fontSize:"9px",fontWeight:700,padding:"2px 8px",background:C,color:u,borderRadius:"1px"},children:t.dataPoints}),(0,e.jsxs)("span",{style:{fontSize:"9px",color:$,alignSelf:"center"},children:["Ref: ",new Date().toLocaleDateString()]})]}),(0,e.jsxs)("div",{style:{display:"flex",gap:"12px"},children:[(0,e.jsxs)("button",{onClick:()=>F(t.id,!1),disabled:d,style:{flex:1,border:"none",background:u,color:"white",padding:"8px",borderRadius:"2px",fontSize:"11px",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"},children:[d?(0,e.jsx)(c.Loader2,{style:{width:"14px",height:"14px",animation:"spin 1s linear infinite"}}):(0,e.jsx)(n.Eye,{style:{width:"14px",height:"14px"}}),"VISTA PREVIA"]}),(0,e.jsxs)("button",{onClick:()=>F(t.id,!0),disabled:d,style:{flex:1,border:`1px solid ${k}`,background:"white",color:m,padding:"8px",borderRadius:"2px",fontSize:"11px",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"},children:[(0,e.jsx)(a.Download,{style:{width:"14px",height:"14px"}}),"PDF"]})]})]})]})},t.id)})}),(0,e.jsxs)("div",{style:w,children:[(0,e.jsx)("h3",{style:{fontSize:"13px",fontWeight:700,color:m,marginBottom:"20px"},children:"Historial de Transacciones Corporativas"}),(0,e.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"8px"},children:t.recentActivity.length>0?t.recentActivity.map((t,i)=>(0,e.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px",background:C,border:`1px solid ${k}`,borderRadius:"2px"},children:[(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"12px"},children:[(0,e.jsx)("div",{style:{width:"4px",height:"24px",background:u}}),(0,e.jsxs)("div",{children:[(0,e.jsx)("p",{style:{fontSize:"11px",fontWeight:600,color:m,margin:0},children:t.text}),(0,e.jsx)("p",{style:{fontSize:"10px",color:b,margin:0},children:t.client})]})]}),(0,e.jsxs)("div",{style:{textAlign:"right"},children:[(0,e.jsx)("p",{style:{fontSize:"11px",fontWeight:700,color:u,margin:0,fontFamily:"monospace"},children:t.amount}),(0,e.jsx)("p",{style:{fontSize:"10px",color:$,margin:0},children:t.time})]})]},i)):(0,e.jsx)("div",{style:{textAlign:"center",padding:"32px",color:$,fontSize:"12px"},children:"Sin registros operativos recientes"})})]}),(0,e.jsx)("style",{children:"@keyframes spin { to { transform: rotate(360deg); } }"})]})}t.s(["default",()=>j],8112)}]);