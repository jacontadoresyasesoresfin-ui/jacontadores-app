import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const body = await req.json();
        const { profile_id, ids, fuente } = body;

        if (!profile_id || !ids || !Array.isArray(ids)) {
            return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
        }

        if (fuente === 'recibida') {
            const { error } = await supabase
                .from('facturas_recibidas')
                .update({ estado: 'causada', fecha_causacion: new Date().toISOString() })
                .in('id', ids)
                .eq('profile_id', profile_id);

            if (error) throw error;
        }

        return NextResponse.json({
            ok: true,
            exitosos: ids.length,
            errores: 0
        });

    } catch (error: any) {
        console.error('Error al causar facturas:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
