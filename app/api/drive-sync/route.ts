import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: Request) {
    const pdfParse = require('pdf-parse');
    try {
        const body = await req.json();
        const { folderUrl, clientId } = body;

        if (!folderUrl) {
            return NextResponse.json({ error: 'Folder URL is required' }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ 
                error: 'GOOGLE_DRIVE_API_KEY no está configurada en .env.local. Por favor, añádela para conectar con Google Drive.' 
            }, { status: 500 });
        }

        // Extraer el Folder ID de la URL
        // Ej: https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345
        const folderIdMatch = folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
        const folderId = folderIdMatch ? folderIdMatch[1] : folderUrl; // fallback si pasaron directo el ID

        const drive = google.drive({ version: 'v3', auth: apiKey });

        // 1. Listar archivos PDF en la carpeta
        const listRes = await drive.files.list({
            q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
            fields: 'files(id, name, mimeType)',
            pageSize: 20 // Límite por ahora
        });

        const files = listRes.data.files || [];

        if (files.length === 0) {
            return NextResponse.json({ message: 'No se encontraron PDFs en esta carpeta', invoices: [] });
        }

        const invoicesData = [];

        // 2. Descargar y parsear cada PDF
        for (const file of files) {
            try {
                // Para descargar archivos usando API Key, se usa alt=media
                const fileRes = await drive.files.get({
                    fileId: file.id!,
                    alt: 'media'
                }, { responseType: 'arraybuffer' });

                const pdfBuffer = Buffer.from(fileRes.data as ArrayBuffer);

                // Extraer texto
                const pdfData = await pdfParse(pdfBuffer);
                const text = pdfData.text;

                // Extraer datos clave (Simulación de Regex para CUFE, NIT, Total)
                // CUFE (Suele ser un string largo alfanumérico)
                const cufeMatch = text.match(/CUFE[\s:]*([a-fA-F0-9]{30,})/i) || text.match(/([a-fA-F0-9]{95,})/);
                const cufe = cufeMatch ? cufeMatch[1] : `TEMP-CUFE-${file.id}`;

                // NIT (ej: 900.123.456-7 o 900123456)
                const nitMatch = text.match(/NIT[\s:\.]*([0-9\.-]+)/i);
                const nit = nitMatch ? nitMatch[1].replace(/[^0-9]/g, '') : '999999999';

                // Buscar un Total (ej: Total: $1.000.000)
                const totalMatch = text.match(/Total[^\d]*?([\d.,]+)/i);
                let total = 0;
                if (totalMatch) {
                    const numStr = totalMatch[1].replace(/\./g, '').replace(/,/g, '.');
                    total = parseFloat(numStr) || 0;
                }

                invoicesData.push({
                    driveFileId: file.id,
                    fileName: file.name,
                    cufe: cufe,
                    nit: nit,
                    total: total,
                    rawTextSnippet: text.substring(0, 100).replace(/\n/g, ' ')
                });

            } catch (err) {
                console.error(`Error parsing file ${file.name}:`, err);
                invoicesData.push({
                    driveFileId: file.id,
                    fileName: file.name,
                    error: 'Failed to extract text'
                });
            }
        }

        return NextResponse.json({
            message: `Procesados ${files.length} PDFs`,
            invoices: invoicesData
        });

    } catch (error: any) {
        console.error('Drive sync error:', error);
        return NextResponse.json({ error: error.message || 'Error processing drive folder' }, { status: 500 });
    }
}
