import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: Request) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(req.url);
        const profile_id = searchParams.get('profile_id');
        
        if (!profile_id) {
            return NextResponse.json({ error: 'profile_id es requerido' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('user_dian_config')
            .select('reglas_causacion')
            .eq('profile_id', profile_id)
            .maybeSingle();

        if (error) throw error;

        return NextResponse.json({ 
            reglas: [{ reglas: data?.reglas_causacion || {} }],
            defaults: {
                "descripcion_contiene": {
                    "hosting": { "cuenta_gasto": "530520", "tasa_retefuente": 4 },
                    "internet": { "cuenta_gasto": "530520", "tasa_retefuente": 4 }
                },
                "proveedor_nit": {
                    "900123456": { "cuenta_gasto": "143501", "tasa_retefuente": 2.5 }
                }
            }
        });
    } catch (error: any) {
        console.error('Error fetching reglas:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const body = await req.json();
        const { profile_id, reglas } = body;

        if (!profile_id || !reglas) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        const { error } = await supabase
            .from('user_dian_config')
            .update({ reglas_causacion: reglas })
            .eq('profile_id', profile_id);

        if (error) throw error;

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('Error saving reglas:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
