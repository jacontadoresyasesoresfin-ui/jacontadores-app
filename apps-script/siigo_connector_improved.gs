// ============================================
// SIIGO COMMUNITY CONNECTOR - VERSIÓN MEJORADA
// Para Looker Studio (Google Data Studio)
// ============================================

var cc = DataStudioApp.createCommunityConnector();

// ============================================
// AUTENTICACIÓN
// ============================================

function getAuthType() {
  return cc.newAuthTypeResponse()
    .setAuthType(cc.AuthType.USER_PASS)
    .setHelpUrl('https://siigoapi.docs.apiary.io/#introduction/autenticacion')
    .build();
}

function isAuthValid() {
  try {
    getToken();
    return true;
  } catch (e) {
    Logger.log('Auth validation failed: ' + e.message);
    return false;
  }
}

function resetAuth() {
  PropertiesService.getUserProperties().deleteAllProperties();
  CacheService.getUserCache().remove('siigo_token');
}

function setCredentials(request) {
  var props = PropertiesService.getUserProperties();
  props.setProperty('siigo.username', request.userPass.username);
  props.setProperty('siigo.access_key', request.userPass.password);
  
  try {
    getToken();
    return { errorCode: 'NONE' };
  } catch (e) {
    Logger.log('Credential validation failed: ' + e.message);
    return { errorCode: 'INVALID_CREDENTIALS' };
  }
}

// ============================================
// CONFIGURACIÓN
// ============================================

function getConfig(request) {
  var config = cc.getConfig();
  
  config.newInfo()
    .setId('info')
    .setText('Conector de Siigo para Ecomfin. Ingresa Username y Access Key de Siigo.');
  
  config.newSelectSingle()
    .setId('endpoint')
    .setName('Tipo de Datos')
    .setHelpText('Selecciona qué datos deseas extraer de Siigo')
    .addOption(config.newOption().setLabel('Clientes/Terceros').setValue('customers'))
    .addOption(config.newOption().setLabel('Facturas de Venta').setValue('invoices'))
    .addOption(config.newOption().setLabel('Productos').setValue('products'))
    .addOption(config.newOption().setLabel('Pagos Recibidos').setValue('payments'))
    .addOption(config.newOption().setLabel('Cuentas por Cobrar').setValue('account-receivable'));
  
  // Filtros de fecha (opcional)
  config.newTextInput()
    .setId('start_date')
    .setName('Fecha Inicio (opcional)')
    .setHelpText('Formato: YYYY-MM-DD')
    .setPlaceholder('2024-01-01');
    
  config.newTextInput()
    .setId('end_date')
    .setName('Fecha Fin (opcional)')
    .setHelpText('Formato: YYYY-MM-DD')
    .setPlaceholder('2024-12-31');
  
  return config.build();
}

// ============================================
// ESQUEMA DE DATOS
// ============================================

function getSchema(request) {
  var endpoint = request.configParams.endpoint || 'customers';
  var fields = cc.getFields();
  var types = cc.FieldType;
  
  switch(endpoint) {
    case 'customers':
      fields.newDimension().setId('id').setName('ID Cliente').setType(types.TEXT);
      fields.newDimension().setId('name').setName('Nombre').setType(types.TEXT);
      fields.newDimension().setId('identification').setName('NIT/Identificación').setType(types.TEXT);
      fields.newDimension().setId('email').setName('Email').setType(types.TEXT);
      fields.newDimension().setId('phone').setName('Teléfono').setType(types.TEXT);
      fields.newDimension().setId('city').setName('Ciudad').setType(types.TEXT);
      fields.newDimension().setId('type').setName('Tipo Cliente').setType(types.TEXT);
      break;
      
    case 'invoices':
      fields.newDimension().setId('id').setName('ID Factura').setType(types.TEXT);
      fields.newDimension().setId('number').setName('Número Factura').setType(types.TEXT);
      fields.newDimension().setId('date').setName('Fecha').setType(types.YEAR_MONTH_DAY);
      fields.newDimension().setId('due_date').setName('Fecha Vencimiento').setType(types.YEAR_MONTH_DAY);
      fields.newMetric().setId('total').setName('Total').setType(types.CURRENCY_COP);
      fields.newMetric().setId('subtotal').setName('Subtotal').setType(types.CURRENCY_COP);
      fields.newMetric().setId('tax').setName('IVA').setType(types.CURRENCY_COP);
      fields.newMetric().setId('balance').setName('Saldo Pendiente').setType(types.CURRENCY_COP);
      fields.newDimension().setId('customer_name').setName('Cliente').setType(types.TEXT);
      fields.newDimension().setId('status').setName('Estado').setType(types.TEXT);
      break;
      
    case 'products':
      fields.newDimension().setId('id').setName('ID Producto').setType(types.TEXT);
      fields.newDimension().setId('code').setName('Código').setType(types.TEXT);
      fields.newDimension().setId('name').setName('Nombre').setType(types.TEXT);
      fields.newDimension().setId('description').setName('Descripción').setType(types.TEXT);
      fields.newMetric().setId('price').setName('Precio').setType(types.CURRENCY_COP);
      fields.newMetric().setId('stock').setName('Stock').setType(types.NUMBER);
      fields.newDimension().setId('category').setName('Categoría').setType(types.TEXT);
      fields.newDimension().setId('active').setName('Activo').setType(types.BOOLEAN);
      break;
      
    case 'payments':
      fields.newDimension().setId('id').setName('ID Pago').setType(types.TEXT);
      fields.newDimension().setId('date').setName('Fecha Pago').setType(types.YEAR_MONTH_DAY);
      fields.newMetric().setId('amount').setName('Monto').setType(types.CURRENCY_COP);
      fields.newDimension().setId('payment_method').setName('Método de Pago').setType(types.TEXT);
      fields.newDimension().setId('invoice_number').setName('Número Factura').setType(types.TEXT);
      fields.newDimension().setId('customer_name').setName('Cliente').setType(types.TEXT);
      break;
      
    case 'account-receivable':
      fields.newDimension().setId('invoice_id').setName('ID Factura').setType(types.TEXT);
      fields.newDimension().setId('invoice_number').setName('Número Factura').setType(types.TEXT);
      fields.newDimension().setId('customer_name').setName('Cliente').setType(types.TEXT);
      fields.newDimension().setId('due_date').setName('Fecha Vencimiento').setType(types.YEAR_MONTH_DAY);
      fields.newMetric().setId('balance').setName('Saldo').setType(types.CURRENCY_COP);
      fields.newMetric().setId('days_overdue').setName('Días Vencidos').setType(types.NUMBER);
      break;
  }
  
  return { schema: fields.build() };
}

// ============================================
// OBTENCIÓN DE DATOS
// ============================================

function getData(request) {
  var endpoint = request.configParams.endpoint || 'customers';
  var startDate = request.configParams.start_date;
  var endDate = request.configParams.end_date;
  var requestedFields = request.fields.map(function(field) { return field.name; });
  
  try {
    var token = getToken();
    var url = buildUrl(endpoint, startDate, endDate);
    var data = getAllPages(url, token);
    
    Logger.log('Fetched ' + data.length + ' records from ' + endpoint);
    
    var rows = data.map(function(item) {
      return { values: mapDataToFields(item, endpoint, requestedFields) };
    });
    
    return {
      schema: getSchema(request).schema,
      rows: rows,
      filtersApplied: false
    };
    
  } catch (e) {
    Logger.log('Error in getData: ' + e.message + '\nStack: ' + e.stack);
    cc.newUserError()
      .setDebugText('Error details: ' + e.stack)
      .setText('Error al obtener datos de Siigo: ' + e.message)
      .throwException();
  }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function buildUrl(endpoint, startDate, endDate) {
  var url = 'https://api.siigo.com/v1/' + endpoint + '?page_size=100';
  
  if (startDate && endpoint === 'invoices') {
    url += '&created_start=' + startDate;
  }
  if (endDate && endpoint === 'invoices') {
    url += '&created_end=' + endDate;
  }
  
  return url;
}

function getAllPages(baseUrl, token) {
  var allData = [];
  var page = 1;
  var maxPages = 10; // Límite de seguridad
  
  while (page <= maxPages) {
    var url = baseUrl + '&page=' + page;
    var options = {
      'method': 'get',
      'headers': {
        'Authorization': 'Bearer ' + token,
        'Partner-Id': 'EcomfinDashboard2026'
      },
      'muteHttpExceptions': true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() !== 200) {
      throw new Error('API error (' + response.getResponseCode() + '): ' + response.getContentText());
    }
    
    var jsonData = JSON.parse(response.getContentText());
    var results = jsonData.results || jsonData;
    
    if (!results || results.length === 0) {
      break;
    }
    
    allData = allData.concat(results);
    
    // Si no hay paginación o es la última página
    if (!jsonData.pagination || !jsonData.pagination.next) {
      break;
    }
    
    page++;
  }
  
  return allData;
}

function mapDataToFields(item, endpoint, requestedFields) {
  return requestedFields.map(function(field) {
    switch(endpoint) {
      case 'customers':
        return mapCustomerField(item, field);
      case 'invoices':
        return mapInvoiceField(item, field);
      case 'products':
        return mapProductField(item, field);
      case 'payments':
        return mapPaymentField(item, field);
      case 'account-receivable':
        return mapAccountReceivableField(item, field);
      default:
        return '';
    }
  });
}

function mapCustomerField(item, field) {
  switch(field) {
    case 'id': return item.id || '';
    case 'name': return Array.isArray(item.name) ? item.name.join(' ') : item.name || '';
    case 'identification': return item.identification || '';
    case 'email': return (item.contacts && item.contacts[0]) ? item.contacts[0].email : '';
    case 'phone': return (item.contacts && item.contacts[0]) ? item.contacts[0].phone : '';
    case 'city': return (item.address && item.address[0]) ? item.address[0].city : '';
    case 'type': return item.person_type || '';
    default: return '';
  }
}

function mapInvoiceField(item, field) {
  switch(field) {
    case 'id': return item.id || '';
    case 'number': return item.number || item.name || '';
    case 'date': return item.date || '';
    case 'due_date': return item.due_date || '';
    case 'total': return item.total || 0;
    case 'subtotal': return item.subtotal || 0;
    case 'tax': return item.tax || 0;
    case 'balance': return item.balance || 0;
    case 'customer_name': return (item.customer && item.customer.name) ? 
      (Array.isArray(item.customer.name) ? item.customer.name.join(' ') : item.customer.name) : '';
    case 'status': return item.status || '';
    default: return '';
  }
}

function mapProductField(item, field) {
  switch(field) {
    case 'id': return item.id || '';
    case 'code': return item.code || '';
    case 'name': return item.name || '';
    case 'description': return item.description || '';
    case 'price': return (item.prices && item.prices[0]) ? item.prices[0].price_list[0].value : 0;
    case 'stock': return item.available_quantity || 0;
    case 'category': return (item.category && item.category.name) ? item.category.name : '';
    case 'active': return item.active || false;
    default: return '';
  }
}

function mapPaymentField(item, field) {
  switch(field) {
    case 'id': return item.id || '';
    case 'date': return item.date || '';
    case 'amount': return item.value || 0;
    case 'payment_method': return (item.payment_type && item.payment_type.name) ? item.payment_type.name : '';
    case 'invoice_number': return (item.invoice && item.invoice.name) ? item.invoice.name : '';
    case 'customer_name': return (item.customer && item.customer.name) ? 
      (Array.isArray(item.customer.name) ? item.customer.name.join(' ') : item.customer.name) : '';
    default: return '';
  }
}

function mapAccountReceivableField(item, field) {
  switch(field) {
    case 'invoice_id': return item.invoice_id || '';
    case 'invoice_number': return item.invoice_number || '';
    case 'customer_name': return item.customer_name || '';
    case 'due_date': return item.due_date || '';
    case 'balance': return item.balance || 0;
    case 'days_overdue': return item.days_overdue || 0;
    default: return '';
  }
}

function getToken() {
  var cache = CacheService.getUserCache();
  var cachedToken = cache.get('siigo_token');
  
  if (cachedToken) {
    return cachedToken;
  }
  
  var props = PropertiesService.getUserProperties();
  var username = props.getProperty('siigo.username');
  var access_key = props.getProperty('siigo.access_key');
  
  if (!username || !access_key) {
    throw new Error('No hay credenciales configuradas. Por favor, configura Username y Access Key.');
  }
  
  var url = 'https://api.siigo.com/auth';
  var payload = JSON.stringify({ 
    username: username, 
    access_key: access_key 
  });
  
  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': payload,
    'muteHttpExceptions': true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  
  if (response.getResponseCode() !== 200) {
    throw new Error('Error de autenticación: ' + response.getContentText());
  }
  
  var json = JSON.parse(response.getContentText());
  var token = json.access_token;
  
  // Cache por ~23 horas (1430 minutos)
  cache.put('siigo_token', token, 1430 * 60);
  
  Logger.log('Token obtenido y cacheado exitosamente');
  
  return token;
}
