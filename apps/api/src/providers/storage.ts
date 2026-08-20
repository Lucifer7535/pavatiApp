import * as fs from 'node:fs'
import * as path from 'node:path'
import { config } from '../config/index.js'
import { AppError } from '../lib/http.js'
import { randomCode } from '@pavati/shared'

export interface StoredFile {
  url: string
  filename: string
}

function ensureDir() {
  if (!fs.existsSync(config.uploadDir)) fs.mkdirSync(config.uploadDir, { recursive: true })
}

export async function saveBuffer(buffer: Buffer, ext: string, subdir = ''): Promise<StoredFile> {
  ensureDir()
  const dir = subdir ? path.join(config.uploadDir, subdir) : config.uploadDir
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const filename = `${Date.now()}-${randomCode(6)}.${ext}`
  const full = path.join(dir, filename)
  await fs.promises.writeFile(full, buffer)
  const rel = subdir ? `${subdir}/${filename}` : filename
  return { url: `${config.publicBaseUrl}/uploads/${rel}`, filename: rel }
}

export async function savePdf(buffer: Uint8Array, subdir: string): Promise<StoredFile> {
  return saveBuffer(Buffer.from(buffer), 'pdf', subdir)
}

export function fileFromUrl(url: string): { path: string; buffer: Buffer } | null {
  const prefix = `${config.publicBaseUrl}/uploads/`
  if (!url.startsWith(prefix)) return null
  const rel = url.slice(prefix.length)
  const full = path.join(config.uploadDir, rel)
  if (!fs.existsSync(full)) throw new AppError(404, 'File not found')
  return { path: full, buffer: fs.readFileSync(full) }
}