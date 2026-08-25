import dotenv from 'dotenv'
dotenv.config()

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dbUrl: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET ?? 'pavati-dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  refreshSecret: process.env.REFRESH_SECRET ?? 'pavati-refresh-secret-change-in-production',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000',
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  storageDriver: (process.env.STORAGE_DRIVER as 'disk' | 'r2') ?? (process.env.R2_ACCOUNT_ID ? 'r2' : 'disk'),
  r2AccountId: process.env.R2_ACCOUNT_ID ?? '',
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  r2Bucket: process.env.R2_BUCKET ?? '',
  webDistDir: process.env.WEB_DIST_DIR ?? '',
  mockMode: process.env.MOCK_MODE !== 'false',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
  env: process.env.NODE_ENV ?? 'development',
}