import { NextRequest } from 'next/server';
import { downloadDianPdf } from '@/lib/causacion/dian-scraper';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { cufes }: { cufes: Array<{ cufe: string; numero_factura: string; proveedor_nombre?: string }> } = body;

    if (!cufes || cufes.length === 0) {
        return new Response(JSON.stringify({ error: 'Falta la lista de CUFEs' }), { status: 400 });
    }

    const encoder = new TextEncoder();

    // Server-Sent Events: permite enviar actualizaciones en tiempo real al frontend
    // mientras el servidor procesa cada CUFE sin cortar la conexion
    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: object) => {
                controller.enqueue(encoder.encode('data: ' + JSON.stringify(data) + '\n\n'));
            };

            send({ type: 'start', total: cufes.length });

            const results: Array<{ cufe: string; numero_factura: string; proveedor_nombre?: string; base64?: string; success: boolean; error?: string }> = [];

            for (let i = 0; i < cufes.length; i++) {
                const item = cufes[i];
                send({ type: 'progress', current: i + 1, total: cufes.length, numero_factura: item.numero_factura, status: 'processing' });

                try {
                    console.log(`[RPA-BATCH] Procesando ${i + 1}/${cufes.length}: ${item.numero_factura}`);
                    const base64 = await downloadDianPdf(item.cufe);

                    results.push({ ...item, base64, success: true });
                    send({ type: 'progress', current: i + 1, total: cufes.length, numero_factura: item.numero_factura, status: 'success' });
                    console.log(`[RPA-BATCH] OK ${i + 1}/${cufes.length}: ${item.numero_factura}`);

                } catch (err: any) {
                    const isBlock = err.message?.toLowerCase().includes('bloqueo') || err.message?.toLowerCase().includes('blocked') || err.message?.toLowerCase().includes('seguridad');
                    results.push({ ...item, success: false, error: err.message });
                    send({ type: 'progress', current: i + 1, total: cufes.length, numero_factura: item.numero_factura, status: 'error', error: err.message, isBlock });
                    console.error(`[RPA-BATCH] FALLO ${i + 1}/${cufes.length}: ${item.numero_factura} - ${err.message}`);
                }

                // Pausa anti-bloqueo entre CUFEs (3-6 segundos aleatorios)
                // Esto imita el comportamiento humano y reduce la probabilidad de ser bloqueados
                if (i < cufes.length - 1) {
                    const pauseMs = 3000 + Math.floor(Math.random() * 3000);
                    send({ type: 'pause', ms: pauseMs, reason: 'anti-bloqueo' });
                    await new Promise(r => setTimeout(r, pauseMs));
                }
            }


            // Reintento de los fallidos (hasta 3 veces)
            const failed = results.filter(r => !r.success);
            if (failed.length > 0) {
                send({ type: 'retry_start', count: failed.length });
                for (let retry = 1; retry <= 3; retry++) {
                    const stillFailed = results.filter(r => !r.success);
                    if (stillFailed.length === 0) break;

                    send({ type: 'retry_round', round: retry, count: stillFailed.length });
                    for (const item of stillFailed) {
                        try {
                            const base64 = await downloadDianPdf(item.cufe);
                            const idx = results.findIndex(r => r.cufe === item.cufe);
                            if (idx >= 0) { results[idx].base64 = base64; results[idx].success = true; delete results[idx].error; }
                            send({ type: 'retry_success', numero_factura: item.numero_factura });
                        } catch {
                            send({ type: 'retry_fail', numero_factura: item.numero_factura });
                        }
                    }
                }
            }

            send({ type: 'done', results: results.map(r => ({ cufe: r.cufe, numero_factura: r.numero_factura, proveedor_nombre: r.proveedor_nombre, base64: r.base64, success: r.success, error: r.error })) });
            controller.close();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
