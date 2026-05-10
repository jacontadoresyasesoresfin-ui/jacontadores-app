import { NextRequest, NextResponse } from 'next/server'

const MULTIPLIERS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]

function calcCheckDigit(base: string): number {
    const digits = base.replace(/\D/g, '').slice(-9).padStart(9, '0')
    const sum = digits.split('').reverse().reduce((acc, d, i) => acc + parseInt(d) * MULTIPLIERS[i], 0)
    const rem = sum % 11
    if (rem === 0) return 0
    if (rem === 1) return 1
    return 11 - rem
}

function getEntityType(base: string): { tipo: string; subtipo: string; esJuridica: boolean } {
    const n = parseInt(base.replace(/\D/g, ''))
    if (n >= 700_000_000 && n <= 799_999_999)
        return { tipo: 'Persona Natural',   subtipo: 'Extranjero sin cédula colombiana',         esJuridica: false }
    if (n >= 800_000_000 && n <= 899_999_999)
        return { tipo: 'Persona Jurídica',  subtipo: 'Empresa privada / sociedad comercial',      esJuridica: true  }
    if (n >= 900_000_000 && n <= 999_999_999)
        return { tipo: 'Persona Jurídica',  subtipo: 'Entidad pública / sin ánimo de lucro',      esJuridica: true  }
    if (n >= 1_000_000_000)
        return { tipo: 'Persona Natural',   subtipo: 'Cédula de ciudadanía (nueva numeración)',   esJuridica: false }
    if (n >= 1 && n <= 99_999_999)
        return { tipo: 'Persona Natural',   subtipo: 'Cédula de ciudadanía',                      esJuridica: false }
    return { tipo: 'No determinado', subtipo: '', esJuridica: false }
}

function fmtDate(raw: string): string {
    if (!raw || raw === '99991231' || raw === '0') return '—'
    const s = String(raw).replace(/\D/g, '')
    if (s.length === 8) return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`
    if (s.includes('-')) {
        const parts = s.split('-')
        return `${parts[2]?.slice(0, 2) || '??'}/${parts[1] || '??'}/${parts[0] || '??'}`
    }
    return raw
}

/* ── Lookup CIIU description ── */
const CIIU: Record<string, string> = {
    '6412': 'Bancos comerciales y de fomento',
    '6421': 'Corporaciones financieras',
    '6422': 'Compañías de financiamiento',
    '6491': 'Leasing financiero',
    '6493': 'Otras actividades de crédito',
    '6511': 'Seguros de vida',
    '6512': 'Seguros generales',
    '6621': 'Actividades de administración de fondos',
    '4711': 'Comercio minorista de alimentos y bebidas',
    '4719': 'Comercio minorista no especializado',
    '4761': 'Comercio libros, revistas y periódicos',
    '4773': 'Farmacia y artículos de medicina',
    '4791': 'Comercio por internet',
    '4610': 'Comercio mayorista materias primas',
    '4690': 'Comercio mayorista no especializado',
    '6201': 'Desarrollo de sistemas informáticos',
    '6202': 'Consultoría de informática',
    '6209': 'Otras actividades de TI',
    '6311': 'Procesamiento de datos',
    '6399': 'Otros servicios de información',
    '6810': 'Actividades inmobiliarias propias',
    '6820': 'Arrendamiento de bienes inmuebles',
    '7010': 'Actividades de administración empresarial',
    '7110': 'Actividades de arquitectura e ingeniería',
    '7490': 'Otras actividades profesionales',
    '8211': 'Actividades de apoyo a instalaciones',
    '8219': 'Fotocopiado, preparación documentos',
    '8299': 'Otras actividades de apoyo a la empresa',
    '6920': 'Actividades de contabilidad y auditoría',
    '6910': 'Actividades jurídicas',
    '7120': 'Ensayos y análisis técnicos',
    '7220': 'Investigación y desarrollo ciencias sociales',
    '8411': 'Administración pública en general',
    '8412': 'Actividades del gobierno — sectorial',
    '8423': 'Orden público y seguridad',
    '8430': 'Actividades de la seguridad social',
    '8510': 'Educación preescolar y primaria',
    '8521': 'Educación secundaria de formación general',
    '8530': 'Educación técnica y tecnológica',
    '8541': 'Educación superior universitaria',
    '8610': 'Actividades hospitalarias',
    '8621': 'Actividades de médicos y odontólogos',
    '8690': 'Otras actividades de salud',
    '4210': 'Construcción de carreteras y vías',
    '4290': 'Construcción de obras de ingeniería civil',
    '4111': 'Construcción de edificios residenciales',
    '4112': 'Construcción de edificios no residenciales',
    '1011': 'Procesamiento y conservación de carne',
    '1020': 'Procesamiento de pescado',
    '1081': 'Elaboración de productos de café',
    '1089': 'Elaboración otros productos alimenticios',
    '1101': 'Destilación, rectificación y mezcla de bebidas alcohólicas',
    '2100': 'Fabricación de productos farmacéuticos',
    '2511': 'Fabricación de productos metálicos',
    '2821': 'Fabricación de maquinaria de uso general',
    '2910': 'Fabricación de vehículos automotores',
    '4911': 'Transporte férreo de pasajeros',
    '4921': 'Transporte urbano colectivo',
    '5111': 'Transporte aéreo nacional de pasajeros',
    '5210': 'Almacenamiento y depósito',
    '5221': 'Actividades de servicios para el transporte terrestre',
    '5310': 'Actividades de correo',
    '5320': 'Actividades de mensajería',
    '5511': 'Alojamiento en hoteles',
    '5630': 'Expendio de bebidas alcohólicas para consumo dentro del establecimiento',
    '5611': 'Expendio a la mesa de comidas preparadas',
    '5612': 'Expendio por autoservicio de comidas preparadas',
    '9499': 'Actividades de otras asociaciones n.c.p.',
    '9601': 'Lavado y limpieza de prendas de vestir',
    '9609': 'Otras actividades de servicios personales',
    '9000': 'Actividades creativas, artísticas y de entretenimiento',
    '9001': 'Artes escénicas',
    '9200': 'Actividades de juegos de azar y apuestas',
    '3600': 'Captación, depuración y distribución de agua',
    '3511': 'Generación de energía eléctrica',
    '3513': 'Distribución de energía eléctrica',
    '3900': 'Actividades de saneamiento',
}

function describeCIIU(code: string): string {
    if (!code || code === '9999') return 'No clasificada'
    const clean = code.replace(/\D/g, '')
    return CIIU[clean] ? `${clean} — ${CIIU[clean]}` : `Código CIIU ${clean}`
}

export async function GET(req: NextRequest) {
    const nit = req.nextUrl.searchParams.get('nit') || ''
    const cleaned = nit.replace(/\D/g, '')

    if (cleaned.length < 2) {
        return NextResponse.json({ error: 'NIT demasiado corto' }, { status: 400 })
    }

    /* ── Determinar base y dígito ── */
    const base      = cleaned.slice(0, -1)
    const givenDig  = parseInt(cleaned.slice(-1))
    const expected  = calcCheckDigit(base)
    const valid     = givenDig === expected

    /* ── Consultar RUES / datos.gov.co (máx 6 segundos) ── */
    let registros: Record<string, string>[] = []
    try {
        const ctrl = new AbortController()
        const tid  = setTimeout(() => ctrl.abort(), 6000)
        const url  = `https://www.datos.gov.co/resource/c82u-588k.json?numero_identificacion=${base}&$limit=5&$order=ultimo_ano_renovado%20DESC`
        const res  = await fetch(url, { signal: ctrl.signal, next: { revalidate: 3600 } })
        clearTimeout(tid)
        if (res.ok) registros = await res.json()
    } catch {
        // Timeout o red no disponible — se retornan al menos los datos locales (DV, tipo, rango)
    }

    /* ── Preparar respuesta ── */
    const principal = registros[0] || null

    return NextResponse.json({
        /* Validación */
        valid, nit: cleaned, base,
        checkDigit: expected, providedDigit: givenDig,
        formatted:  base + '-' + givenDig,

        /* Clasificación por rango */
        tipoRango:  getEntityType(base).tipo,
        subtipo:    getEntityType(base).subtipo,
        esJuridica: getEntityType(base).esJuridica,

        /* Datos del registro mercantil */
        encontrado: registros.length > 0,
        razonSocial:         principal?.razon_social             || null,
        estadoMatricula:     principal?.estado_matricula          || null,
        organizacionJuridica:principal?.organizacion_juridica     || null,
        tipoSociedad:        principal?.tipo_sociedad             || null,
        categoriaMatricula:  principal?.categoria_matricula       || null,
        camaraComercio:      principal?.camara_comercio           || null,
        matricula:           principal?.matricula                 || null,
        inscripcionProponente: principal?.inscripcion_proponente  || null,
        fechaMatricula:      principal ? fmtDate(principal.fecha_matricula)  : null,
        fechaRenovacion:     principal ? fmtDate(principal.fecha_renovacion) : null,
        ultimoAnoRenovado:   principal?.ultimo_ano_renovado       || null,
        fechaVigencia:       principal ? fmtDate(principal.fecha_vigencia)   : null,
        fechaCancelacion:    principal ? fmtDate(principal.fecha_cancelacion ?? '0') : null,
        ciuuPrincipal:       principal ? describeCIIU(principal.cod_ciiu_act_econ_pri) : null,
        ciuuSecundario:      principal ? describeCIIU(principal.cod_ciiu_act_econ_sec || '') : null,
        ciuu3:               principal ? describeCIIU(principal.ciiu3 || '')              : null,
        representanteLegal:  principal?.representante_legal       || null,
        idRepresentante:     principal?.num_identificacion_representante_legal || null,
        claseIdRL:           principal?.clase_identificacion_rl   || null,
        digitoVerificacion:  principal?.digito_verificacion       || String(expected),

        /* Registros adicionales (otras cámaras) */
        otrasMatriculas: registros.slice(1).map(r => ({
            camara: r.camara_comercio,
            matricula: r.matricula,
            estado: r.estado_matricula,
            renovado: r.ultimo_ano_renovado,
        })),
    })
}
