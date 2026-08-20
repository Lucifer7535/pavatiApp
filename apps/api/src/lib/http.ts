import type { NextFunction, Request, Response } from 'express'

export class AppError extends Error {
  status: number
  details?: unknown
  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown

export function asyncHandler(fn: Handler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export function ok(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ data })
}