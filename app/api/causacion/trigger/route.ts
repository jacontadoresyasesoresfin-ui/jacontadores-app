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
        } catch(e) {
            // body parse error or empty body
        }

        // If no profile_id, check for auth or cron secret (auth not needed if we pass profile_id for now as this is internal API)
        if (!profile_id) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) profile_id = user.id;
        }

        if (!profile_id && mode !== 'all_active') {
            return NextResponse.json({ error: 'profile_id es requerido o debe enviar mode="all_active"' }, { status: 400 });
        }

        const startMs = Date.now();
        let profilesToProcess = [];

        if (mode === 'all_active') {
             // Cron job mode: get all active configs
             const { data: configs } = await supabase.from('user_dian_config').select('profile_id').eq('activo', true);
             profilesToProcess = configs ? configs.map(c => c.profile_id) : [];
        } else {
             profilesToProcess = [profile_id];
        }

        let totalNuevas = 0;
        let totalCausadas = 0;
        let totalErrores = 0;

        for (const p_id of profilesToProcess) {
            // 1. Obtener la configuración del tenant
            const { data: config, error: configError } = await supabase
                .from('user_dian_config')
                .select('*')
                .eq('profile_id', p_id)
                .maybeSingle();

            if (configError || !config || !config.activo) {
                if (mode === 'single') return NextResponse.json({ error: 'La causación automática no está configurada o activa para este usuario.' }, { status: 400 });
                continue;
            }

            // 2. Fetch de nuevas facturas del Proveedor Tecnológico (Mock)
            const mockXmlData = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
            <Invoice>
                <ID>SETT-${Date.now().toString().slice(-5)}</ID>
                <IssueDate>${new Date().toISOString().split('T')[0]}</IssueDate>
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
                    <InvoicedQuantity>1</InvoicedQuantity>
                    <LineExtensionAmount>100000.00</LineExtensionAmount>
                    <Item><Description>Servicio de Servidor en la Nube Anual</Description></Item>
                </InvoiceLine>
            </Invoice>`;

            // 3. Parsear el XML
            const parser = new XMLParser();
            const jObj = parser.parse(mockXmlData);
            
            const invoice = jObj.Invoice;
            const numFactura = invoice.ID;
            const provNit = invoice.AccountingSupplierParty?.Party?.PartyTaxScheme?.CompanyID;
            const provNombre = invoice.AccountingSupplierParty?.Party?.PartyName?.Name;
            const totalAmount = parseFloat(invoice.LegalMonetaryTotal?.PayableAmount || '0');
            const descripciones = Array.isArray(invoice.InvoiceLine) 
                ? invoice.InvoiceLine.map((l: any) => l.Item?.Description).join(' | ') 
                : invoice.InvoiceLine?.Item?.Description;

            // 4. Aplicar Reglas de Causación
            let asiento = null;
            let estado = 'pendiente';
            const reglas = config.reglas_causacion || [];

            // Reglas logic
            if (reglas.proveedor_nit && reglas.proveedor_nit[provNit]) {
                const r = reglas.proveedor_nit[provNit];
                estado = 'causada';
                asiento = {
                    detalles: [
                        { cuenta: r.cuenta_gasto, debito: totalAmount / 1.19, credito: 0, descripcion: descripciones },
                        { cuenta: '2408', debito: (totalAmount / 1.19) * 0.19, credito: 0, descripcion: 'IVA descontable' },
                        { cuenta: '2205', debito: 0, credito: totalAmount, descripcion: 'Proveedores Nacionales' }
                    ]
                };
            }

            if (!asiento) {
                estado = 'revision';
                asiento = {
                    nota: 'IA - Revisión sugerida',
                    detalles: [
                        { cuenta: '5305', debito: totalAmount / 1.19, credito: 0, descripcion: descripciones },
                        { cuenta: '2408', debito: (totalAmount / 1.19) * 0.19, credito: 0, descripcion: 'IVA descontable' },
                        { cuenta: '2205', debito: 0, credito: totalAmount, descripcion: 'Proveedores' }
                    ]
                };
            }

            // 5. Guardar
            const nuevaFactura = {
                profile_id: p_id,
                cufe: `CUFE-MOCK-${Date.now()}`,
                numero_factura: numFactura,
                proveedor_nit: String(provNit),
                proveedor_nombre: String(provNombre),
                fecha_emision: invoice.IssueDate || new Date().toISOString().split('T')[0],
                subtotal: totalAmount / 1.19,
                iva: (totalAmount / 1.19) * 0.19,
                total: totalAmount,
                xml_url: 'mock_url',
                estado: estado,
                asiento_contable_generado: asiento,
                fecha_causacion: estado === 'causada' ? new Date().toISOString() : null
            };

            const { error: insertError } = await supabase.from('facturas_recibidas').insert(nuevaFactura);

            if (insertError) {
                totalErrores++;
            } else {
                totalNuevas++;
                if (estado === 'causada') totalCausadas++;
            }

            await supabase.from('user_dian_config').update({ last_sync: new Date().toISOString() }).eq('profile_id', p_id);
        }

        return NextResponse.json({ 
            success: true, 
            nuevas_sincronizadas: totalNuevas,
            causadas: totalCausadas,
            errores: totalErrores,
            duration_ms: Date.now() - startMs
        });

    } catch (error: any) {
        console.error('Error in trigger:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
