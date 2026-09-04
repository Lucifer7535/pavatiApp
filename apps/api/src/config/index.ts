import dotenv from 'dotenv'
dotenv.config()

const env = process.env.NODE_ENV ?? 'development'
const isProd = env === 'production'

export const IST_OFFSET_HOURS = 5.5

export function todayStartIn(tzOffsetHours: number = IST_OFFSET_HOURS): Date {
  const now = new Date()
  const local = new Date(now.getTime() + tzOffsetHours * 60 * 60 * 1000)
  local.setUTCHours(0, 0, 0, 0)
  return new Date(local.getTime() - tzOffsetHours * 60 * 60 * 1000)
}

function requireSecret(name: string, fallback: string | undefined): string {
  const value = process.env[name] ?? fallback
  if (isProd && (!value || value.startsWith('pavati-dev-'))) {
    throw new Error(`Environment variable ${name} must be set to a strong secret in production`)
  }
  return value ?? ''
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dbUrl: process.env.DATABASE_URL!,
  jwtSecret: requireSecret('JWT_SECRET', isProd ? undefined : 'pavati-dev-secret-change-in-production'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  refreshSecret: requireSecret('REFRESH_SECRET', isProd ? undefined : 'pavati-refresh-secret-change-in-production'),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000',
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  storageDriver: (process.env.STORAGE_DRIVER as 'disk' | 'r2') ?? (process.env.R2_ACCOUNT_ID ? 'r2' : 'disk'),
  r2AccountId: process.env.R2_ACCOUNT_ID ?? '',
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  r2Bucket: process.env.R2_BUCKET ?? '',
  r2PublicUrl: process.env.R2_PUBLIC_URL ?? '',
  webDistDir: process.env.WEB_DIST_DIR ?? '',
  mockMode: process.env.MOCK_MODE === 'true',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
  env,
}