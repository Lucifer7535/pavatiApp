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
  const filename = `${Date.now()}-${randomCode(6)}.${ext}`
  const rel = subdir ? `${subdir}/${filename}` : filename
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
    const dir = subdir ? path.join(config.uploadDir, subdir) : config.uploadDir
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
    return url.slice(config.r2PublicUrl.length + 1)
  }
  const prefix = `${config.publicBaseUrl}${UPLOAD_URL_PREFIX}`
  if (url.startsWith(prefix)) return url.slice(prefix.length)
  return null
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
  if (!fs.existsSync(full)) throw new AppError(404, 'File not found')
  return { path: full, buffer: fs.readFileSync(full) }
}

export async function presignedGetUrl(key: string, expiresIn = 900): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: config.r2Bucket, Key: key }), { expiresIn })
}
