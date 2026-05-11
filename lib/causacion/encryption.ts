import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
    const secret = process.env.ENCRYPTION_SECRET || 'ja-contadores-fallback-key-32-ch!'
    // Derive a 32-byte key from the secret using scrypt
    return scryptSync(secret, 'ja-causacion-salt', 32)
}

export function encrypt(plaintext: string): string {
    if (!plaintext) return ''
    const iv = randomBytes(12)
    const cipher = createCipheriv(ALGO, getKey(), iv)
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
    if (!ciphertext) return ''
    try {
        const parts = ciphertext.split(':')
        if (parts.length !== 3) return ''
        const [ivHex, tagHex, encHex] = parts
        const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'))
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
        return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8')
    } catch {
        return ''
    }
}

export function maskKey(key: string): string {
    if (!key || key.length < 8) return '****'
    return key.slice(0, 4) + '****' + key.slice(-4)
}
