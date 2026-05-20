/**
 * Códigos DIVIPOLA — División Político-Administrativa de Colombia
 * Fuente: DANE — Resolución 0166 de 1994 y actualizaciones
 * Usados en la información exógena DIAN (departamento y municipio)
 */

export interface DivisionPolitica {
  codigo: string
  nombre: string
  tipo: 'departamento' | 'municipio'
  codigoDepto?: string   // para municipios: código del departamento
}

export const DEPARTAMENTOS: Record<string, string> = {
  '05': 'ANTIOQUIA',
  '08': 'ATLÁNTICO',
  '11': 'BOGOTÁ D.C.',
  '13': 'BOLÍVAR',
  '15': 'BOYACÁ',
  '17': 'CALDAS',
  '18': 'CAQUETÁ',
  '19': 'CAUCA',
  '20': 'CESAR',
  '23': 'CÓRDOBA',
  '25': 'CUNDINAMARCA',
  '27': 'CHOCÓ',
  '41': 'HUILA',
  '44': 'LA GUAJIRA',
  '47': 'MAGDALENA',
  '50': 'META',
  '52': 'NARIÑO',
  '54': 'NORTE DE SANTANDER',
  '63': 'QUINDÍO',
  '66': 'RISARALDA',
  '68': 'SANTANDER',
  '70': 'SUCRE',
  '73': 'TOLIMA',
  '76': 'VALLE DEL CAUCA',
  '81': 'ARAUCA',
  '85': 'CASANARE',
  '86': 'PUTUMAYO',
  '88': 'ARCHIPIÉLAGO DE SAN ANDRÉS',
  '91': 'AMAZONAS',
  '94': 'GUAINÍA',
  '95': 'GUAVIARE',
  '97': 'VAUPÉS',
  '99': 'VICHADA',
  '00': 'EXTRANJERO / SIN INFORMACIÓN',
}

// Municipios principales (subset — usar catálogo DIVIPOLA completo para producción)
export const MUNICIPIOS_PRINCIPALES: Record<string, string> = {
  '11001': 'BOGOTÁ D.C.',
  '05001': 'MEDELLÍN',
  '76001': 'CALI',
  '08001': 'BARRANQUILLA',
  '13001': 'CARTAGENA DE INDIAS',
  '68001': 'BUCARAMANGA',
  '66001': 'PEREIRA',
  '63001': 'ARMENIA',
  '17001': 'MANIZALES',
  '25290': 'FACATATIVÁ',
  '25307': 'GIRARDOT',
  '25754': 'SOACHA',
  '25899': 'ZIPAQUIRÁ',
  '50001': 'VILLAVICENCIO',
  '54001': 'CÚCUTA',
  '41001': 'NEIVA',
  '73001': 'IBAGUÉ',
  '52001': 'PASTO',
  '20001': 'VALLEDUPAR',
  '05088': 'BELLO',
  '05266': 'ENVIGADO',
  '05615': 'RIONEGRO',
  '05380': 'ITAGÜÍ',
  '76109': 'BUENAVENTURA',
  '76520': 'PALMIRA',
  '76111': 'BUGA',
  '70001': 'SINCELEJO',
  '23001': 'MONTERÍA',
  '47001': 'SANTA MARTA',
  '44001': 'RIOHACHA',
  '27001': 'QUIBDÓ',
  '18001': 'FLORENCIA',
  '19001': 'POPAYÁN',
  '81001': 'ARAUCA',
  '85001': 'YOPAL',
  '86001': 'MOCOA',
  '00000': 'EXTRANJERO',
}

/** Retorna el código DIVIPOLA del departamento desde el código de municipio */
export function codigoDeptoFromMunicipio(codMunicipio: string): string {
  return codMunicipio.slice(0, 2)
}

/** Busca municipio por nombre (case insensitive) */
export function buscarMunicipio(nombre: string): string | undefined {
  const q = nombre.toUpperCase().trim()
  return Object.entries(MUNICIPIOS_PRINCIPALES)
    .find(([, n]) => n.includes(q))?.[0]
}

/** Lista para selectores UI */
export const DEPARTAMENTOS_LISTA = Object.entries(DEPARTAMENTOS)
  .map(([codigo, nombre]) => ({ codigo, nombre }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre))

export const MUNICIPIOS_LISTA = Object.entries(MUNICIPIOS_PRINCIPALES)
  .map(([codigo, nombre]) => ({ codigo, nombre, depto: codigo.slice(0, 2) }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre))

/** Código de países — subconjunto más comunes en exógena Colombia */
export const PAISES_COMUNES: Record<string, string> = {
  'CO': 'Colombia',
  'US': 'Estados Unidos',
  'MX': 'México',
  'ES': 'España',
  'DE': 'Alemania',
  'FR': 'Francia',
  'GB': 'Reino Unido',
  'BR': 'Brasil',
  'AR': 'Argentina',
  'CL': 'Chile',
  'PE': 'Perú',
  'EC': 'Ecuador',
  'VE': 'Venezuela',
  'PA': 'Panamá',
  'CR': 'Costa Rica',
  'CN': 'China',
  'JP': 'Japón',
  'KR': 'Corea del Sur',
  'IN': 'India',
  'CA': 'Canadá',
  'AN': 'Antillas Neerlandesas',
  'XX': 'No identificado / Sin información',
}
