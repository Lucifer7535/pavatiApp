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

/**
 * Whether the caller-supplied mock branches (Google mock login) may run at all.
 *
 * The previous gate was `config.mockMode && config.env !== 'production'`, which meant a
 * host with MOCK_MODE=true and NODE_ENV unset served mock logins that accepted an
 * arbitrary caller-supplied email. Mock mode now requires an explicit, dedicated opt-in
 * so no combination of ordinary config values can reach it.
 */
function mockModeEnabled(): boolean {
  if (process.env.MOCK_MODE !== 'true') return false
  if (isProd) return false
  return process.env.ALLOW_INSECURE_MOCK_AUTH === 'true'
}

/**
 * Fail-closed secret loading, applied on EVERY host, not just production.
 *
 * Previously this was keyed on `isProd`, so a host that simply forgot NODE_ENV booted
 * with the published dev literals in source and signed real tokens with a key that is
 * in the repository. Any missing, placeholder or short secret now aborts start-up.
 */
function requireSecret(name: string): string {
  const value = process.env[name]
  if (!value || value.startsWith('pavati-dev-') || value.length < 32) {
    throw new Error(`Environment variable ${name} must be set to a strong secret (>=32 chars, not a dev placeholder)`)
  }
  return value
}

/** Published values that must never be a live credential on any host. */
const PUBLISHED_DEV_DEFAULTS = new Set(['dev@pavati.com', 'Pavati@Dev2026'])

/** Obvious placeholder shapes that .env.example ships with. */
const PLACEHOLDER_PATTERN = /^(change-?me|your[-_ ]|placeholder|example|dev@example|xxx)/i

/**
 * The developer-console credential is the same class of secret as jwtSecret — it is
 * compared directly and mints a token requireDevAuth honours. Resolve it through an
 * equivalent guard rather than letting a published constant become the live credential.
 *
 * The published-default check is conditional on the console actually being mounted.
 * A production host that correctly left DEV_ROUTES_ENABLED unset never serves /api/v1/dev,
 * so an unused placeholder there is harmless and must not stop the app from booting.
 * Conversely, on any host where the console *is* mounted — including a staging host with
 * NODE_ENV unset — the published password would be a live, internet-reachable credential,
 * so it must abort start-up rather than quietly serving it.
 */
function requireCredential(name: string, fallback: string, consoleMounted: boolean): string {
  const value = process.env[name] ?? fallback
  if (consoleMounted) {
    if (PUBLISHED_DEV_DEFAULTS.has(value)) {
      throw new Error(
        `Environment variable ${name} must not be left at its published default while the developer console is mounted`,
      )
    }
    // .env.example ships placeholders. Copying it verbatim must not yield a working
    // console password either.
    if (PLACEHOLDER_PATTERN.test(value) || value.length < 12) {
      throw new Error(`Environment variable ${name} must be a real credential, not a placeholder`)
    }
  }
  return value
}

// The developer console is a local-only surface. It is not mounted in production
// unless an operator deliberately opts back in.
/** @type {boolean} */
const devRoutesEnabled = !isProd || process.env.DEV_ROUTES_ENABLED === 'true'

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dbUrl: process.env.DATABASE_URL!,
  jwtSecret: requireSecret('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  refreshSecret: requireSecret('REFRESH_SECRET'),
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
  mockMode: mockModeEnabled(),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
  devEmail: requireCredential('DEV_EMAIL', 'dev@pavati.com', devRoutesEnabled),
  devPassword: requireCredential('DEV_PASSWORD', 'Pavati@Dev2026', devRoutesEnabled),
  devRoutesEnabled,
  env,
}
