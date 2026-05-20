import { inflateRaw } from 'zlib'
import { promisify } from 'util'
import { parsearXmlDian } from '@/lib/conciliaciones/parsers/dian-xml'
import type { FacturaElectronica } from '@/lib/conciliaciones/models'

const inflateRawAsync = promisify(inflateRaw)

interface CdEntry {
  compressionMethod: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
  fileName: string
}

function findEndOfCentralDirectory(buf: Buffer): number {
  // Scan backwards from end looking for EOCD signature 0x06054b50
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i
  }
  return -1
}

function readCentralDirectory(buf: Buffer): CdEntry[] {
  const eocd = findEndOfCentralDirectory(buf)
  if (eocd < 0) return []

  const cdCount  = buf.readUInt16LE(eocd + 8)
  const cdOffset = buf.readUInt32LE(eocd + 16)

  const entries: CdEntry[] = []
  let pos = cdOffset

  for (let i = 0; i < cdCount && pos + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break

    const compressionMethod  = buf.readUInt16LE(pos + 10)
    const compressedSize     = buf.readUInt32LE(pos + 20)
    const uncompressedSize   = buf.readUInt32LE(pos + 24)
    const fileNameLength     = buf.readUInt16LE(pos + 28)
    const extraFieldLength   = buf.readUInt16LE(pos + 30)
    const fileCommentLength  = buf.readUInt16LE(pos + 32)
    const localHeaderOffset  = buf.readUInt32LE(pos + 42)
    const fileName           = buf.toString('utf8', pos + 46, pos + 46 + fileNameLength)

    entries.push({ compressionMethod, compressedSize, uncompressedSize, localHeaderOffset, fileName })
    pos += 46 + fileNameLength + extraFieldLength + fileCommentLength
  }

  return entries
}

async function extractEntry(buf: Buffer, entry: CdEntry): Promise<Buffer> {
  const lhOffset = entry.localHeaderOffset
  if (buf.readUInt32LE(lhOffset) !== 0x04034b50) {
    throw new Error(`Local file header signature mismatch for ${entry.fileName}`)
  }

  const nameLen  = buf.readUInt16LE(lhOffset + 26)
  const extraLen = buf.readUInt16LE(lhOffset + 28)
  const dataStart = lhOffset + 30 + nameLen + extraLen

  const compressed = buf.subarray(dataStart, dataStart + entry.compressedSize)

  if (entry.compressionMethod === 0) return Buffer.from(compressed)
  if (entry.compressionMethod === 8) return inflateRawAsync(compressed)
  throw new Error(`Unsupported compression method: ${entry.compressionMethod}`)
}

export async function parsearZipDian(buffer: Buffer): Promise<{
  facturas: FacturaElectronica[]
  errores: string[]
}> {
  const facturas: FacturaElectronica[] = []
  const errores: string[] = []

  let entries: CdEntry[]
  try {
    entries = readCentralDirectory(buffer)
  } catch (e) {
    return { facturas, errores: [`Error leyendo índice ZIP: ${String(e)}`] }
  }

  const xmlEntries = entries.filter(e =>
    e.fileName.toLowerCase().endsWith('.xml') &&
    !e.fileName.endsWith('/') &&
    e.compressedSize > 0
  )

  if (xmlEntries.length === 0) {
    errores.push('El archivo ZIP no contiene XMLs DIAN')
    return { facturas, errores }
  }

  for (const entry of xmlEntries) {
    try {
      const datos = await extractEntry(buffer, entry)
      const factura = parsearXmlDian(datos, entry.fileName)
      if (factura) facturas.push(factura)
      else errores.push(`No se pudo parsear: ${entry.fileName}`)
    } catch (e) {
      errores.push(`Error extrayendo ${entry.fileName}: ${String(e)}`)
    }
  }

  return { facturas, errores }
}
