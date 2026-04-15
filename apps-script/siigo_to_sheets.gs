// ============================================================
// SIIGO → GOOGLE SHEETS EXPORTER
// Versión: 2.0 — Para Ecomfin Dashboard
// Descripción: Extrae facturas de venta desde la API de Siigo
// y las escribe en la hoja "Facturas" del Spreadsheet activo.
//
// Columnas exportadas al Sheet:
//   Número Factura | Fecha | Fecha Vencimiento | Nombre Receptor |
//   NIT | Total | Subtotal | IVA | Saldo | Estado |
//   ReteFuente | ReteICA | Descripción | Método de Pago
//
// Cómo usar:
//   1. Abre tu Google Sheet
//   2. Extensiones → Apps Script → pega este código
//   3. Configura username y access_key en las constantes de abajo
//   4. Ejecuta exportarFacturasASiigo()
//   5. Opcional: crea un trigger diario/horario
// ============================================================

// ── CONFIGURACIÓN ─────────────────────────────────────────────
// Puedes hardcodear o usar PropertiesService para mayor seguridad
var SIIGO_USERNAME   = '';   // Tu usuario en Siigo (correo)
var SIIGO_ACCESS_KEY = '';   // Access Key de Siigo (no es la contraseña)

var HOJA_FACTURAS    = 'Facturas';   // Nombre de la pestaña en el Sheet
var DIAS_ATRAS       = 365;          // Cuántos días hacia atrás extraer

// ── CABECERAS (nombre exacto que lee el dashboard) ─────────────
var HEADERS = [
  'Número Factura',
  'Fecha',
  'Fecha Vencimiento',
  'Nombre Receptor',
  'NIT',
  'Total',
  'Subtotal',
  'IVA',
  'Saldo',
  'Estado',
  'ReteFuente',
  'ReteICA',
  'Descripción',
  'Método de Pago',
  'Ciudad Cliente'
];

// ── FUNCIÓN PRINCIPAL ──────────────────────────────────────────
function exportarFacturasASiigo() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var hoja   = obtenerOCrearHoja(ss, HOJA_FACTURAS);
  var token  = obtenerToken();

  var fechaFin    = new Date();
  var fechaInicio = new Date();
  fechaInicio.setDate(fechaInicio.getDate() - DIAS_ATRAS);

  var startDate = Utilities.formatDate(fechaInicio, 'GMT-5', 'yyyy-MM-dd');
  var endDate   = Utilities.formatDate(fechaFin,    'GMT-5', 'yyyy-MM-dd');

  Logger.log('Extrayendo facturas ' + startDate + ' → ' + endDate);

  // 1. Obtener todas las facturas
  var facturas = obtenerTodasLasFacturas(token, startDate, endDate);
  Logger.log('Total facturas obtenidas: ' + facturas.length);

  if (facturas.length === 0) {
    SpreadsheetApp.getUi().alert('No se encontraron facturas en el período seleccionado.');
    return;
  }

  // 2. Construir filas
  var filas = facturas.map(function(f) { return mapearFactura(f); });

  // 3. Escribir en el Sheet (limpiar y reescribir)
  hoja.clearContents();
  hoja.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  if (filas.length > 0) {
    hoja.getRange(2, 1, filas.length, HEADERS.length).setValues(filas);
  }

  // 4. Formato: cabeceras en negrita, congelar primera fila
  hoja.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  hoja.setFrozenRows(1);
  hoja.autoResizeColumns(1, HEADERS.length);

  Logger.log('✅ ' + filas.length + ' facturas exportadas a la hoja "' + HOJA_FACTURAS + '"');
  SpreadsheetApp.getUi().alert('✅ Exportación completa: ' + filas.length + ' facturas escritas en la hoja "' + HOJA_FACTURAS + '".');
}

// ── MAPEO DE FACTURA → FILA ────────────────────────────────────
function mapearFactura(f) {
  // Leer líneas de items para extraer descripción y retenciones
  var lineas      = f.items || [];
  var descripcion = lineas.length > 0 ? (lineas[0].description || lineas[0].name || '') : '';

  // ReteFuente y ReteICA vienen en los descuentos/retenciones de cada factura
  // En Siigo API v1 aparecen como `withholdings` dentro de cada factura
  var retenciones   = f.withholdings || [];
  var reteFuente    = 0;
  var reteICA       = 0;

  retenciones.forEach(function(r) {
    var nombre = (r.name || '').toLowerCase();
    var valor  = parseFloat(r.value || r.amount || 0);
    if (nombre.indexOf('fuente') !== -1 || nombre.indexOf('rtefte') !== -1) {
      reteFuente += valor;
    } else if (nombre.indexOf('ica') !== -1) {
      reteICA += valor;
    }
  });

  // Método de pago
  var metodoPago = '';
  var pagos = f.payments || [];
  if (pagos.length > 0 && pagos[0].payment_type) {
    metodoPago = pagos[0].payment_type.name || '';
  }

  // Ciudad del cliente
  var ciudadCliente = '';
  if (f.customer && f.customer.address && f.customer.address[0]) {
    ciudadCliente = f.customer.address[0].city || '';
  }

  // Nombre e identificación del cliente
  var nombreCliente = '';
  if (f.customer && f.customer.name) {
    nombreCliente = Array.isArray(f.customer.name)
      ? f.customer.name.join(' ')
      : f.customer.name;
  }
  var nit = (f.customer && f.customer.identification) ? f.customer.identification : '';

  // Fechas en formato DD-MM-YYYY para compatibilidad con el parser del dashboard
  var fecha           = formatearFechaCOP(f.date || '');
  var fechaVencimiento = formatearFechaCOP(f.due_date || '');

  return [
    f.name || f.number || f.id || '',    // Número Factura
    fecha,                                // Fecha
    fechaVencimiento,                     // Fecha Vencimiento
    nombreCliente,                        // Nombre Receptor
    nit,                                  // NIT
    parseFloat(f.total || 0),            // Total (con IVA)
    parseFloat(f.subtotal || 0),         // Subtotal (base sin IVA) ← REAL
    parseFloat(f.tax || 0),              // IVA ← REAL
    parseFloat(f.balance || 0),          // Saldo pendiente
    f.status || '',                       // Estado
    reteFuente,                           // ReteFuente ← REAL si Siigo lo devuelve
    reteICA,                              // ReteICA ← REAL si Siigo lo devuelve
    descripcion,                          // Descripción del producto/servicio
    metodoPago,                           // Método de Pago
    ciudadCliente                         // Ciudad del cliente
  ];
}

// ── OBTENER TODAS LAS PÁGINAS DE FACTURAS ─────────────────────
function obtenerTodasLasFacturas(token, startDate, endDate) {
  var todasLasFacturas = [];
  var pagina = 1;
  var maxPaginas = 50; // Aumentado vs. versión anterior (10 → 50)

  while (pagina <= maxPaginas) {
    var url = 'https://api.siigo.com/v1/invoices'
      + '?page_size=100'
      + '&page=' + pagina
      + '&created_start=' + startDate
      + '&created_end=' + endDate
      + '&document_types=FV';  // FV = Facturas de Venta

    var opciones = {
      'method': 'get',
      'headers': {
        'Authorization': 'Bearer ' + token,
        'Partner-Id': 'EcomfinDashboard2026'
      },
      'muteHttpExceptions': true
    };

    var respuesta = UrlFetchApp.fetch(url, opciones);
    var codigo    = respuesta.getResponseCode();

    if (codigo === 429) {
      // Rate limit: esperar 1 segundo y reintentar
      Logger.log('Rate limit alcanzado, esperando...');
      Utilities.sleep(1000);
      continue;
    }

    if (codigo !== 200) {
      Logger.log('Error API página ' + pagina + ': ' + respuesta.getContentText());
      break;
    }

    var json       = JSON.parse(respuesta.getContentText());
    var resultados = json.results || json;

    if (!resultados || resultados.length === 0) break;

    todasLasFacturas = todasLasFacturas.concat(resultados);
    Logger.log('Página ' + pagina + ': ' + resultados.length + ' facturas');

    // Verificar si hay más páginas
    if (!json.pagination || !json.pagination.next) break;

    pagina++;
    Utilities.sleep(200); // Pausa mínima entre páginas para no saturar la API
  }

  return todasLasFacturas;
}

// ── AUTENTICACIÓN ─────────────────────────────────────────────
function obtenerToken() {
  var cache  = CacheService.getScriptCache();
  var cached = cache.get('siigo_token_sheets');
  if (cached) return cached;

  // Prioritizar PropertiesService (más seguro que hardcodear)
  var props    = PropertiesService.getScriptProperties();
  var username = props.getProperty('SIIGO_USERNAME') || SIIGO_USERNAME;
  var key      = props.getProperty('SIIGO_ACCESS_KEY') || SIIGO_ACCESS_KEY;

  if (!username || !key) {
    throw new Error('⚠️ Configura SIIGO_USERNAME y SIIGO_ACCESS_KEY en las propiedades del script o en las constantes.');
  }

  var respuesta = UrlFetchApp.fetch('https://api.siigo.com/auth', {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify({ username: username, access_key: key }),
    'muteHttpExceptions': true
  });

  if (respuesta.getResponseCode() !== 200) {
    throw new Error('Error de autenticación Siigo: ' + respuesta.getContentText());
  }

  var token = JSON.parse(respuesta.getContentText()).access_token;
  cache.put('siigo_token_sheets', token, 82800); // 23 horas en segundos
  return token;
}

// ── HELPER: Formatear fecha a DD-MM-YYYY ──────────────────────
function formatearFechaCOP(fechaStr) {
  if (!fechaStr) return '';
  // Si ya viene en YYYY-MM-DD la convertimos
  var partes = fechaStr.substring(0, 10).split('-');
  if (partes.length === 3 && partes[0].length === 4) {
    return partes[2] + '-' + partes[1] + '-' + partes[0]; // DD-MM-YYYY
  }
  return fechaStr;
}

// ── HELPER: Obtener o crear hoja ──────────────────────────────
function obtenerOCrearHoja(ss, nombre) {
  var hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
    Logger.log('Hoja "' + nombre + '" creada.');
  }
  return hoja;
}

// ── TRIGGER AUTOMÁTICO: Configura actualización diaria ─────────
function crearTriggerDiario() {
  // Elimina triggers anteriores del mismo tipo para no duplicar
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'exportarFacturasASiigo') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Crear trigger a las 6:00 AM hora Colombia (GMT-5)
  ScriptApp.newTrigger('exportarFacturasASiigo')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .inTimezone('America/Bogota')
    .create();

  Logger.log('✅ Trigger diario creado: se ejecutará todos los días a las 6:00 AM (Bogotá).');
}

// ── MENÚ PERSONALIZADO al abrir el Sheet ──────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔄 Siigo Sync')
    .addItem('Exportar facturas ahora', 'exportarFacturasASiigo')
    .addSeparator()
    .addItem('Crear trigger diario (6 AM)', 'crearTriggerDiario')
    .addToUi();
}
