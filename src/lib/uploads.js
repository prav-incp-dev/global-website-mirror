import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { pipeline } from 'node:stream/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Uploads live outside the served app tree (sibling of src/) and are never
// registered as a static route, so they are not publicly accessible.
const UPLOADS_DIR = path.join(__dirname, '../../uploads')

const ensureUploadsDir = () => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  }
  return UPLOADS_DIR
}

/**
 * Streams an uploaded file to the private uploads directory.
 * Always stores under a freshly generated name — the original name is never used.
 * Returns the absolute stored path and the stored file name.
 */
export const saveUpload = async ({ stream, originalName }) => {
  const dir = ensureUploadsDir()
  const extension = path.extname(originalName || '').slice(0, 16)
  const storedName = `${crypto.randomUUID()}${extension}`
  const storedPath = path.join(dir, storedName)

  await pipeline(stream, fs.createWriteStream(storedPath))

  return { storedPath, storedName }
}

/**
 * Removes a stored upload file. Silently ignores missing files.
 */
export const removeUpload = async (filePath) => {
  if (!filePath) return
  try {
    await fs.promises.unlink(filePath)
  } catch {
    // ignore missing files
  }
}
