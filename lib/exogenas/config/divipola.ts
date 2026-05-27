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

// Municipios — catálogo DIVIPOLA (DANE — Resolución 0166/1994 y actualizaciones)
export const MUNICIPIOS_PRINCIPALES: Record<string, string> = {
  // ── Bogotá ─────────────────────────────────────────────────────────────────
  '11001': 'BOGOTÁ D.C.',
  // ── Antioquia ──────────────────────────────────────────────────────────────
  '05001': 'MEDELLÍN',
  '05088': 'BELLO',
  '05266': 'ENVIGADO',
  '05380': 'ITAGÜÍ',
  '05615': 'RIONEGRO',
  '05045': 'APARTADÓ',
  '05837': 'TURBO',
  '05674': 'SABANETA',
  // ── Atlántico ─────────────────────────────────────────────────────────────
  '08001': 'BARRANQUILLA',
  '08433': 'MALAMBO',
  '08436': 'MANATÍ',
  '08758': 'SOLEDAD',
  // ── Bolívar ───────────────────────────────────────────────────────────────
  '13001': 'CARTAGENA DE INDIAS',
  '13430': 'MAGANGUÉ',
  // ── BOYACÁ — catálogo completo DIVIPOLA ───────────────────────────────────
  '15001': 'TUNJA',
  '15022': 'ALMEIDA',
  '15047': 'AQUITANIA',
  '15051': 'ARCABUCO',
  '15087': 'BELÉN',
  '15090': 'BERBEO',
  '15092': 'BETÉITIVA',
  '15097': 'BOAVITA',
  '15104': 'BOYACÁ',
  '15106': 'BRICEÑO',
  '15109': 'BUENAVISTA',
  '15114': 'BUSBANZÁ',
  '15131': 'CALDAS',
  '15135': 'CAMPOHERMOSO',
  '15162': 'CERINZA',
  '15172': 'CHINAVITA',
  '15176': 'CHIQUINQUIRÁ',
  '15180': 'CHÍQUIZA',
  '15183': 'CHIVOR',
  '15185': 'CIÉNEGA',
  '15204': 'CÓMBITA',
  '15212': 'COPER',
  '15215': 'CORRALES',
  '15218': 'COVARACHÍA',
  '15223': 'CUBARÁ',
  '15224': 'CUCAITA',
  '15226': 'CUÍTIVA',
  '15232': 'CHÍSCAS',
  '15236': 'EL COCUY',
  '15238': 'DUITAMA',
  '15244': 'EL ESPINO',
  '15248': 'FIRAVITOBA',
  '15255': 'FLORESTA',
  '15261': 'GACHANTIVÁ',
  '15272': 'GÁMEZA',
  '15276': 'GARAGOA',
  '15293': 'GUACAMAYAS',
  '15296': 'GUATEQUE',
  '15299': 'GUAYATÁ',
  '15317': 'GÜICÁN',
  '15322': 'IZA',
  '15325': 'JENESANO',
  '15332': 'JERICÓ',
  '15362': 'LABRANZAGRANDE',
  '15367': 'LA CAPILLA',
  '15374': 'LA UVITA',
  '15380': 'LA VICTORIA',
  '15403': 'LEYVA',
  '15407': 'MACANAL',
  '15425': 'MARIPÍ',
  '15442': 'MIRAFLORES',
  '15455': 'MONGUA',
  '15464': 'MONGUÍ',
  '15466': 'MONIQUIRÁ',
  '15469': 'MOTAVITA',
  '15476': 'MUZO',
  '15480': 'NOBSA',
  '15491': 'NUEVO COLÓN',
  '15494': 'OICATÁ',
  '15500': 'OTANCHE',
  '15507': 'PACHAVITA',
  '15511': 'PÁEZ',
  '15514': 'PAIPA',
  '15516': 'PAJARITO',
  '15518': 'PANQUEBA',
  '15522': 'PAUNA',
  '15531': 'PAYA',
  '15533': 'PAZ DEL RÍO',
  '15537': 'PESCA',
  '15542': 'PISBA',
  '15572': 'PUERTO BOYACÁ',
  '15580': 'QUÍPAMA',
  '15599': 'RAMIRIQUÍ',
  '15600': 'RÁQUIRA',
  '15621': 'RONDÓN',
  '15632': 'SABOYÁ',
  '15638': 'SÁCHICA',
  '15646': 'SAMACÁ',
  '15660': 'SAN EDUARDO',
  '15664': 'SAN JOSÉ DE PARE',
  '15667': 'SAN LUIS DE GACENO',
  '15673': 'SAN MATEO',
  '15681': 'SAN MIGUEL DE SEMA',
  '15686': 'SAN PABLO DE BORBUR',
  '15690': 'SANTANA',
  '15693': 'SANTA MARÍA',
  '15696': 'SANTA ROSA DE VITERBO',
  '15720': 'SANTA SOFÍA',
  '15723': 'SATIVANORTE',
  '15740': 'SATIVASUR',
  '15753': 'SIACHOQUE',
  '15757': 'SOATÁ',
  '15759': 'SOGAMOSO',
  '15761': 'SOCHA',
  '15762': 'SOCOTÁ',
  '15764': 'SORACÁ',
  '15774': 'SOTAQUIRÁ',
  '15776': 'SUSACÓN',
  '15790': 'SUTAMARCHÁN',
  '15798': 'SUTATENZA',
  '15804': 'TASCO',
  '15810': 'TENZA',
  '15814': 'TIBANÁ',
  '15816': 'TIBASOSA',
  '15820': 'TINJACÁ',
  '15822': 'TIPACOQUE',
  '15832': 'TOCA',
  '15835': 'TOGÜÍ',
  '15839': 'TÓPAGA',
  '15842': 'TOTA',
  '15861': 'TURMEQUÉ',
  '15864': 'TUTAZÁ',
  '15867': 'ÚMBITA',
  '15879': 'VENTAQUEMADA',
  '15897': 'VILLA DE LEYVA',
  '15902': 'VIRACACHÁ',
  '15910': 'ZETAQUIRA',
  // ── Caldas ────────────────────────────────────────────────────────────────
  '17001': 'MANIZALES',
  '17380': 'LA DORADA',
  // ── Caquetá ───────────────────────────────────────────────────────────────
  '18001': 'FLORENCIA',
  // ── Cauca ─────────────────────────────────────────────────────────────────
  '19001': 'POPAYÁN',
  // ── Cesar ─────────────────────────────────────────────────────────────────
  '20001': 'VALLEDUPAR',
  // ── Córdoba ───────────────────────────────────────────────────────────────
  '23001': 'MONTERÍA',
  // ── Cundinamarca ──────────────────────────────────────────────────────────
  '25001': 'AGUA DE DIOS',
  '25290': 'FACATATIVÁ',
  '25307': 'GIRARDOT',
  '25473': 'MOSQUERA',
  '25486': 'FUNZA',
  '25754': 'SOACHA',
  '25899': 'ZIPAQUIRÁ',
  '25175': 'CHÍA',
  '25269': 'FUSAGASUGÁ',
  // ── Chocó ─────────────────────────────────────────────────────────────────
  '27001': 'QUIBDÓ',
  // ── Huila ─────────────────────────────────────────────────────────────────
  '41001': 'NEIVA',
  '41551': 'PITALITO',
  // ── La Guajira ────────────────────────────────────────────────────────────
  '44001': 'RIOHACHA',
  '44430': 'MAICAO',
  // ── Magdalena ─────────────────────────────────────────────────────────────
  '47001': 'SANTA MARTA',
  // ── Meta ──────────────────────────────────────────────────────────────────
  '50001': 'VILLAVICENCIO',
  '50006': 'ACACÍAS',
  // ── Nariño ────────────────────────────────────────────────────────────────
  '52001': 'PASTO',
  '52356': 'IPIALES',
  // ── Norte de Santander ────────────────────────────────────────────────────
  '54001': 'CÚCUTA',
  '54405': 'LOS PATIOS',
  '54520': 'OCAÑA',
  // ── Quindío ───────────────────────────────────────────────────────────────
  '63001': 'ARMENIA',
  // ── Risaralda ─────────────────────────────────────────────────────────────
  '66001': 'PEREIRA',
  '66045': 'APÍA',
  '66594': 'DOSQUEBRADAS',
  // ── Santander ─────────────────────────────────────────────────────────────
  '68001': 'BUCARAMANGA',
  '68081': 'BARRANCABERMEJA',
  '68307': 'GIRÓN',
  '68547': 'PIEDECUESTA',
  '68679': 'FLORIDABLANCA',
  // ── Sucre ─────────────────────────────────────────────────────────────────
  '70001': 'SINCELEJO',
  // ── Tolima ────────────────────────────────────────────────────────────────
  '73001': 'IBAGUÉ',
  '73449': 'MELGAR',
  '73520': 'PLANADAS',
  // ── Valle del Cauca ───────────────────────────────────────────────────────
  '76001': 'CALI',
  '76109': 'BUENAVENTURA',
  '76111': 'BUGA',
  '76520': 'PALMIRA',
  '76834': 'TULUÁ',
  '76616': 'ROLDANILLO',
  // ── Arauca ────────────────────────────────────────────────────────────────
  '81001': 'ARAUCA',
  // ── Casanare ──────────────────────────────────────────────────────────────
  '85001': 'YOPAL',
  // ── Putumayo ──────────────────────────────────────────────────────────────
  '86001': 'MOCOA',
  // ── Extranjero ────────────────────────────────────────────────────────────
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
