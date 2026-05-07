'use client'

import { useState, useEffect } from 'react'
import { FileCheck, Upload, AlertCircle, Search, RefreshCw, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react'
import { supabase, DianInvoice } from '@/lib/supabase-client'
import Papa from 'papaparse'

const NAVY = '#13213C'
const GOLD = '#B8960C'
const SLATE_DARK = '#334155'
const BORDER_COLOR = '#E2E8F0'

export default function ReconciliationPage() {
    const [invoices, setInvoices] = useState<DianInvoice[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    const [showDriveSync, setShowDriveSync] = useState(false)
    const [driveUrl, setDriveUrl] = useState('')
    const [syncingDrive, setSyncingDrive] = useState(false)
    const [syncResult, setSyncResult] = useState<string | null>(null)

    // Sheets Sync State
    const [showSheetSync, setShowSheetSync] = useState(false)
    const [sheetUrl, setSheetUrl] = useState('')
    const [syncingSheet, setSyncingSheet] = useState(false)
    const [sheetSyncResult, setSheetSyncResult] = useState<string | null>(null)

    const handleDriveSync = async () => {
        if (!driveUrl) return;
        setSyncingDrive(true);
        setSyncResult(null);
        try {
            const res = await fetch('/api/drive-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderUrl: driveUrl })
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
                        .eq('id', updatedInvoices[matchIndex].id);
                    conciledCount++;
                }
            }

            setInvoices(updatedInvoices);
            setSyncResult(`Proceso completado. ${data.message}. Se conciliaron ${conciledCount} registros.`);
        } catch (err: any) {
            setSyncResult(`Error del sistema: ${err.message}`);
        } finally {
            setSyncingDrive(false);
        }
    }

    const handleSheetSync = async () => {
        if (!sheetUrl) return;
        setSyncingSheet(true);
        setSheetSyncResult(null);
        try {
            const exportUrl = sheetUrl.replace(/\/edit.*$/, '/export?format=csv');
            const proxyUrl = `/api/sheets-proxy?url=${encodeURIComponent(exportUrl)}`;
            
            const res = await fetch(proxyUrl);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Error HTTP ${res.status}`);
            }
            
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
                                .eq('id', updatedInvoices[matchIndex].id);
                            conciledCount++;
                        }
                    }
                    setInvoices(updatedInvoices);
                    setSheetSyncResult(`Proceso completado. Se sincronizó la fuente externa y se conciliaron ${conciledCount} documentos.`);
                    setSyncingSheet(false);
                },
                error: (err: any) => {
                    setSheetSyncResult(`Error en procesamiento de datos: ${err.message}`);
                    setSyncingSheet(false);
                }
            });

        } catch (err: any) {
            setSheetSyncResult(`Error del sistema: ${err.message}`);
            setSyncingSheet(false);
        }
    }

    const fetchInvoices = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('dian_invoices')
                .select('*')
                .order('fecha_emision', { ascending: false })
            
            if (error) throw error
            setInvoices(data || [])
        } catch (err: any) {
            setError(err.message || 'Fallo de lectura de base de datos')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchInvoices()
    }, [])

    const toggleConciliacion = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'Pendiente' ? 'Conciliada' : 'Pendiente'
        try {
            const { error } = await supabase
                .from('dian_invoices')
                .update({ estado_conciliacion: newStatus })
                .eq('id', id)
            
            if (error) throw error
            setInvoices(invoices.map(inv => inv.id === id ? { ...inv, estado_conciliacion: newStatus } : inv))
        } catch (err: any) {
            alert('Fallo de actualización: ' + err.message)
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
        <div className="space-y-6" style={{ fontFamily: 'var(--font-inter)' }}>
            {/* Header del Módulo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: BORDER_COLOR }}>
                <div>
                    <h1 className="text-xl font-bold" style={{ color: NAVY }}>
                        Módulo de Conciliación Fiscal
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Control integral de documentos electrónicos DIAN</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchInvoices} className="flex items-center gap-2 px-3 py-1.5 bg-white border text-sm font-medium hover:bg-slate-50 transition-colors rounded-sm" style={{ borderColor: BORDER_COLOR, color: SLATE_DARK }}>
                        <RefreshCw className="w-4 h-4" /> Actualizar Datos
                    </button>
                    <button onClick={() => { setShowDriveSync(!showDriveSync); setShowSheetSync(false); }} className="flex items-center gap-2 px-3 py-1.5 text-white text-sm font-medium hover:opacity-90 transition-opacity rounded-sm" style={{ background: NAVY }}>
                        <Upload className="w-4 h-4" /> Sincronizar Repositorio (PDF)
                    </button>
                    <button onClick={() => { setShowSheetSync(!showSheetSync); setShowDriveSync(false); }} className="flex items-center gap-2 px-3 py-1.5 text-white text-sm font-medium hover:opacity-90 transition-opacity rounded-sm" style={{ background: SLATE_DARK }}>
                        <FileSpreadsheet className="w-4 h-4" /> Procesar Reporte DIAN (Sheets)
                    </button>
                </div>
            </div>

            {/* Panel Sheets */}
            {showSheetSync && (
                <div className="bg-white border p-4 rounded-sm" style={{ borderColor: BORDER_COLOR }}>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: NAVY }}>
                        <FileSpreadsheet className="w-4 h-4" />
                        Ejecución de Cruce Masivo (Google Sheets)
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input 
                            type="text" 
                            placeholder="Ingrese URI del documento de orígen de datos (Acceso Público Requerido)" 
                            className="flex-1 border px-3 py-1.5 text-sm outline-none rounded-sm"
                            style={{ borderColor: BORDER_COLOR }}
                            value={sheetUrl}
                            onChange={(e) => setSheetUrl(e.target.value)}
                        />
                        <button 
                            onClick={handleSheetSync} 
                            disabled={syncingSheet || !sheetUrl}
                            className="flex items-center justify-center gap-2 px-6 py-1.5 text-white text-sm font-medium disabled:opacity-50 rounded-sm"
                            style={{ background: NAVY }}
                        >
                            {syncingSheet ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            {syncingSheet ? 'Ejecutando proceso...' : 'Iniciar Proceso'}
                        </button>
                    </div>
                    {sheetSyncResult && (
                        <div className={`mt-3 p-2 text-xs border rounded-sm font-medium ${sheetSyncResult.includes('Error') ? 'bg-red-50 text-red-800 border-red-200' : 'bg-slate-50 text-slate-800 border-slate-200'}`}>
                            {sheetSyncResult}
                        </div>
                    )}
                </div>
            )}

            {/* Panel Drive */}
            {showDriveSync && (
                <div className="bg-white border p-4 rounded-sm" style={{ borderColor: BORDER_COLOR }}>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: NAVY }}>
                        <FileCheck className="w-4 h-4" />
                        Auditoría Automática de Documentos PDF
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input 
                            type="text" 
                            placeholder="Ingrese URL del directorio Drive (Lectura requerida)" 
                            className="flex-1 border px-3 py-1.5 text-sm outline-none rounded-sm"
                            style={{ borderColor: BORDER_COLOR }}
                            value={driveUrl}
                            onChange={(e) => setDriveUrl(e.target.value)}
                        />
                        <button 
                            onClick={handleDriveSync} 
                            disabled={syncingDrive || !driveUrl}
                            className="flex items-center justify-center gap-2 px-6 py-1.5 text-white text-sm font-medium disabled:opacity-50 rounded-sm"
                            style={{ background: NAVY }}
                        >
                            {syncingDrive ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            {syncingDrive ? 'Extrayendo metadatos...' : 'Iniciar Extracción'}
                        </button>
                    </div>
                    {syncResult && (
                        <div className={`mt-3 p-2 text-xs border rounded-sm font-medium ${syncResult.includes('Error') ? 'bg-red-50 text-red-800 border-red-200' : 'bg-slate-50 text-slate-800 border-slate-200'}`}>
                            {syncResult}
                        </div>
                    )}
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Ingresos Declarados', value: `$${(totalFacturado/1000000).toFixed(1)}M`, icon: FileCheck },
                    { label: 'Obligaciones IVA', value: `$${(totalIVA/1000000).toFixed(1)}M`, icon: AlertCircle },
                    { label: 'Documentos en Tránsito', value: pendientes, icon: XCircle },
                    { label: 'Documentos Conciliados', value: conciliadas, icon: CheckCircle2 },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white border p-4 rounded-sm flex flex-col justify-between" style={{ borderColor: BORDER_COLOR, borderTopWidth: '3px', borderTopColor: i < 2 ? NAVY : (i === 2 ? '#94a3b8' : GOLD) }}>
                        <div className="flex justify-between items-start mb-1">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{kpi.label}</p>
                            <kpi.icon className="w-4 h-4 text-slate-400" />
                        </div>
                        <p className="text-xl font-bold text-slate-800 font-mono tracking-tight">{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabla Principal */}
            <div className="bg-white border rounded-sm overflow-hidden" style={{ borderColor: BORDER_COLOR }}>
                <div className="p-3 border-b flex items-center gap-3 bg-slate-50" style={{ borderColor: BORDER_COLOR }}>
                    <Search className="w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar identificador fiscal o denominación comercial..." 
                        className="flex-1 bg-transparent border-none outline-none text-xs text-slate-700"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                {loading ? (
                    <div className="p-8 text-center text-slate-500 text-sm flex flex-col items-center">
                        <RefreshCw className="w-5 h-5 animate-spin mb-2 text-slate-400" />
                        Inicializando registros fiscales...
                    </div>
                ) : error ? (
                    <div className="p-8 text-center text-red-600 text-sm">
                        <AlertCircle className="w-5 h-5 mx-auto mb-2" />
                        Notificación del sistema: {error}
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">
                        No existen registros en el periodo actual. Requiere sincronización.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b" style={{ borderColor: BORDER_COLOR }}>
                                <tr>
                                    <th className="px-4 py-3">Tercero Identificado</th>
                                    <th className="px-4 py-3">Referencia Documental</th>
                                    <th className="px-4 py-3 text-right">Tributos</th>
                                    <th className="px-4 py-3 text-right">Base Total</th>
                                    <th className="px-4 py-3 text-center">Estado Auditoría</th>
                                    <th className="px-4 py-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y" style={{ borderColor: BORDER_COLOR }}>
                                {filteredInvoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-800">{inv.entidad_nombre || 'N/A'}</p>
                                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {inv.entidad_nit || 'N/A'}</p>
                                        </td>
                                        <td className="px-4 py-3 max-w-[200px]">
                                            <p className="text-slate-700 truncate" title={inv.cufe || ''}>Ref: <span className="font-mono text-[10px]">{(inv.cufe || 'N/A').substring(0, 15)}...</span></p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">{inv.fecha_emision ? new Date(inv.fecha_emision).toLocaleDateString('es-CO') : 'N/A'}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <p><span className="text-slate-400">IVA:</span> ${(inv.iva || 0).toLocaleString('es-CO')}</p>
                                            {(inv.retefuente || 0) > 0 && <p><span className="text-slate-400">RteFte:</span> ${(inv.retefuente).toLocaleString('es-CO')}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                                            ${(inv.total || 0).toLocaleString('es-CO')}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded-sm ${
                                                inv.estado_conciliacion === 'Conciliada' 
                                                    ? 'border-slate-300 bg-slate-100 text-slate-600' 
                                                    : 'border-amber-200 bg-amber-50 text-amber-700'
                                            }`}>
                                                {inv.estado_conciliacion.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button 
                                                onClick={() => toggleConciliacion(inv.id, inv.estado_conciliacion)}
                                                className={`px-3 py-1 text-[10px] font-medium rounded-sm border transition-colors ${
                                                    inv.estado_conciliacion === 'Pendiente'
                                                    ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                                                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                                                }`}
                                            >
                                                {inv.estado_conciliacion === 'Pendiente' ? 'Procesar' : 'Revertir'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
