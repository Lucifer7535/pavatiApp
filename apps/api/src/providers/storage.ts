import * as fs from 'node:fs'
import * as path from 'node:path'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from '../config/index.js'
import { AppError } from '../lib/http.js'
import { randomCode } from '@pavati/shared'

export interface StoredFile {
  url: string
  filename: string
}

const UPLOAD_URL_PREFIX = '/uploads/'

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
}

/**
 * The extensions this sink will write. Derived from CONTENT_TYPES so the allowlist and
 * the stored MIME type cannot drift apart. Exported so the security suite asserts against
 * the real allowlist rather than a copy of it.
 */
export const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set(Object.keys(CONTENT_TYPES))

export function r2Active(): boolean {
  return (
    config.storageDriver === 'r2' &&
    !!config.r2AccountId &&
    !!config.r2AccessKeyId &&
    !!config.r2SecretAccessKey &&
    !!config.r2Bucket
  )
}

let s3ClientInstance: S3Client | null = null

function s3(): S3Client {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    })
  }
  return s3ClientInstance
}

export async function saveBuffer(buffer: Buffer, ext: string, subdir = ''): Promise<StoredFile> {
  // `ext` becomes part of the on-disk filename, so it is the second attacker-influenced
  // input on this sink alongside `subdir`. The upload route allowlists it before calling,
  // but this function is exported, so a future caller passing a value like
  // "png/../../x" would resolve outside the upload root. Validate here so containment does
  // not depend on every caller behaving. Checked against the same allowlist the route
  // uses, which is also the source of CONTENT_TYPES.
  if (!ALLOWED_EXTENSIONS.has(ext)) throw new AppError(400, 'Unsupported file type')
  const filename = `${Date.now()}-${randomCode(6)}.${ext}`
  // The write path needs the same containment guarantee as the read path: `subdir` is
  // joined onto uploadDir for the disk driver and used verbatim as the R2 Key. Today's
  // callers pass literals, but validating here means a future caller cannot turn this
  // into a write outside the upload root.
  const safeSubdir = subdir ? safeStorageKey(subdir) : ''
  if (subdir && !safeSubdir) throw new AppError(400, 'Invalid upload subdirectory')
  const rel = safeSubdir ? `${safeSubdir}/${filename}` : filename
  if (r2Active()) {
    await s3().send(
      new PutObjectCommand({
        Bucket: config.r2Bucket,
        Key: rel,
        Body: buffer,
        ContentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
      }),
    )
  } else {
    const dir = safeSubdir ? path.join(config.uploadDir, safeSubdir) : config.uploadDir
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    await fs.promises.writeFile(path.join(dir, filename), buffer)
  }
  return { url: r2Active() && config.r2PublicUrl ? `${config.r2PublicUrl}/${rel}` : `${config.publicBaseUrl}${UPLOAD_URL_PREFIX}${rel}`, filename: rel }
}

export async function savePdf(buffer: Uint8Array, subdir: string): Promise<StoredFile> {
  return saveBuffer(Buffer.from(buffer), 'pdf', subdir)
}

function keyFromUrl(url: string): string | null {
  if (config.r2PublicUrl && url.startsWith(config.r2PublicUrl + '/')) {
    return safeStorageKey(url.slice(config.r2PublicUrl.length + 1))
  }
  const prefix = `${config.publicBaseUrl}${UPLOAD_URL_PREFIX}`
  if (url.startsWith(prefix)) return safeStorageKey(url.slice(prefix.length))
  return null
}

/**
 * Rejects any storage key that is not a plain relative path inside the upload root.
 *
 * `keyFromUrl` output is attacker-influenced (template background URLs, trust logos),
 * and it is fed to `path.join(uploadDir, key)` and to the R2 `Key`. A key containing
 * `..` escapes the upload directory on the disk driver and reaches arbitrary files.
 * Decode first so percent-encoded traversal cannot slip past a segment check.
 */
/** Exported so the security suite can assert against the real validator, not a copy. */
export function safeStorageKey(raw: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return null
  }
  // Reject NUL and any backslash, so the check cannot be bypassed by a
  // platform-specific separator.
  if (decoded.includes('\0') || decoded.includes('\\')) return null
  if (path.isAbsolute(decoded) || /^[A-Za-z]:/.test(decoded)) return null
  const segments = decoded.split('/')
  if (segments.some((s) => s === '..' || s === '.')) return null
  if (!segments.some((s) => s.length > 0)) return null
  return segments.join('/')
}

/** True when `candidate` resolves inside `root`. */
function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(candidate))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

export async function fileFromUrl(url: string): Promise<{ path: string; buffer: Buffer } | null> {
  const key = keyFromUrl(url)
  if (key === null) return null
  if (r2Active()) {
    try {
      const res = await s3().send(new GetObjectCommand({ Bucket: config.r2Bucket, Key: key }))
      const bytes = await res.Body!.transformToByteArray()
      return { path: key, buffer: Buffer.from(bytes) }
    } catch (err) {
      const name = (err as { name?: string })?.name
      if (name === 'NoSuchKey' || name === '404') throw new AppError(404, 'File not found')
      throw err
    }
  }
  const full = path.join(config.uploadDir, key)
  // Belt-and-braces containment check on the resolved path, independent of the segment
  // validation above, so a future caller cannot reintroduce traversal by other means.
  if (!isInside(config.uploadDir, full)) throw new AppError(400, 'Invalid file path')
  if (!fs.existsSync(full)) throw new AppError(404, 'File not found')
  return { path: full, buffer: fs.readFileSync(full) }
}

export async function presignedGetUrl(key: string, expiresIn = 900): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: config.r2Bucket, Key: key }), { expiresIn })
}
