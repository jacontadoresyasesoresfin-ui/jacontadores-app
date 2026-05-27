/**
 * Parser de nombres colombianos para exógena DIAN.
 *
 * Convención DANE/DIAN: primerApellido segundoApellido primerNombre otrosNombres
 * Los sistemas contables como Siigo exportan el nombre en diferentes órdenes.
 *
 * Heurística:
 *   - Coma explícita  "GOMEZ LOPEZ, JUAN CARLOS"  → apellidos | nombres
 *   - 4+ palabras sin coma → palabra[0]=primerAp, palabra[1]=segundoAp,
 *     palabra[2]=primerNombre, resto=otrosNombres (convención apellidos primero)
 *   - 3 palabras → 2 apellidos + 1 nombre
 *   - 2 palabras → 1 apellido + 1 nombre
 *   - 1 palabra  → primerApellido (o razonSocial si es persona jurídica)
 */

export interface NombreParsed {
  primerApellido: string
  segundoApellido: string
  primerNombre: string
  otrosNombres: string
}

const SUFIJOS_EMPRESA = /\b(S\.A\.S\.?|LTDA\.?|S\.A\.?|E\.U\.?|S\.C\.S\.?|S\.C\.A\.?|INC\.?|LLC\.?|CORP\.?|CÍA\.?|CIA\.?|ASOCIADOS?|HERMANOS?|E\.S\.P\.?|FUNDACION|FUNDACIÓN|COOPERATIVA|COOP\.?|CONSORCIO|UNION|UNIÓN)\b/i

/** Detecta si el nombre corresponde a una persona jurídica (empresa) */
export function esPersonaJuridica(nombre: string): boolean {
  return SUFIJOS_EMPRESA.test(nombre)
}

/**
 * Divide un nombre completo colombiano en sus componentes para la exógena.
 * Para personas naturales únicamente — para empresas usar razonSocial directamente.
 */
export function parsearNombreColombia(nombreCompleto: string): NombreParsed {
  const n = (nombreCompleto ?? '').toUpperCase().trim()
  if (!n) return vacio()

  // ── Separador explícito con coma: "GOMEZ LOPEZ, JUAN CARLOS" ─────────────
  if (n.includes(',')) {
    const [parteAp, parteNom] = n.split(',', 2).map(s => s.trim().split(/\s+/).filter(Boolean))
    return {
      primerApellido:  parteAp[0] ?? '',
      segundoApellido: parteAp[1] ?? '',
      primerNombre:    parteNom[0] ?? '',
      otrosNombres:    parteNom.slice(1).join(' '),
    }
  }

  const partes = n.split(/\s+/).filter(Boolean)

  switch (partes.length) {
    case 0: return vacio()
    case 1: return { primerApellido: partes[0], segundoApellido: '', primerNombre: '', otrosNombres: '' }
    case 2: return { primerApellido: partes[0], segundoApellido: '', primerNombre: partes[1], otrosNombres: '' }
    case 3: return { primerApellido: partes[0], segundoApellido: partes[1], primerNombre: partes[2], otrosNombres: '' }
    default:
      // 4+ palabras: convención colombiana apellidos primero
      return {
        primerApellido:  partes[0],
        segundoApellido: partes[1],
        primerNombre:    partes[2],
        otrosNombres:    partes.slice(3).join(' '),
      }
  }
}

function vacio(): NombreParsed {
  return { primerApellido: '', segundoApellido: '', primerNombre: '', otrosNombres: '' }
}

/** Reconstruye nombre completo desde componentes (orden DIAN) */
export function nombreCompleto(p: NombreParsed): string {
  return [p.primerApellido, p.segundoApellido, p.primerNombre, p.otrosNombres]
    .filter(Boolean).join(' ')
}
