import puppeteer, { Browser, Page, CDPSession } from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import os from 'os';
import http from 'http';

function getExecutablePath(): string {
    const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        '/usr/bin/google-chrome',
    ];
    for (const p of chromePaths) {
        if (fs.existsSync(p)) return p;
    }
    return chromePaths[0];
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let globalBrowser: Browser | null = null;
let sharedPage: Page | null = null;
let sharedClient: CDPSession | null = null;
let closeTimeout: NodeJS.Timeout | null = null;
let activeRequests = 0;

async function getBrowser(): Promise<Browser> {
    if (globalBrowser) {
        try { await globalBrowser.version(); return globalBrowser; }
        catch { globalBrowser = null; sharedPage = null; sharedClient = null; }
    }

    // Intentar conectarse al Chrome real del usuario (puerto 9222)
    try {
        const endpoint = await new Promise<string>((resolve, reject) => {
            const req = http.get('http://127.0.0.1:9222/json/version', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data).webSocketDebuggerUrl); }
                    catch { reject(new Error('parse error')); }
                });
            });
            req.on('error', reject);
            req.setTimeout(1500, () => { req.destroy(); reject(new Error('timeout')); });
        });

        if (endpoint) {
            console.log('[RPA] Conectado al Chrome del usuario via puerto 9222');
            globalBrowser = await puppeteer.connect({ browserWSEndpoint: endpoint, defaultViewport: null });
            return globalBrowser;
        }
    } catch {
        console.log('[RPA] Abriendo Chrome propio...');
    }

    const userDataDir = path.join(os.tmpdir(), 'dian_rpa_profile');
    fs.mkdirSync(userDataDir, { recursive: true });
    globalBrowser = await puppeteer.launch({
        headless: false,
        executablePath: getExecutablePath(),
        userDataDir,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });
    return globalBrowser;
}

async function getPageAndClient(browser: Browser): Promise<{ page: Page; client: CDPSession }> {
    if (sharedPage && !sharedPage.isClosed() && sharedClient) {
        return { page: sharedPage, client: sharedClient };
    }

    sharedPage = await browser.newPage();
    sharedPage.setDefaultNavigationTimeout(90000);
    sharedPage.setDefaultTimeout(30000);
    sharedPage.on('dialog', async dialog => { await dialog.accept().catch(() => {}); });

    sharedClient = await sharedPage.createCDPSession();

    // CLAVE: Habilitar la interceptacion de red a nivel CDP
    // Esto nos permite capturar el PDF directamente de la respuesta HTTP
    // sin necesidad de que Chrome lo guarde en disco
    await sharedClient.send('Fetch.enable', {
        patterns: [
            { urlPattern: '*', requestStage: 'Response' }
        ]
    });

    // Handler que captura TODAS las respuestas de red
    // Las PDFs se quedan en un buffer que consultamos cuando hacemos clic
    sharedClient.on('Fetch.requestPaused', async (event) => {
        const { requestId, responseHeaders, resourceType } = event;
        try {
            const contentType = (responseHeaders || []).find(
                (h: any) => h.name.toLowerCase() === 'content-type'
            )?.value || '';

            // Si es un PDF, guardarlo en el buffer global
            if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
                console.log('[RPA] PDF detectado en red: ' + event.request.url.substring(0, 80));
                try {
                    const body = await sharedClient!.send('Fetch.getResponseBody', { requestId });
                    if (body?.body) {
                        pendingPdfBase64 = body.base64Encoded ? body.body : Buffer.from(body.body).toString('base64');
                        console.log('[RPA] PDF capturado en memoria (' + Math.round(pendingPdfBase64.length * 0.75 / 1024) + ' KB)');
                    }
                } catch {}
            }
            // Continuar la request para que Chrome no se bloquee
            await sharedClient!.send('Fetch.continueResponse', { requestId }).catch(() => {});
        } catch {
            await sharedClient!.send('Fetch.continueResponse', { requestId }).catch(() => {});
        }
    });

    return { page: sharedPage, client: sharedClient };
}

// Buffer global donde se almacena el PDF capturado de la red
let pendingPdfBase64: string | null = null;

async function clickTurnstile(page: Page): Promise<boolean> {
    try {
        const iframes = await page.$$('iframe[src*="challenges.cloudflare.com"]');
        let clicked = false;
        for (const iframe of iframes) {
            const box = await iframe.boundingBox();
            if (box && box.width > 0 && box.height > 10) {
                await page.mouse.click(box.x + 25, box.y + box.height / 2);
                clicked = true;
                await sleep(500);
            }
        }
        return clicked;
    } catch { return false; }
}

async function waitForTurnstileToken(page: Page, timeoutMs = 20000): Promise<boolean> {
    try {
        await page.waitForFunction(
            () => {
                const input = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
                return input?.value?.length > 10;
            },
            { timeout: timeoutMs }
        );
        return true;
    } catch { return false; }
}

/**
 * Detecta el mensaje "Solicitud bloqueada por controles de seguridad" de la DIAN
 * y hace reload periodicamente hasta que el sitio vuelva a funcionar.
 * Usa backoff exponencial: espera 15s, 30s, 60s, 120s... entre intentos.
 */
async function waitUntilUnblocked(page: Page): Promise<void> {
    const BLOCK_PHRASES = [
        'solicitud bloqueada',
        'blocked by security',
        'controles de seguridad',
        'access denied',
        'acceso denegado',
        'too many requests',
        'rate limit',
    ];

    let attempt = 0;
    const MAX_WAIT_MS = 180000; // Maximo 3 minutos de espera total

    while (true) {
        const bodyText = await page.evaluate(() => document.body?.innerText?.toLowerCase() || '').catch(() => '');
        const isBlocked = BLOCK_PHRASES.some(phrase => bodyText.includes(phrase));

        if (!isBlocked) break; // Sitio disponible, continuar

        attempt++;
        const waitMs = Math.min(15000 * attempt, MAX_WAIT_MS); // 15s, 30s, 45s... hasta 3 min
        console.log('[RPA] Bloqueo de seguridad detectado. Esperando ' + (waitMs / 1000) + 's antes de reintentar (intento ' + attempt + ')...');

        await sleep(waitMs);

        // Recargar la pagina para salir del bloqueo
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await sleep(2000);

        if (waitMs >= MAX_WAIT_MS) {
            console.warn('[RPA] Timeout de espera por bloqueo superado. Continuando de todos modos...');
            break;
        }
    }
}

/**
 * Descarga el PDF de la DIAN para un CUFE dado.
 * Estrategia: interceptar el PDF directamente de la red via CDP,
 * sin depender de archivos en disco ni dialogos de descarga.
 * Si la intercepcion de red no captura el PDF (ej: es un blob URL),
 * caemos de vuelta a buscar el archivo en disco.
 */
export async function downloadDianPdf(cufe: string): Promise<string> {
    activeRequests++;
    if (closeTimeout) { clearTimeout(closeTimeout); closeTimeout = null; }

    const browser = await getBrowser();
    const { page } = await getPageAndClient(browser);

    // Limpiar cualquier PDF pendiente del ciclo anterior
    pendingPdfBase64 = null;

    try {
        // Paso 1: Navegar a la pagina del documento
        console.log('[RPA] (' + cufe.substring(0, 10) + '...) Navegando...');
        const url = 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=' + cufe;
        await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});

        // ANTI-BLOQUEO: Verificar y esperar si la DIAN mostro mensaje de seguridad
        await waitUntilUnblocked(page);

        // Paso 2: Manejar PRIMER Captcha (formulario de busqueda)
        await sleep(2000);
        const hasSearchForm = await page.$('.search-document').then(el => !!el).catch(() => false);
        if (hasSearchForm) {
            console.log('[RPA] Primer captcha, haciendo clic en Turnstile...');
            await clickTurnstile(page);
            await waitForTurnstileToken(page, 20000);
            await page.$('.search-document').then(btn => btn?.click()).catch(() => {});
            await sleep(1000);
        }

        // Paso 3: Esperar EXACTAMENTE 6 segundos para que cargue la segunda pantalla
        console.log('[RPA] Esperando 6 segundos para segundo captcha...');
        await sleep(6000);

        // Paso 4: Manejar SEGUNDO Captcha (pagina de detalle del documento)
        const clickedSecond = await clickTurnstile(page);
        if (clickedSecond) {
            console.log('[RPA] Segundo captcha, haciendo clic...');
            await waitForTurnstileToken(page, 20000);
            await sleep(3000);
        }

        // Paso 5: Esperar el boton exacto de la DIAN
        // HTML real: <a href="javascript:void(0);" class="downloadLink"><i class="fa fa-download"></i> Descargar PDF</a>
        console.log('[RPA] Esperando boton .downloadLink...');
        await page.waitForSelector('a.downloadLink', { timeout: 40000 }).catch(() => {
            console.warn('[RPA] Selector .downloadLink no aparecio, continuando...');
        });

        // ANTI-BLOQUEO: Verificar que no haya mensaje de bloqueo antes de intentar descargar
        await waitUntilUnblocked(page);
        await sleep(500);

        // Paso 6: Marcar el tiempo antes del clic para detectar archivos nuevos en disco (fallback)
        const startTime = Date.now();
        pendingPdfBase64 = null; // Resetear buffer de red

        // Paso 7: Hacer clic en el boton de descarga
        const clicked = await page.evaluate(() => {
            // Estrategia 1: clase downloadLink con texto pdf
            for (const link of Array.from(document.querySelectorAll('a.downloadLink'))) {
                if ((link as HTMLElement).innerText?.toLowerCase().includes('pdf')) {
                    (link as HTMLElement).click();
                    return 'downloadLink-pdf';
                }
            }
            // Estrategia 2: icono fa-download + texto pdf
            for (const a of Array.from(document.querySelectorAll('a'))) {
                const hasIcon = !!(a as HTMLElement).querySelector('i.fa-download, i.fa.fa-download');
                if (hasIcon && a.innerText?.toLowerCase().includes('pdf')) {
                    (a as HTMLElement).click();
                    return 'fa-download-pdf';
                }
            }
            // Estrategia 3: texto "Descargar PDF"
            for (const a of Array.from(document.querySelectorAll('a'))) {
                if (a.innerText?.trim().toLowerCase().includes('descargar pdf')) {
                    (a as HTMLElement).click();
                    return 'text-descargar-pdf';
                }
            }
            return null;
        }).catch(() => null);

        console.log('[RPA] Clic: ' + (clicked || 'NO ENCONTRADO'));

        // Paso 8: Esperar el PDF - METODO 1: intercepcion de red (preferido)
        console.log('[RPA] Esperando PDF via red o disco...');
        let base64: string | null = null;

        // Esperar hasta 30s que el interceptor de red capture el PDF
        const netDeadline = Date.now() + 30000;
        while (Date.now() < netDeadline && !pendingPdfBase64) {
            await sleep(500);
        }

        if (pendingPdfBase64) {
            console.log('[RPA] PDF obtenido via intercepcion de red.');
            base64 = pendingPdfBase64;
            pendingPdfBase64 = null;
        }

        // Paso 8b: METODO 2 fallback - buscar en disco si la red no lo capturo
        if (!base64) {
            console.log('[RPA] Red no capturo PDF, buscando en disco...');
            base64 = await waitForDownloadedFileBase64(startTime, 60000);
        }

        if (!base64) {
            throw new Error('No se pudo obtener el PDF por ninguna via (red ni disco).');
        }

        console.log('[RPA] PDF listo - ' + Math.round(base64.length * 0.75 / 1024) + ' KB');
        return base64;

    } catch (err: any) {
        console.error('[RPA] Error: ' + err.message);
        throw new Error('Fallo RPA para CUFE ' + cufe.substring(0, 12) + '...: ' + err.message);

    } finally {
        // SIEMPRE: clic en Volver para limpiar la sesion para el siguiente CUFE
        // HTML exacto: <a href="/User/SearchDocument" style="...">Volver</a>
        if (sharedPage && !sharedPage.isClosed()) {
            await sharedPage.evaluate(() => {
                const exactVolver = document.querySelector('a[href="/User/SearchDocument"]') as HTMLElement;
                if (exactVolver) { exactVolver.click(); return true; }
                for (const el of Array.from(document.querySelectorAll('a, button'))) {
                    const text = (el as HTMLElement).innerText?.toLowerCase().trim();
                    if (text === 'volver' || text === 'regresar') {
                        (el as HTMLElement).click();
                        return true;
                    }
                }
                return false;
            }).catch(() => {});
            await sleep(2500);
            console.log('[RPA] Volver OK - listo para el siguiente CUFE.');
        }

        activeRequests--;
        if (activeRequests <= 0) {
            activeRequests = 0;
            closeTimeout = setTimeout(async () => {
                if (globalBrowser) {
                    if (globalBrowser.process() !== null) { await globalBrowser.close().catch(() => {}); }
                    else { globalBrowser.disconnect(); }
                    globalBrowser = null;
                    sharedPage = null;
                    sharedClient = null;
                }
            }, 120000);
        }
    }
}

async function waitForDownloadedFileBase64(startTime: number, timeoutMs: number): Promise<string | null> {
    const folders = [
        path.join(os.homedir(), 'Downloads'),
        path.join(os.homedir(), 'Desktop'),
        path.join(os.homedir(), 'Documents'),
        os.tmpdir(),
    ];
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        for (const folder of folders) {
            if (!fs.existsSync(folder)) continue;
            const candidates: Array<{ path: string; mtime: number }> = [];
            try {
                for (const f of fs.readdirSync(folder)) {
                    if (!f.toLowerCase().endsWith('.pdf')) continue;
                    if (f.endsWith('.crdownload') || f.endsWith('.tmp') || f.endsWith('.part')) continue;
                    const fp = path.join(folder, f);
                    try {
                        const stat = fs.statSync(fp);
                        if (stat.mtimeMs >= startTime - 2000) candidates.push({ path: fp, mtime: stat.mtimeMs });
                    } catch {}
                }
            } catch {}

            candidates.sort((a, b) => b.mtime - a.mtime);
            for (const c of candidates) {
                try {
                    const s1 = fs.statSync(c.path);
                    if (s1.size === 0) continue;
                    await sleep(800);
                    const s2 = fs.statSync(c.path);
                    if (s2.size > 0 && s2.size === s1.size) {
                        const fd = fs.openSync(c.path, 'r');
                        fs.closeSync(fd);
                        const b64 = fs.readFileSync(c.path).toString('base64');
                        try { fs.unlinkSync(c.path); } catch {}
                        return b64;
                    }
                } catch {}
            }
        }
        await sleep(1000);
    }
    return null;
}
