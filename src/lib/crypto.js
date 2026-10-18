import crypto from 'crypto'

const getKey = () => {
  const secret = process.env.EMAIL_SECRET || process.env.SESSION_SECRET
  if (!secret) throw new Error('EMAIL_SECRET is not configured')
  return crypto.createHash('sha256').update(secret).digest()
}

/**
 * Encrypts a secret value using AES-256-GCM.
 * Returns a compact string: iv.authTag.ciphertext (all base64).
 */
export const encryptSecret = (plain) => {
  if (!plain) return null

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`
}

/**
 * Decrypts a value produced by encryptSecret.
 * Returns null if the payload is missing or malformed.
 */
export const decryptSecret = (payload) => {
  if (!payload) return null

  const [ivB64, tagB64, dataB64] = String(payload).split('.')
  if (!ivB64 || !tagB64 || !dataB64) return null

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))

    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()])

    return decrypted.toString('utf8')
  } catch {
    return null
  }
}
