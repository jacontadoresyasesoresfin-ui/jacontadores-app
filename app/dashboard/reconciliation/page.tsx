'use client'

import { useState, useEffect } from 'react'
import { FileCheck, Upload, AlertCircle, Search, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import { supabase, DianInvoice } from '@/lib/supabase-client'

const PRIMARY = '#0F172A'
const SECONDARY = '#334155'
const ACCENT = '#3B82F6'
const GREEN = '#059669'
const RED = '#DC2626'

export default function ReconciliationPage() {
    const [invoices, setInvoices] = useState<DianInvoice[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    // Drive Sync State
    const [showDriveSync, setShowDriveSync] = useState(false)
    const [driveUrl, setDriveUrl] = useState('')
    const [syncingDrive, setSyncingDrive] = useState(false)
    const [syncResult, setSyncResult] = useState<string | null>(null)

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
                throw new Error(data.error || 'Error al conectar con Google Drive');
            }

            // Conciliación: Cruzar datos extraídos de PDF con los datos de Supabase
            let conciledCount = 0;
            const updatedInvoices = [...invoices];

            for (const pdfInvoice of data.invoices) {
                if (pdfInvoice.error) continue;
                
                // Buscar coincidencia por CUFE o por NIT + Aproximación de Total
                const matchIndex = updatedInvoices.findIndex(inv => 
                    (inv.cufe && pdfInvoice.cufe && inv.cufe.includes(pdfInvoice.cufe.substring(0, 20))) ||
                    (inv.entidad_nit === pdfInvoice.nit && Math.abs(inv.total - pdfInvoice.total) < 1000)
                );

                if (matchIndex >= 0) {
                    updatedInvoices[matchIndex].estado_conciliacion = 'Conciliada';
                    // Update in Supabase
                    await supabase
                        .from('dian_invoices')
                        .update({ estado_conciliacion: 'Conciliada' })
                        .eq('id', updatedInvoices[matchIndex].id);
                    conciledCount++;
                }
            }

            setInvoices(updatedInvoices);
            setSyncResult(`✅ ${data.message}. Se lograron conciliar automáticamente ${conciledCount} facturas nuevas contra los registros de Siigo.`);
        } catch (err: any) {
            setSyncResult(`❌ Error: ${err.message}`);
        } finally {
            setSyncingDrive(false);
        }
    }

    // Fetch invoices on load
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
            setError(err.message || 'Error fetching invoices')
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
            alert('Error updating status: ' + err.message)
        }
    }

    // Calcular KPIs
    const totalFacturado = invoices.reduce((acc, curr) => acc + curr.subtotal, 0)
    const totalIVA = invoices.reduce((acc, curr) => acc + curr.iva, 0)
    const pendientes = invoices.filter(i => i.estado_conciliacion === 'Pendiente').length
    const conciliadas = invoices.filter(i => i.estado_conciliacion === 'Conciliada').length

    const filteredInvoices = invoices.filter(i => 
        i.entidad_nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
        i.cufe.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6 pb-10" style={{ fontFamily: 'var(--font-inter)' }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800" style={{ fontFamily: 'var(--font-outfit)' }}>
                        Conciliación <span style={{ color: ACCENT }}>DIAN</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Gestión y cruce de facturas electrónicas (Modelo Colombiano)</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchInvoices} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 transition-all">
                        <RefreshCw className="w-4 h-4" /> Refrescar
                    </button>
                    <button onClick={() => setShowDriveSync(!showDriveSync)} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-all" style={{ background: PRIMARY }}>
                        <Upload className="w-4 h-4" /> Sincronizar PDFs (Drive)
                    </button>
                </div>
            </div>

            {/* Panel de Sincronización Drive */}
            {showDriveSync && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        Sincronización Automática de Facturas PDF
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                            type="text" 
                            placeholder="Pega el enlace de la carpeta de Google Drive (Debe ser pública para lectura)" 
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                            value={driveUrl}
                            onChange={(e) => setDriveUrl(e.target.value)}
                        />
                        <button 
                            onClick={handleDriveSync} 
                            disabled={syncingDrive || !driveUrl}
                            className="flex items-center justify-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all"
                        >
                            {syncingDrive ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            {syncingDrive ? 'Extrayendo datos...' : 'Iniciar Escaneo'}
                        </button>
                    </div>
                    {syncResult && (
                        <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${syncResult.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                            {syncResult}
                        </div>
                    )}
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Base Gravable', value: `$${(totalFacturado/1000000).toFixed(1)}M`, icon: FileCheck, color: PRIMARY },
                    { label: 'IVA Generado', value: `$${(totalIVA/1000000).toFixed(1)}M`, icon: AlertCircle, color: ACCENT },
                    { label: 'Facturas Pendientes', value: pendientes, icon: XCircle, color: RED },
                    { label: 'Facturas Conciliadas', value: conciliadas, icon: CheckCircle2, color: GREEN },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
                            <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
                        </div>
                        <p className="text-2xl font-black text-slate-800 font-mono">{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabla Principal */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                    <Search className="w-5 h-5 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar por Tercero o CUFE..." 
                        className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                {loading ? (
                    <div className="p-10 text-center text-slate-500 text-sm flex flex-col items-center">
                        <RefreshCw className="w-6 h-6 animate-spin mb-3 text-slate-300" />
                        Cargando registros...
                    </div>
                ) : error ? (
                    <div className="p-10 text-center text-red-500 text-sm">
                        <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                        Asegúrate de haber ejecutado el script SQL en Supabase.<br/>{error}
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="p-10 text-center text-slate-500 text-sm">
                        No hay facturas registradas. Utiliza "Cargar XML/CSV DIAN" para empezar.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Tercero / Emisor</th>
                                    <th className="px-6 py-4">Detalles DIAN</th>
                                    <th className="px-6 py-4 text-right">Impuestos</th>
                                    <th className="px-6 py-4 text-right">Total</th>
                                    <th className="px-6 py-4 text-center">Estado</th>
                                    <th className="px-6 py-4">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredInvoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-800">{inv.entidad_nombre}</p>
                                            <p className="text-xs text-slate-500 font-mono">NIT: {inv.entidad_nit}</p>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <p className="text-slate-700 truncate" title={inv.cufe}>CUFE: <span className="font-mono text-xs">{inv.cufe.substring(0, 12)}...</span></p>
                                            <p className="text-xs text-slate-500">{new Date(inv.fecha_emision).toLocaleDateString()}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right text-xs">
                                            <p><span className="text-slate-400">IVA:</span> ${inv.iva.toLocaleString('es-CO')}</p>
                                            {inv.retefuente > 0 && <p><span className="text-slate-400">RteFte:</span> ${inv.retefuente.toLocaleString('es-CO')}</p>}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-black text-slate-800">
                                            ${inv.total.toLocaleString('es-CO')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                                                inv.estado_conciliacion === 'Conciliada' 
                                                    ? 'bg-emerald-100 text-emerald-700' 
                                                    : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {inv.estado_conciliacion}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={() => toggleConciliacion(inv.id, inv.estado_conciliacion)}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                                                    inv.estado_conciliacion === 'Pendiente'
                                                    ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                }`}
                                            >
                                                {inv.estado_conciliacion === 'Pendiente' ? 'Conciliar' : 'Deshacer'}
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
