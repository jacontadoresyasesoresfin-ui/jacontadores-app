'use client';

import React, { useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { DownloadCloud, Loader2, CheckCircle, AlertCircle, FileText } from 'lucide-react';

interface Factura {
    cufe: string;
    numero_factura: string;
    proveedor_nombre?: string;
}

export default function RpaBulkDownload({ facturas }: { facturas: Factura[] }) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, successes: 0, failures: 0 });
    const [statusText, setStatusText] = useState('');
    
    const [mode, setMode] = useState<'tabla' | 'manual'>('tabla');
    const [manualCufes, setManualCufes] = useState('');

    const handleBulkDownload = async () => {
        let facturasToProcess: Factura[] = [];

        if (mode === 'tabla') {
            facturasToProcess = facturas.filter(f => f.cufe);
        } else {
            // Parse manual CUFEs (split by newline, comma, space)
            const cufes = manualCufes.split(/[\n, ]+/).map(c => c.trim()).filter(c => c.length > 20);
            facturasToProcess = cufes.map((c, i) => ({
                cufe: c,
                numero_factura: `Manual_${i + 1}`,
                proveedor_nombre: 'Proveedor'
            }));
        }

        if (facturasToProcess.length === 0) {
            alert(mode === 'tabla' 
                ? 'No hay facturas con CUFE en la tabla actual.' 
                : 'Por favor, pega al menos un CUFE válido.');
            return;
        }

        setIsDownloading(true);
        const totalCount = facturasToProcess.length;
        setProgress({ current: 0, total: totalCount, successes: 0, failures: 0 });
        setStatusText('Conectando con el robot RPA...');

        const zip = new JSZip();
        let successCount = 0;
        let failCount = 0;

        try {
            // Una sola conexión persistente SSE al servidor.
            // El servidor procesa TODOS los CUFEs en secuencia y envía eventos en tiempo real.
            const response = await fetch('/api/causacion/dian-rpa-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cufes: facturasToProcess }),
            });

            if (!response.ok || !response.body) {
                throw new Error('No se pudo conectar al servidor RPA.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Guardar la línea incompleta

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const event = JSON.parse(line.slice(6));

                        if (event.type === 'start') {
                            setStatusText(`Robot iniciado para ${event.total} facturas...`);

                        } else if (event.type === 'progress') {
                            let icon = '...';
                            if (event.status === 'success') icon = 'OK';
                            else if (event.status === 'error' && event.isBlock) icon = 'BLOQUEADO';
                            else if (event.status === 'error') icon = 'ERROR';
                            setStatusText(`[${icon}] (${event.current}/${event.total}): ${event.numero_factura}`);

                        } else if (event.type === 'pause') {
                            // Pausa anti-bloqueo entre CUFEs - no mostrar nada especial
                        } else if (event.type === 'retry_start') {
                            setStatusText(`Reintentando ${event.count} facturas fallidas...`);

                        } else if (event.type === 'retry_round') {
                            setStatusText(`Reintento ${event.round}: ${event.count} pendientes...`);

                        } else if (event.type === 'done') {
                            // Todos los PDFs llegan en el evento final
                            for (const result of (event.results || [])) {
                                if (result.success && result.base64) {
                                    const cleanName = (result.proveedor_nombre || 'Proveedor').replace(/[^a-z0-9]/gi, '_');
                                    const fileName = `${result.numero_factura}_${cleanName}_${result.cufe.substring(0, 8)}.pdf`;
                                    zip.file(fileName, result.base64, { base64: true });
                                    successCount++;
                                } else {
                                    failCount++;
                                }
                            }

                            setProgress({ current: totalCount, total: totalCount, successes: successCount, failures: failCount });

                            if (successCount > 0) {
                                setStatusText(`${successCount} PDFs listos. Generando ZIP...`);
                                const content = await zip.generateAsync({ type: 'blob' });
                                saveAs(content, `Facturas_DIAN_RPA_${new Date().toISOString().slice(0, 10)}.zip`);
                                setStatusText(
                                    failCount === 0
                                        ? `Completado: ${successCount}/${totalCount} facturas descargadas.`
                                        : `Finalizado: ${successCount} exitosas, ${failCount} fallidas.`
                                );
                            } else {
                                setStatusText('No se pudo descargar ningun PDF. Revisa la conexion al navegador.');
                            }
                        }

                        // Actualizar progreso en tiempo real con cada evento
                        if (event.type === 'progress' && event.status === 'success') {
                            successCount++;
                            setProgress({ current: event.current, total: totalCount, successes: successCount, failures: failCount });
                        } else if (event.type === 'progress' && event.status === 'error') {
                            failCount++;
                            setProgress({ current: event.current, total: totalCount, successes: successCount, failures: failCount });
                        } else if (event.type === 'progress' && event.status === 'processing') {
                            setProgress(p => ({ ...p, current: event.current - 1, total: totalCount }));
                        }

                    } catch {}
                }
            }

        } catch (err) {
            console.error('[RPA] Error de conexion:', err);
            setStatusText('Error de conexion con el servidor RPA.');
        }

        setTimeout(() => setIsDownloading(false), 6000);
    };



    const countFacturasTabla = facturas.filter(f => f.cufe).length;
    const countManualCufes = manualCufes.split(/[\n, ]+/).filter(c => c.trim().length > 20).length;
    const currentCount = mode === 'tabla' ? countFacturasTabla : countManualCufes;

    return (
        <div style={{ padding: '16px', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: '4px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#13213C', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <DownloadCloud size={16} /> Descarga Masiva de PDFs (RPA DIAN)
                    </h3>
                    <p style={{ fontSize: '12px', color: '#4B5563', margin: '4px 0 12px 0' }}>
                        Descarga los PDFs originales emulando un navegador. Evade Cloudflare y empaqueta en ZIP.
                    </p>
                    
                    {/* Selectores de Modo */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: mode === 'manual' ? '8px' : '0' }}>
                        <button 
                            onClick={() => setMode('tabla')}
                            style={{ 
                                padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #E5E7EB', cursor: 'pointer',
                                background: mode === 'tabla' ? '#13213C' : '#FFFFFF', color: mode === 'tabla' ? '#FFFFFF' : '#4B5563'
                            }}>
                            Usar facturas de la tabla ({countFacturasTabla})
                        </button>
                        <button 
                            onClick={() => setMode('manual')}
                            style={{ 
                                padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #E5E7EB', cursor: 'pointer',
                                background: mode === 'manual' ? '#13213C' : '#FFFFFF', color: mode === 'manual' ? '#FFFFFF' : '#4B5563'
                            }}>
                            Pegar lista de CUFEs
                        </button>
                    </div>

                    {mode === 'manual' && (
                        <textarea 
                            value={manualCufes}
                            onChange={(e) => setManualCufes(e.target.value)}
                            placeholder="Pega aquí los CUFEs separados por comas o saltos de línea..."
                            style={{
                                width: '100%', maxWidth: '500px', height: '80px', padding: '8px', borderRadius: '4px',
                                border: '1px solid #E5E7EB', fontSize: '12px', resize: 'vertical'
                            }}
                        />
                    )}
                </div>
                
                <button
                    onClick={handleBulkDownload}
                    disabled={isDownloading || currentCount === 0}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: isDownloading || currentCount === 0 ? '#9CA3AF' : '#13213C',
                        color: 'white', border: 'none', padding: '10px 16px',
                        borderRadius: '4px', cursor: isDownloading || currentCount === 0 ? 'not-allowed' : 'pointer',
                        fontSize: '13px', fontWeight: 600, marginTop: '8px'
                    }}
                >
                    {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                    {isDownloading ? 'Procesando...' : `Descargar ${currentCount} PDFs`}
                </button>
            </div>

            {isDownloading && (
                <div style={{ marginTop: '16px', padding: '12px', background: '#FFFFFF', borderRadius: '4px', border: '1px solid #E5E7EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                        <span style={{ color: '#13213C', fontWeight: 500 }}>{statusText}</span>
                        <span style={{ color: '#4B5563', fontWeight: 600 }}>{Math.round((progress.current / progress.total) * 100)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#E5E7EB', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ 
                            height: '100%', 
                            background: '#B8960C', 
                            width: `${(progress.current / progress.total) * 100}%`,
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11px', fontWeight: 500 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669' }}>
                            <CheckCircle size={14} /> Exitosos: {progress.successes}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#DC2626' }}>
                            <AlertCircle size={14} /> Fallidos/Timeouts: {progress.failures}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
