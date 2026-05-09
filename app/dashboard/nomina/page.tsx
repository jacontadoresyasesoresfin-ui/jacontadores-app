'use client'

import { useState, useMemo } from 'react'
import { Users, Calculator, Download, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { exportToExcel } from '@/utils/export'

const JA = {
    NAVY:    '#13213C', GOLD:    '#B8960C', GOLD_PALE: '#F5E9C0',
    TEXT:    '#1C2B45', GREY:    '#4B5563', GREY_LT: '#9CA3AF',
    BORDER:  '#E5E7EB', BG:      '#F8FAFC',
    GREEN:   '#10B981', RED:     '#EF4444', ORANGE: '#F59E0B', TEAL: '#0D9488',
} as const

const CARD: React.CSSProperties = {
    background: '#FFF', border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}

const SMMLV_2026   = 1_423_500
const AUXILIO_2026 =   200_000

const ARL_RATES: Record<string, { label: string; rate: number }> = {
    'I':   { label: 'Riesgo I — Oficinas / administrativo',  rate: 0.00522 },
    'II':  { label: 'Riesgo II — Bodegas / comercio',        rate: 0.01044 },
    'III': { label: 'Riesgo III — Manufactura media',        rate: 0.02436 },
    'IV':  { label: 'Riesgo IV — Construcción / minería',    rate: 0.04350 },
    'V':   { label: 'Riesgo V — Petróleo / explosivos',      rate: 0.06960 },
}

function fmtCOP(n: number) {
    return `$${Math.round(n).toLocaleString('es-CO')}`
}

function calcNomina(salario: number, riesgo: string, excento: boolean) {
    /* IBC: base de cotización */
    const ibc = salario

    /* ── Deducciones empleado ── */
    const saludEmp   = ibc * 0.04
    const pensionEmp = ibc * 0.04

    /* ── Aportes empleador ── */
    const saludPat   = ibc * 0.085
    const pensionPat = ibc * 0.12
    const arl        = ibc * (ARL_RATES[riesgo]?.rate || 0.00522)
    const caja       = ibc * 0.04
    const sena       = excento ? 0 : ibc * 0.02
    const icbf       = excento ? 0 : ibc * 0.03

    /* ── Prestaciones sociales (provisión mensual) ── */
    const cesantias     = salario * 0.0833
    const intCesantias  = cesantias * 0.01   // 1% mensual ≈ 12% anual
    const prima         = salario * 0.0833
    const vacaciones    = salario * 0.0417

    /* Auxilio de transporte (si salario ≤ 2 SMMLV) */
    const auxTransporte = salario <= SMMLV_2026 * 2 ? AUXILIO_2026 : 0

    /* ── Totales ── */
    const totalDeduccEmp = saludEmp + pensionEmp
    const salarioNeto    = salario + auxTransporte - totalDeduccEmp
    const totalPatronal  = saludPat + pensionPat + arl + caja + sena + icbf
    const totalPrestaciones = cesantias + intCesantias + prima + vacaciones
    const costoTotalMes  = salario + auxTransporte + totalPatronal + totalPrestaciones

    return {
        ibc, salario, auxTransporte,
        /* empleado */
        saludEmp, pensionEmp, totalDeduccEmp, salarioNeto,
        /* empleador */
        saludPat, pensionPat, arl, caja, sena, icbf, totalPatronal,
        /* prestaciones */
        cesantias, intCesantias, prima, vacaciones, totalPrestaciones,
        /* globales */
        costoTotalMes,
    }
}

export default function NominaPage() {
    const [salario, setSalario]     = useState(2_500_000)
    const [riesgo,  setRiesgo]      = useState('I')
    const [excento, setExcento]     = useState(false)
    const [empleados, setEmpleados] = useState(1)

    const nom = useMemo(() => calcNomina(salario, riesgo, excento), [salario, riesgo, excento])

    const handleExport = () => {
        const rows = [{
            'Salario Base':              nom.salario,
            'Auxilio Transporte':        nom.auxTransporte,
            'IBC':                       nom.ibc,
            'Salud Empleado (4%)':       nom.saludEmp,
            'Pensión Empleado (4%)':     nom.pensionEmp,
            'Salario Neto Empleado':     nom.salarioNeto,
            'Salud Empleador (8.5%)':    nom.saludPat,
            'Pensión Empleador (12%)':   nom.pensionPat,
            'ARL':                       nom.arl,
            'Caja Compensación (4%)':    nom.caja,
            'SENA (2%)':                 nom.sena,
            'ICBF (3%)':                 nom.icbf,
            'Total Aportes Patronales':  nom.totalPatronal,
            'Cesantías (8.33%)':         nom.cesantias,
            'Int. Cesantías (1%)':       nom.intCesantias,
            'Prima (8.33%)':             nom.prima,
            'Vacaciones (4.17%)':        nom.vacaciones,
            'Total Prestaciones':        nom.totalPrestaciones,
            'Costo Total Empleador/mes': nom.costoTotalMes,
            'Nº Empleados':              empleados,
            'Costo Total Nómina':        nom.costoTotalMes * empleados,
        }]
        exportToExcel(rows, `Nomina_PILA_${new Date().toISOString().slice(0, 10)}`)
    }

    const pct = (val: number, base: number) => base > 0 ? ((val / base) * 100).toFixed(1) + '%' : '—'

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '32px', fontFamily: 'Inter, sans-serif' }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '18px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 900, color: JA.NAVY, margin: 0, letterSpacing: '-0.02em' }}>
                        Liquidador <span style={{ color: JA.GOLD }}>Nómina PILA</span>
                    </h1>
                    <p style={{ fontSize: '11px', color: JA.GREY, margin: '4px 0 0' }}>
                        Cálculo automático de aportes, parafiscales y prestaciones sociales · SMMLV 2026: {fmtCOP(SMMLV_2026)}
                    </p>
                </div>
                <button onClick={handleExport}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: JA.NAVY, color: '#FFF', border: 'none', borderRadius: '2px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                    <Download style={{ width: 12, height: 12 }} /> Exportar Excel
                </button>
            </div>

            {/* ── Input Panel ── */}
            <div style={{ ...CARD, padding: '20px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: '0 0 16px' }}>Parámetros del Empleado</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>

                    {/* Salario */}
                    <div>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                            Salario Mensual (COP)
                        </label>
                        <input type="number" value={salario} min={SMMLV_2026}
                            onChange={e => setSalario(Math.max(SMMLV_2026, Number(e.target.value)))}
                            style={{ width: '100%', padding: '8px 12px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '13px', fontWeight: 700, color: JA.NAVY, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                        <p style={{ fontSize: '9px', color: JA.GREY_LT, margin: '4px 0 0' }}>
                            Mín. SMMLV: {fmtCOP(SMMLV_2026)}
                        </p>
                    </div>

                    {/* ARL Riesgo */}
                    <div>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                            Nivel de Riesgo ARL
                        </label>
                        <select value={riesgo} onChange={e => setRiesgo(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '12px', color: JA.TEXT, background: '#FFF', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}>
                            {Object.entries(ARL_RATES).map(([k, v]) => (
                                <option key={k} value={k}>Nivel {k} — {(v.rate * 100).toFixed(3)}% · {v.label.split('—')[1].trim()}</option>
                            ))}
                        </select>
                    </div>

                    {/* Nº empleados */}
                    <div>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                            Nº de Empleados (costo total)
                        </label>
                        <input type="number" value={empleados} min={1}
                            onChange={e => setEmpleados(Math.max(1, Number(e.target.value)))}
                            style={{ width: '100%', padding: '8px 12px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '13px', fontWeight: 700, color: JA.NAVY, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                    </div>

                    {/* Exento parafiscales */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                            Exento SENA + ICBF
                        </label>
                        <button onClick={() => setExcento(!excento)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: `1px solid ${excento ? JA.GREEN : JA.BORDER}`, borderRadius: '2px', background: excento ? '#F0FDF4' : '#FFF', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: excento ? JA.GREEN : JA.GREY }}>
                            <div style={{ width: 14, height: 14, borderRadius: '2px', background: excento ? JA.GREEN : JA.BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {excento && <span style={{ color: '#FFF', fontSize: '10px', lineHeight: 1 }}>✓</span>}
                            </div>
                            {excento ? 'Empresa exenta (≤10 SMMLV)' : 'Empresa no exenta'}
                        </button>
                    </div>
                </div>

                {salario <= SMMLV_2026 * 2 && (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#FFFBEB', border: `1px solid #FDE68A`, borderRadius: '2px' }}>
                        <Info style={{ width: 12, height: 12, color: JA.ORANGE, flexShrink: 0 }} />
                        <p style={{ fontSize: '10px', color: JA.ORANGE, margin: 0, fontWeight: 600 }}>
                            Aplica Auxilio de Transporte: {fmtCOP(AUXILIO_2026)}/mes (salario ≤ 2 SMMLV)
                        </p>
                    </div>
                )}
            </div>

            {/* ── KPIs Summary ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                {[
                    { label: 'Costo Total Empleador',  value: fmtCOP(nom.costoTotalMes),           color: JA.RED,    bg: '#FEF2F2', icon: '💼' },
                    { label: 'Salario Neto Empleado',  value: fmtCOP(nom.salarioNeto),              color: JA.GREEN,  bg: '#F0FDF4', icon: '💵' },
                    { label: 'Total Aportes PILA',     value: fmtCOP(nom.totalPatronal + nom.saludEmp + nom.pensionEmp), color: JA.NAVY, bg: '#EEF2F8', icon: '🏥' },
                    { label: 'Prestaciones/mes',       value: fmtCOP(nom.totalPrestaciones),        color: JA.GOLD,   bg: JA.GOLD_PALE, icon: '📋' },
                    { label: `Costo Nómina (${empleados} emp.)`, value: fmtCOP(nom.costoTotalMes * empleados), color: JA.TEAL, bg: '#F0FDFA', icon: '👥' },
                ].map(({ label, value, color, bg, icon }, i) => (
                    <div key={i} style={{ ...CARD, padding: '15px 18px' }}>
                        <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>{label}</p>
                        <p style={{ fontSize: '9px', margin: '0 0 4px' }}>{icon}</p>
                        <p style={{ fontSize: '16px', fontWeight: 800, color, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                    </div>
                ))}
            </div>

            {/* ── Breakdown Tables ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* Deducciones + Aportes */}
                <div style={CARD}>
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${JA.BG}` }}>
                        <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Seguridad Social PILA</h3>
                        <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: '2px 0 0' }}>Salud · Pensión · ARL · Parafiscales</p>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                            <tr style={{ background: JA.BG }}>
                                {['Concepto', 'Tasa', 'Valor', 'Quien'].map(h => (
                                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { concepto: 'Salud',               tasa: '4.0%',    valor: nom.saludEmp,   quien: 'Empleado',  color: JA.TEAL   },
                                { concepto: 'Pensión',             tasa: '4.0%',    valor: nom.pensionEmp, quien: 'Empleado',  color: JA.TEAL   },
                                { concepto: 'Salud EPS',           tasa: '8.5%',    valor: nom.saludPat,   quien: 'Empleador', color: JA.NAVY   },
                                { concepto: 'Pensión AFP',         tasa: '12.0%',   valor: nom.pensionPat, quien: 'Empleador', color: JA.NAVY   },
                                { concepto: `ARL Nivel ${riesgo}`, tasa: (ARL_RATES[riesgo].rate*100).toFixed(3)+'%', valor: nom.arl, quien: 'Empleador', color: JA.ORANGE },
                                { concepto: 'Caja Compensación',   tasa: '4.0%',    valor: nom.caja,       quien: 'Empleador', color: JA.TEAL   },
                                { concepto: 'SENA',                tasa: excento ? 'EXCENTO' : '2.0%', valor: nom.sena, quien: 'Empleador', color: excento ? JA.GREY_LT : JA.GREEN },
                                { concepto: 'ICBF',                tasa: excento ? 'EXCENTO' : '3.0%', valor: nom.icbf, quien: 'Empleador', color: excento ? JA.GREY_LT : JA.GREEN },
                            ].map(({ concepto, tasa, valor, quien, color }, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${JA.BG}` }}>
                                    <td style={{ padding: '9px 14px', fontWeight: 600, color: JA.TEXT }}>{concepto}</td>
                                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', color, fontWeight: 700 }}>{tasa}</td>
                                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: JA.TEXT, fontWeight: 700 }}>{fmtCOP(valor)}</td>
                                    <td style={{ padding: '9px 14px' }}>
                                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '1px', background: quien === 'Empleado' ? '#EEF2F8' : '#F0FDF4', color: quien === 'Empleado' ? JA.NAVY : JA.GREEN }}>
                                            {quien}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: JA.BG, borderTop: `2px solid ${JA.BORDER}` }}>
                                <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 800, color: JA.NAVY, fontSize: '11px' }}>Total Aportes Patronales</td>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, color: JA.RED, fontSize: '12px' }}>{fmtCOP(nom.totalPatronal)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Prestaciones + Liquidación */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={CARD}>
                        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${JA.BG}` }}>
                            <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Prestaciones Sociales (provisión mensual)</h3>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                            <tbody>
                                {[
                                    { concepto: 'Cesantías',             tasa: '8.33%',  valor: nom.cesantias    },
                                    { concepto: 'Intereses Cesantías',   tasa: '1.0%',   valor: nom.intCesantias },
                                    { concepto: 'Prima de Servicios',    tasa: '8.33%',  valor: nom.prima        },
                                    { concepto: 'Vacaciones',            tasa: '4.17%',  valor: nom.vacaciones   },
                                ].map(({ concepto, tasa, valor }, i) => (
                                    <tr key={i} style={{ borderBottom: `1px solid ${JA.BG}` }}>
                                        <td style={{ padding: '9px 14px', fontWeight: 600, color: JA.TEXT }}>{concepto}</td>
                                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: JA.GOLD, fontWeight: 700 }}>{tasa}</td>
                                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: JA.TEXT, fontWeight: 700 }}>{fmtCOP(valor)}</td>
                                    </tr>
                                ))}
                                <tr style={{ background: JA.BG, borderTop: `2px solid ${JA.BORDER}` }}>
                                    <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 800, color: JA.NAVY }}>Total Prestaciones</td>
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, color: JA.GOLD }}>{fmtCOP(nom.totalPrestaciones)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Costo total breakdown */}
                    <div style={{ ...CARD, padding: '18px' }}>
                        <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: '0 0 14px' }}>Estructura de Costo Total</h3>
                        {[
                            { label: 'Salario + Auxilio',    value: nom.salario + nom.auxTransporte, color: JA.NAVY   },
                            { label: 'Aportes patronales',   value: nom.totalPatronal,               color: JA.ORANGE },
                            { label: 'Prestaciones/mes',     value: nom.totalPrestaciones,           color: JA.GOLD   },
                        ].map(({ label, value, color }, i) => (
                            <div key={i} style={{ marginBottom: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 600, color: JA.GREY }}>{label}</span>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color, fontFamily: 'monospace' }}>
                                        {fmtCOP(value)} · {pct(value, nom.costoTotalMes)}
                                    </span>
                                </div>
                                <div style={{ height: 6, background: JA.BG, borderRadius: '1px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: color, width: `${(value / nom.costoTotalMes) * 100}%`, borderRadius: '1px' }} />
                                </div>
                            </div>
                        ))}
                        <div style={{ borderTop: `2px solid ${JA.BORDER}`, paddingTop: '10px', marginTop: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: JA.NAVY }}>Costo Total / empleado</span>
                                <span style={{ fontSize: '14px', fontWeight: 900, color: JA.RED, fontFamily: 'monospace' }}>{fmtCOP(nom.costoTotalMes)}</span>
                            </div>
                            <p style={{ fontSize: '9px', color: JA.GREY_LT, margin: '4px 0 0' }}>
                                {pct(nom.costoTotalMes - nom.salario, nom.salario)} más que el salario base
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Nota legal ── */}
            <div style={{ padding: '10px 16px', background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '10px', color: JA.GREY_LT, lineHeight: 1.6 }}>
                <strong style={{ color: JA.GREY }}>Nota legal:</strong> Cálculos basados en SMMLV 2026 proyectado. Tasas: Decreto 2616/2013, Ley 1819/2016, Decreto 1990/2015.
                Verifique con su contador las tarifas vigentes. Este módulo es orientativo — no reemplaza la planilla PILA oficial.
            </div>
        </div>
    )
}
