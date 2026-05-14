import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { XMLParser } from 'fast-xml-parser';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        
        let profile_id = null;
        let mode = 'single';
        
        try {
            const body = await req.json();
            profile_id = body.profile_id;
            mode = body.mode || 'single';
        } catch(e) { }

        // Si no hay profile_id en el body, verificamos sesión auth
        if (!profile_id) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) profile_id = user.id;
        }

        if (!profile_id && mode !== 'all_active') {
            return NextResponse.json({ error: 'profile_id es requerido o debe enviar mode="all_active"' }, { status: 400 });
        }

        const startMs = Date.now();
        let profilesToProcess = [];

        // ─── NODO A: Trigger Cron ───────────────────────────────────────────────────────────
        if (mode === 'all_active') {
             const { data: configs } = await supabase.from('user_dian_config').select('profile_id').eq('activo', true);
             profilesToProcess = configs ? configs.map(c => c.profile_id) : [];
        } else {
             profilesToProcess = [profile_id];
        }

        let stats = { nuevas: 0, causadas: 0, errores: 0, ms: 0 };

        for (const p_id of profilesToProcess) {
            const { data: config, error: configError } = await supabase
                .from('user_dian_config')
                .select('*')
                .eq('profile_id', p_id)
                .maybeSingle();

            if (configError || !config || !config.activo) {
                if (mode === 'single') return NextResponse.json({ error: 'Configuración DIAN no activa' }, { status: 400 });
                continue;
            }

            // ─── NODO B & C: Conectar a Proveedor y Consultar Docs (Simulación) ─────────────
            const facturasNuevas = await simularConsultaProveedor(config);

            // ─── NODO D: ¿Hay facturas nuevas sin procesar? ─────────────────────────────────
            if (facturasNuevas.length === 0) {
                // Nodo Z: Finalizar ciclo
                continue;
            }

            // ─── NODO E: Descargar XML masivamente ──────────────────────────────────────────
            for (const doc of facturasNuevas) {
                const xmlData = doc.xml;

                // ─── NODO F: Parsear XML UBL ────────────────────────────────────────────────
                const parser = new XMLParser();
                const jObj = parser.parse(xmlData);
                const invoice = jObj.Invoice;
                if (!invoice) continue;

                const cufe = invoice.UUID || `CUFE-${Date.now()}`;
                const numFactura = invoice.ID;
                const provNit = String(invoice.AccountingSupplierParty?.Party?.PartyTaxScheme?.CompanyID);
                const provNombre = invoice.AccountingSupplierParty?.Party?.PartyName?.Name;
                const fecha = invoice.IssueDate || new Date().toISOString().split('T')[0];
                const totalAmount = parseFloat(invoice.LegalMonetaryTotal?.PayableAmount || '0');
                
                const descripciones = Array.isArray(invoice.InvoiceLine) 
                    ? invoice.InvoiceLine.map((l: any) => l.Item?.Description).join(' | ') 
                    : invoice.InvoiceLine?.Item?.Description || 'Servicios Varios';

                // ─── NODO G: Aplicar Causación Automática ───────────────────────────────────
                const { estadoCausacion, nota, cuentas } = aplicarCausacion(provNit, descripciones, config.reglas_causacion);
                
                // ─── NODO I: Validar retenciones e impuestos ────────────────────────────────
                const base = parseFloat((totalAmount / 1.19).toFixed(2));
                const iva = parseFloat((totalAmount - base).toFixed(2));
                
                let retefuente = 0;
                let reteica = 0;
                if (cuentas.retefuente && cuentas.tasaReteFuente) retefuente = parseFloat((base * (cuentas.tasaReteFuente / 100)).toFixed(2));
                if (cuentas.reteica && cuentas.tasaReteIca) reteica = parseFloat((base * (cuentas.tasaReteIca / 100)).toFixed(2));

                const netoAPagar = parseFloat((totalAmount - retefuente - reteica).toFixed(2));

                // ─── NODO H: Generar Asiento Contable ───────────────────────────────────────
                let asiento = null;
                let finalEstado = 'pendiente';
                let validError = null;

                if (estadoCausacion === 'ok') {
                    asiento = {
                        detalles: [
                            { cuenta: cuentas.gasto, debito: base, credito: 0, descripcion: descripciones },
                            { cuenta: '2408', debito: iva, credito: 0, descripcion: 'IVA descontable' }
                        ]
                    };
                    if (retefuente > 0) asiento.detalles.push({ cuenta: cuentas.retefuente, debito: 0, credito: retefuente, descripcion: 'Retefuente' });
                    if (reteica > 0) asiento.detalles.push({ cuenta: cuentas.reteica, debito: 0, credito: reteica, descripcion: 'ReteICA' });
                    
                    asiento.detalles.push({ cuenta: cuentas.proveedor || '220501', debito: 0, credito: netoAPagar, descripcion: 'Cuentas por pagar' });

                    // Validar Partida Doble
                    const sumD = asiento.detalles.reduce((sum: number, d: any) => sum + d.debito, 0);
                    const sumC = asiento.detalles.reduce((sum: number, d: any) => sum + d.credito, 0);
                    if (Math.abs(sumD - sumC) > 2) { 
                        validError = `Descuadre contable (D: ${sumD} != C: ${sumC})`;
                    }
                } else {
                    validError = nota;
                }

                // ─── NODO J: ¿Error en causación? ───────────────────────────────────────────
                if (validError) {
                    // NODO K: Guardar en Pendientes + Enviar Alerta
                    finalEstado = 'pendiente';
                    stats.errores++;
                    console.log(`[ALERTA CAUSACIÓN] Error factura ${numFactura}: ${validError}`);
                } else {
                    // NODO L: Guardar en Libro Mayor (Estado Causado)
                    finalEstado = 'causado';
                    stats.causadas++;
                }

                const nuevaFactura = {
                    profile_id: p_id,
                    tipo: 'compra',
                    fuente: 'api',
                    estado: finalEstado,
                    fecha: fecha,
                    cufe: cufe,
                    numero_factura: numFactura,
                    nit_tercero: provNit,
                    nombre_tercero: provNombre || 'Proveedor No Identificado',
                    valor_base: base,
                    valor_iva: iva,
                    valor_retefuente: retefuente,
                    valor_reteica: reteica,
                    valor_neto: netoAPagar,
                    asiento: asiento,
                    // Se usa este campo u otro para log de errores si no existe error_log, podemos guardarlo en json interno o db
                };

                // Guardar en la tabla oficial 'causaciones'
                const { error: insertError } = await supabase.from('causaciones').insert(nuevaFactura);

                if (!insertError) {
                    stats.nuevas++;
                    if (!validError) {
                        // ─── NODO M: Enviar Acuse de Recibo a DIAN ──────────────────────────
                        await enviarAcuseDian(cufe, config);
                        
                        // ─── NODO N: Marcar como procesada ──────────────────────────────────
                        await supabase.from('user_dian_config').update({ last_sync: new Date().toISOString() }).eq('profile_id', p_id);
                    }
                }
            }

            // ─── NODO O: Notificar al contador por email ────────────────────────────────────
            if (stats.nuevas > 0 || stats.errores > 0) {
                console.log(`[EMAIL ENVIADO] Contador del perfil ${p_id} notificado: ${stats.nuevas} nuevas, ${stats.errores} errores.`);
            }
        }

        stats.ms = Date.now() - startMs;

        return NextResponse.json({ 
            success: true, 
            nuevas_sincronizadas: stats.nuevas,
            causadas: stats.causadas,
            errores: stats.errores,
            duration_ms: stats.ms
        });

    } catch (error: any) {
        console.error('Error en pipeline trigger:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICIOS Y AYUDANTES DE LOS NODOS
// ─────────────────────────────────────────────────────────────────────────────

async function simularConsultaProveedor(config: any) {
    const mockXmlData = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
    <Invoice>
        <ID>SETT-${Date.now().toString().slice(-5)}</ID>
        <IssueDate>${new Date().toISOString().split('T')[0]}</IssueDate>
        <UUID>CUFE-${Date.now()}-SIMULADO</UUID>
        <AccountingSupplierParty>
            <Party>
                <PartyName><Name>HOSTING PROVIDER SAS</Name></PartyName>
                <PartyTaxScheme><CompanyID>900111222</CompanyID></PartyTaxScheme>
            </Party>
        </AccountingSupplierParty>
        <LegalMonetaryTotal>
            <LineExtensionAmount>100000.00</LineExtensionAmount>
            <TaxExclusiveAmount>100000.00</TaxExclusiveAmount>
            <TaxInclusiveAmount>119000.00</TaxInclusiveAmount>
            <PayableAmount>119000.00</PayableAmount>
        </LegalMonetaryTotal>
        <InvoiceLine>
            <ID>1</ID>
            <Item><Description>Servicio de Servidor en la Nube Anual AWS</Description></Item>
        </InvoiceLine>
    </Invoice>`;
    
    return [ { id: 'ext-1', xml: mockXmlData } ];
}

function aplicarCausacion(nit: string, desc: string, reglas: any) {
    if (!reglas) return { estadoCausacion: 'error', cuentas: {}, nota: 'Sin reglas definidas (Configuración vacía)' };

    // 1. Prioridad: Matching por NIT
    if (reglas.nit_proveedor && Array.isArray(reglas.nit_proveedor)) {
        const match = reglas.nit_proveedor.find((r: any) => r.nit === nit);
        if (match) {
            return { 
                estadoCausacion: 'ok', 
                nota: 'Causación aplicada (Regla por NIT)',
                cuentas: {
                    gasto: match.cuenta_puc,
                    proveedor: reglas.defaults?.cuenta_proveedor || '220501',
                    retefuente: '236515', tasaReteFuente: match.concepto_retefuente === 'servicios' ? 4 : 11,
                    reteica: '2368', tasaReteIca: 0
                }
            };
        }
    }

    // 2. Prioridad: Matching por Palabras Clave en Descripción
    if (reglas.keywords && Array.isArray(reglas.keywords)) {
        const descLower = desc.toLowerCase();
        for (const kwGroup of reglas.keywords) {
            if (Array.isArray(kwGroup.keywords)) {
                const hasMatch = kwGroup.keywords.some((k: string) => descLower.includes(k.toLowerCase()));
                if (hasMatch) {
                    return {
                        estadoCausacion: 'ok',
                        nota: `Causación aplicada (Regla por Keyword: ${kwGroup.keywords[0]})`,
                        cuentas: {
                            gasto: kwGroup.cuenta_puc,
                            proveedor: reglas.defaults?.cuenta_proveedor || '220501',
                            retefuente: '236515', tasaReteFuente: 4,
                            reteica: '2368', tasaReteIca: 0
                        }
                    }
                }
            }
        }
    }

    // 3. Fallback a IA (simulado)
    if (reglas.usar_ia) {
        return { 
            estadoCausacion: 'error', 
            cuentas: {}, 
            nota: 'IA requerida: No hay reglas para este ítem. Revisión pendiente.' 
        };
    }

    return { estadoCausacion: 'error', cuentas: {}, nota: 'No se encontraron reglas coincidentes. Se requiere causación manual.' };
}

async function enviarAcuseDian(cufe: string, config: any) {
    // Mock Evento 030 a DIAN
    // fetch('https://api.proveedor.com/v1/dian/acuse', { ... })
    console.log(`[EVENTO DIAN] 030 (Acuse Recibo) enviado vía ${config.proveedor_tecnologico} para CUFE: ${cufe}`);
}
