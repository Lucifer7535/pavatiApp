import type { NextFunction, Request, Response } from 'express'
import { ZodSchema } from 'zod'
import { AppError } from '../lib/http.js'

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return next(new AppError(422, 'Validation failed', result.error.flatten()))
    }
    req.body = result.data
    next()
  }
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query)
    if (!result.success) {
      return next(new AppError(422, 'Invalid query parameters', result.error.flatten()))
    }
    req.query = result.data as Request['query']
    next()
  }
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params)
    if (!result.success) {
      return next(new AppError(422, 'Invalid path parameters', result.error.flatten()))
    }
    next()
  }
}