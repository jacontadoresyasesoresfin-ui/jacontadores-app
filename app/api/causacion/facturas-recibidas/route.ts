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
            .from('facturas_recibidas')
            .select('*')
            .eq('profile_id', profile_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ facturas: data || [] });
    } catch (error: any) {
        console.error('Error fetching facturas recibidas:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
