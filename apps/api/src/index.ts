import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { config } from './config/index.js'
import { logger } from './lib/logger.js'
import { AppError, asyncHandler } from './lib/http.js'
import { errorHandler, notFound } from './middleware/error.js'
import { globalRateLimiter } from './middleware/rateLimit.js'
import { r2Active, presignedGetUrl } from './providers/storage.js'
import authRoutes from './modules/auth/routes.js'
import trustRoutes from './modules/trusts/routes.js'
import memberRoutes from './modules/members/routes.js'
import donationRoutes from './modules/donations/routes.js'
import receiptRoutes from './modules/receipts/routes.js'
import templateRoutes from './modules/templates/routes.js'
import campaignRoutes from './modules/campaigns/routes.js'
import announcementRoutes from './modules/announcements/routes.js'
import notificationRoutes from './modules/notifications/routes.js'
import reportRoutes from './modules/reports/routes.js'
import userRoutes from './modules/users/routes.js'
import dashboardRoutes from './modules/dashboard/routes.js'
import uploadRoutes from './modules/uploads/routes.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)

  app.use(cors({ origin: config.webOrigin, credentials: true }))
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    next()
  })
  app.use(express.json({ limit: '8mb' }))
  app.use(cookieParser())
  app.use(globalRateLimiter())

  if (r2Active()) {
    app.get(/^\/uploads\/(.+)$/, asyncHandler(async (req, res) => {
      let key: string
      try {
        key = decodeURIComponent(req.params[0])
      } catch {
        throw new AppError(400, 'Invalid file path')
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(key) || key.includes('..')) throw new AppError(400, 'Invalid file path')
      res.setHeader('Cache-Control', 'private, max-age=300')
      if (config.r2PublicUrl) {
        res.redirect(302, `${config.r2PublicUrl}/${key}`)
      } else {
        res.redirect(302, await presignedGetUrl(key))
      }
    }))
  } else {
    const uploadsDir = path.isAbsolute(config.uploadDir) ? config.uploadDir : path.join(process.cwd(), config.uploadDir)
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
    app.use('/uploads', express.static(uploadsDir))
  }

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'pavati-api', time: new Date().toISOString() }))

  app.use('/api/v1/auth', authRoutes)
  app.use('/api/v1/trusts', trustRoutes)
  app.use('/api/v1/trusts', memberRoutes)
  app.use('/api/v1/trusts', donationRoutes)
  app.use('/api/v1/trusts', receiptRoutes)
  app.use('/api/v1/trusts', templateRoutes)
  app.use('/api/v1/trusts', campaignRoutes)
  app.use('/api/v1/trusts', announcementRoutes)
  app.use('/api/v1/trusts', notificationRoutes)
  app.use('/api/v1/trusts', reportRoutes)
  app.use('/api/v1/trusts', dashboardRoutes)
  app.use('/api/v1/payments', donationRoutes)
  app.use('/api/v1/campaigns', campaignRoutes)
  app.use('/api/v1/receipts', receiptRoutes)
  app.use('/api/v1/users', userRoutes)
  app.use('/api/v1/uploads', uploadRoutes)

  if (config.webDistDir) {
    const distDir = path.isAbsolute(config.webDistDir) ? config.webDistDir : path.join(process.cwd(), config.webDistDir)
    app.use(express.static(distDir))
    app.get(/^(?!\/api\/|\/uploads\/|\/health$).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  app.use(notFound)
  app.use(errorHandler)
  return app
}

if (process.env.NODE_ENV !== 'test') {
  const app = createApp()
  app.listen(config.port, () => {
    logger.info(`Pāvati API listening on http://localhost:${config.port}`)
  })
}