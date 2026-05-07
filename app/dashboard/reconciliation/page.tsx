'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileCheck, Upload, AlertCircle, Search, RefreshCw, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react'
import { supabase, DianInvoice } from '@/lib/supabase-client'
import { useClient } from '../ClientContext'
import Papa from 'papaparse'

const JA = {
    NAVY:    '#13213C',
    GOLD:    '#B8960C',
    TEXT:    '#1C2B45',
    GREY:    '#4B5563',
    GREY_LT: '#9CA3AF',
    BORDER:  '#E5E7EB',
    BG:      '#F8FAFC',
    GREEN:   '#10B981',
    RED:     '#EF4444',
}

export default function ReconciliationPage() {
    const { activeProfile } = useClient()
    const [invoices, setInvoices] = useState<DianInvoice[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    const [showDriveSync, setShowDriveSync] = useState(false)
    const [driveUrl, setDriveUrl] = useState('')
    const [syncingDrive, setSyncingDrive] = useState(false)
    const [syncResult, setSyncResult] = useState<string | null>(null)

    const [showSheetSync, setShowSheetSync] = useState(false)
    const [sheetUrl, setSheetUrl] = useState('')
    const [syncingSheet, setSyncingSheet] = useState(false)
    const [sheetSyncResult, setSheetSyncResult] = useState<string | null>(null)

    const fetchInvoices = useCallback(async () => {
        if (!activeProfile?.id) return
        setLoading(true)
        try {
            // AISLAMIENTO: Filtrar estrictamente por el profile_id del cliente activo
            const { data, error } = await supabase
                .from('dian_invoices')
                .select('*')
                .eq('profile_id', activeProfile.id)
                .order('fecha_emision', { ascending: false })
            
            if (error) throw error
            setInvoices(data || [])
        } catch (err: any) {
            setError(err.message || 'Fallo de lectura de base de datos')
        } finally {
            setLoading(false)
        }
    }, [activeProfile?.id])

    useEffect(() => {
        fetchInvoices()
    }, [fetchInvoices])

    const handleDriveSync = async () => {
        if (!driveUrl || !activeProfile?.id) return;
        setSyncingDrive(true);
        setSyncResult(null);
        try {
            const res = await fetch('/api/drive-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderUrl: driveUrl, profileId: activeProfile.id })
            });
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Error de conexión con el directorio remoto.');
            }

            let conciledCount = 0;
            const updatedInvoices = [...invoices];

            for (const pdfInvoice of data.invoices) {
                if (pdfInvoice.error) continue;
                
                const matchIndex = updatedInvoices.findIndex(inv => 
                    (inv.cufe && pdfInvoice.cufe && inv.cufe.includes(pdfInvoice.cufe.substring(0, 20))) ||
                    (inv.entidad_nit === pdfInvoice.nit && Math.abs(inv.total - pdfInvoice.total) < 1000)
                );

                if (matchIndex >= 0) {
                    updatedInvoices[matchIndex].estado_conciliacion = 'Conciliada';
                    await supabase
                        .from('dian_invoices')
                        .update({ estado_conciliacion: 'Conciliada' })
                        .eq('id', updatedInvoices[matchIndex].id)
                        .eq('profile_id', activeProfile.id); // Seguridad extra
                    conciledCount++;
                }
            }

            setInvoices(updatedInvoices);
            setSyncResult(`Sincronización PDF exitosa. Se conciliaron ${conciledCount} registros.`);
        } catch (err: any) {
            setSyncResult(`Error: ${err.message}`);
        } finally {
            setSyncingDrive(false);
        }
    }

    const handleSheetSync = async () => {
        if (!sheetUrl || !activeProfile?.id) return;
        setSyncingSheet(true);
        setSheetSyncResult(null);
        try {
            const exportUrl = sheetUrl.replace(/\/edit.*$/, '/export?format=csv');
            const proxyUrl = `/api/sheets-proxy?url=${encodeURIComponent(exportUrl)}`;
            
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
            
            const csvText = await res.text();
            
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    let conciledCount = 0;
                    const updatedInvoices = [...invoices];
                    
                    for (const row of results.data as any[]) {
                        const getVal = (possibleKeys: string[]) => {
                            const key = Object.keys(row).find(k => possibleKeys.some(pk => k.toLowerCase().includes(pk)));
                            return key ? row[key] : null;
                        };
                        
                        const sheetCufe = getVal(['cufe', 'c.u.f.e']);
                        const sheetNit = getVal(['nit', 'identificacion', 'documento']);
                        const sheetTotalStr = getVal(['total', 'valor']);
                        
                        if (!sheetCufe && !sheetNit) continue;
                        
                        const sheetTotal = sheetTotalStr ? parseFloat(sheetTotalStr.replace(/[^0-9.-]+/g,"")) : 0;
                        
                        const matchIndex = updatedInvoices.findIndex(inv => 
                            (inv.cufe && sheetCufe && inv.cufe.includes(sheetCufe.substring(0, 20))) ||
                            (inv.entidad_nit === sheetNit && Math.abs(inv.total - sheetTotal) < 1000)
                        );

                        if (matchIndex >= 0 && updatedInvoices[matchIndex].estado_conciliacion !== 'Conciliada') {
                            updatedInvoices[matchIndex].estado_conciliacion = 'Conciliada';
                            await supabase
                                .from('dian_invoices')
                                .update({ estado_conciliacion: 'Conciliada' })
                                .eq('id', updatedInvoices[matchIndex].id)
                                .eq('profile_id', activeProfile.id); // Seguridad extra
                            conciledCount++;
                        }
                    }
                    setInvoices(updatedInvoices);
                    setSheetSyncResult(`Proceso completado. ${conciledCount} documentos conciliados.`);
                    setSyncingSheet(false);
                },
                error: (err: any) => {
                    setSheetSyncResult(`Error parsing: ${err.message}`);
                    setSyncingSheet(false);
                }
            });

        } catch (err: any) {
            setSheetSyncResult(`Error: ${err.message}`);
            setSyncingSheet(false);
        }
    }

    const toggleConciliacion = async (id: string, currentStatus: string) => {
        if (!activeProfile?.id) return
        const newStatus = currentStatus === 'Pendiente' ? 'Conciliada' : 'Pendiente'
        try {
            const { error } = await supabase
                .from('dian_invoices')
                .update({ estado_conciliacion: newStatus })
                .eq('id', id)
                .eq('profile_id', activeProfile.id) // Seguridad extra
            
            if (error) throw error
            setInvoices(invoices.map(inv => inv.id === id ? { ...inv, estado_conciliacion: newStatus } : inv))
        } catch (err: any) {
            alert('Error: ' + err.message)
        }
    }

    const totalFacturado = invoices.reduce((acc, curr) => acc + (curr.subtotal || 0), 0)
    const totalIVA = invoices.reduce((acc, curr) => acc + (curr.iva || 0), 0)
    const pendientes = invoices.filter(i => i.estado_conciliacion === 'Pendiente').length
    const conciliadas = invoices.filter(i => i.estado_conciliacion === 'Conciliada').length

    const filteredInvoices = invoices.filter(i => 
        (i.entidad_nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (i.cufe || '').toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Conciliación Fiscal</h1>
                    <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>Control y auditoría de documentos electrónicos DIAN</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={fetchInvoices} style={{ background: '#FFF', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: JA.TEXT, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <RefreshCw style={{ width: 14, height: 14 }} /> Sincronizar
                    </button>
                    <button onClick={() => { setShowSheetSync(!showSheetSync); setShowDriveSync(false); }} style={{ background: JA.NAVY, border: 'none', borderRadius: '2px', padding: '8px 16px', fontSize: '12px', fontWeight: 600, color: '#FFF', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <FileSpreadsheet style={{ width: 14, height: 14 }} /> Importar Reporte DIAN
                    </button>
                </div>
            </div>

            {/* Sync Panels */}
            {showSheetSync && (
                <div style={{ background: '#FFF', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '20px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.NAVY, margin: '0 0 16px 0' }}>Sincronización con Google Sheets</h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <input 
                            type="text" 
                            placeholder="URL del documento Google Sheets..." 
                            style={{ flex: 1, padding: '8px 12px', fontSize: '13px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', outline: 'none' }}
                            value={sheetUrl}
                            onChange={(e) => setSheetUrl(e.target.value)}
                        />
                        <button 
                            onClick={handleSheetSync} 
                            disabled={syncingSheet || !sheetUrl}
                            style={{ background: JA.NAVY, color: '#FFF', border: 'none', borderRadius: '2px', padding: '8px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: syncingSheet ? 0.7 : 1 }}
                        >
                            {syncingSheet ? 'Procesando...' : 'Iniciar Cruce'}
                        </button>
                    </div>
                    {sheetSyncResult && (
                        <div style={{ marginTop: '12px', fontSize: '11px', color: sheetSyncResult.includes('Error') ? JA.RED : JA.GREEN, fontWeight: 600 }}>
                            {sheetSyncResult}
                        </div>
                    )}
                </div>
            )}

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {[
                    { label: 'Facturado (Base)', value: `$${(totalFacturado/1000000).toFixed(1)}M`, icon: FileCheck, color: JA.NAVY },
                    { label: 'IVA Generado', value: `$${(totalIVA/1000000).toFixed(1)}M`, icon: AlertCircle, color: JA.GOLD },
                    { label: 'Pendientes', value: pendientes, icon: XCircle, color: JA.RED },
                    { label: 'Conciliados', value: conciliadas, icon: CheckCircle2, color: JA.GREEN },
                ].map((kpi, i) => (
                    <div key={i} style={{ background: '#FFF', border: `1px solid ${JA.BORDER}`, borderLeft: `4px solid ${kpi.color}`, borderRadius: '2px', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: 0 }}>{kpi.label}</p>
                            <kpi.icon style={{ width: '14px', height: '14px', color: kpi.color }} />
                        </div>
                        <p style={{ fontSize: '20px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Invoices Table */}
            <div style={{ background: '#FFF', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: JA.BG, borderBottom: `1px solid ${JA.BORDER}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Search style={{ width: '14px', height: '14px', color: JA.GREY_LT }} />
                    <input 
                        type="text" 
                        placeholder="Filtrar por tercero o CUFE..." 
                        style={{ background: 'none', border: 'none', outline: 'none', fontSize: '12px', color: JA.TEXT, flex: 1 }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead style={{ background: JA.BG, color: JA.GREY, textAlign: 'left', borderBottom: `1px solid ${JA.BORDER}` }}>
                            <tr>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Tercero / Identificación</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Referencia CUFE</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Impuestos</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Total</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Estado</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody style={{ color: JA.TEXT }}>
                            {loading ? (
                                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: JA.GREY_LT }}>Recuperando registros fiscales...</td></tr>
                            ) : filteredInvoices.length === 0 ? (
                                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: JA.GREY_LT }}>No se encontraron documentos</td></tr>
                            ) : filteredInvoices.map((inv) => (
                                <tr key={inv.id} style={{ borderBottom: `1px solid ${JA.BG}` }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ fontWeight: 600 }}>{inv.entidad_nombre}</div>
                                        <div style={{ fontSize: '10px', color: JA.GREY_LT }}>NIT: {inv.entidad_nit}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ fontSize: '10px', fontFamily: 'monospace', color: JA.GREY }}>{(inv.cufe || '').substring(0, 20)}...</div>
                                        <div style={{ fontSize: '10px', color: JA.GREY_LT }}>{inv.fecha_emision ? new Date(inv.fecha_emision).toLocaleDateString() : 'N/A'}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                        <div style={{ color: JA.GOLD }}>IVA: ${(inv.iva || 0).toLocaleString()}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                                        ${(inv.total || 0).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <span style={{ 
                                            fontSize: '10px', 
                                            fontWeight: 700, 
                                            padding: '2px 8px', 
                                            borderRadius: '1px',
                                            background: inv.estado_conciliacion === 'Conciliada' ? JA.BG : '#FEF3C7',
                                            color: inv.estado_conciliacion === 'Conciliada' ? JA.GREY : '#B45309',
                                            border: `1px solid ${inv.estado_conciliacion === 'Conciliada' ? JA.BORDER : '#FDE68A'}`
                                        }}>
                                            {inv.estado_conciliacion.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <button 
                                            onClick={() => toggleConciliacion(inv.id, inv.estado_conciliacion)}
                                            style={{ 
                                                background: '#FFF', 
                                                border: `1px solid ${JA.BORDER}`, 
                                                borderRadius: '2px', 
                                                padding: '4px 10px', 
                                                fontSize: '11px', 
                                                fontWeight: 600, 
                                                cursor: 'pointer',
                                                color: JA.TEXT
                                            }}
                                        >
                                            {inv.estado_conciliacion === 'Pendiente' ? 'Conciliar' : 'Revertir'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

