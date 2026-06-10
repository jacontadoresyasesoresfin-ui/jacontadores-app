import { NextRequest, NextResponse } from 'next/server';
import { downloadDianPdf } from '@/lib/causacion/dian-scraper';

export const maxDuration = 300; // Allows up to 5 minutes on Vercel Pro

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { cufe } = body;

        if (!cufe) {
            return NextResponse.json({ error: 'Falta el parámetro cufe' }, { status: 400 });
        }

        console.log(`[RPA] Iniciando extracción de PDF para el CUFE: ${cufe}`);
        const base64Pdf = await downloadDianPdf(cufe);

        return NextResponse.json({ 
            success: true, 
            base64: base64Pdf,
            filename: `DIAN_${cufe}.pdf`
        });

    } catch (error: any) {
        console.error('[RPA] Error DIAN:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
