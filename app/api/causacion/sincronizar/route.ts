import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const body = await req.json();
        const { profile_id } = body;

        if (!profile_id) {
            return NextResponse.json({ error: 'profile_id es requerido' }, { status: 400 });
        }

        // Mock response to match UI expectations
        // data.nuevas, data.total_descargadas
        
        // Let's call the same internal mock logic or just return a mock response for now
        // In a real scenario, this would call the PT and insert into facturas_recibidas
        
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simula latencia
        
        return NextResponse.json({
            ok: true,
            nuevas: 2,
            total_descargadas: 2
        });

    } catch (error: any) {
        console.error('Error sincronizando DIAN:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
