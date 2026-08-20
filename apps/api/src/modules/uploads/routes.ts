import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validate.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { saveBuffer } from '../../providers/storage.js'

const router = Router()

const uploadSchema = z.object({
  dataUrl: z.string().min(10),
  kind: z.enum(['image', 'pdf']).default('image'),
})

router.post(
  '/',
  requireAuth,
  validateBody(uploadSchema),
  asyncHandler(async (req, res) => {
    const { dataUrl, kind } = req.body
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) throw new AppError(400, 'Invalid data URL')
    const mime = match[1]
    const buffer = Buffer.from(match[2], 'base64')
    const ext = kind === 'pdf' ? 'pdf' : mime.split('/')[1] ?? 'png'
    if (!['png', 'jpeg', 'jpg', 'webp', 'gif', 'pdf'].includes(ext)) throw new AppError(400, 'Unsupported file type')
    const maxBytes = kind === 'pdf' ? 10 * 1024 * 1024 : 5 * 1024 * 1024
    if (buffer.length > maxBytes) throw new AppError(400, 'File too large')
    const stored = await saveBuffer(buffer, ext, kind === 'pdf' ? 'files' : 'images')
    ok(res, { url: stored.url, filename: stored.filename, mime }, 201)
  })
)

export default router