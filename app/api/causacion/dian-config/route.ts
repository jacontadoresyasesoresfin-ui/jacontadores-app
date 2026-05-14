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
            .select('*')
            .eq('profile_id', profile_id)
            .maybeSingle();

        if (error) throw error;

        return NextResponse.json({ config: data || null });
    } catch (error: any) {
        console.error('Error fetching DIAN config:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const body = await req.json();
        const { profile_id, proveedor_tecnologico, nit_empresa, ambiente, api_key, api_secret, activo } = body;

        if (!profile_id || !proveedor_tecnologico || !nit_empresa) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        const payload: any = {
            profile_id,
            proveedor_tecnologico,
            nit_empresa,
            ambiente: ambiente || 'pruebas',
            activo: activo !== undefined ? activo : false,
            updated_at: new Date().toISOString()
        };

        if (api_key) payload.api_key = api_key;
        if (api_secret) payload.api_secret = api_secret;

        const { data, error } = await supabase
            .from('user_dian_config')
            .upsert(payload, { onConflict: 'profile_id' })
            .select('*')
            .single();

        if (error) throw error;

        return NextResponse.json({ ok: true, config: data });
    } catch (error: any) {
        console.error('Error saving DIAN config:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
