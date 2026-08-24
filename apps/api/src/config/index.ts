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
  mockMode: process.env.MOCK_MODE !== 'false',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  env: process.env.NODE_ENV ?? 'development',
}