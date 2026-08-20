import type { NextFunction, Request, Response } from 'express'
import { logger } from '../lib/logger.js'
import { AppError } from '../lib/http.js'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, details: err.details })
  }
  logger.error({ err }, 'Unhandled error')
  const message = err instanceof Error ? err.message : 'Internal server error'
  return res.status(500).json({ error: message })
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Route not found' })
}