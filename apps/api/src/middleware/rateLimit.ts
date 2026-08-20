import rateLimit from 'express-rate-limit'

export function otpRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many OTP requests. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
  })
}

export function authRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  })
}

export function globalRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
}