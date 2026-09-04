# Environment Variables Guide

This guide explains every environment variable used by Pāvati Pustak and how to obtain each value.

---

## Table of Contents

- [apps/api/.env](#appsapienv)
  - [DATABASE_URL](#database_url)
  - [JWT_SECRET](#jwt_secret)
  - [JWT_EXPIRES_IN](#jwt_expires_in)
  - [REFRESH_SECRET](#refresh_secret)
  - [PORT](#port)
  - [WEB_ORIGIN](#web_origin)
  - [PUBLIC_BASE_URL](#public_base_url)
  - [UPLOAD_DIR](#upload_dir)
  - [STORAGE_DRIVER](#storage_driver)
  - [R2_ACCOUNT_ID](#r2_account_id)
  - [R2_ACCESS_KEY_ID](#r2_access_key_id)
  - [R2_SECRET_ACCESS_KEY](#r2_secret_access_key)
  - [R2_BUCKET](#r2_bucket)
  - [R2_PUBLIC_URL](#r2_public_url)
  - [GOOGLE_CLIENT_ID](#google_client_id)
  - [RESEND_API_KEY](#resend_api_key)
  - [RESEND_FROM_EMAIL](#resend_from_email)
  - [MOCK_MODE](#mock_mode)
- [apps/web/.env](#appswebenv)
  - [VITE_GOOGLE_CLIENT_ID](#vite_google_client_id)

---

## apps/api/.env

### DATABASE_URL

| | |
|---|---|
| **Required** | Yes |
| **Example** | `postgresql://[user]:[password]@localhost:5432/[database]?schema=public` |

**What it does:** Connects the Prisma ORM to your PostgreSQL database.

**How to obtain:**

**Local PostgreSQL:**
1. Install PostgreSQL and create a database and user:
   ```sql
   CREATE DATABASE pavati;
   CREATE USER pavati WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE pavati TO pavati;
   ```
2. Construct the URL: `postgresql://[user]:[password]@[host]:[port]/[database]?schema=public`
   - Default host: `localhost`
   - Default port: `5432`

**Heroku Postgres:**
1. Go to your Heroku app dashboard → Resources → Heroku Postgres
2. Click "Settings" → "Database Credentials"
3. Use the `URI` value directly

**AWS RDS:**
1. Go to RDS Console → your instance → "Connectivity & security"
2. Use the "Endpoint & port" value
3. Format: `postgresql://[master_username]:[password]@[endpoint]:[port]/[database]?schema=public`

**Neon / Supabase / other cloud providers:**
1. Find the connection string in your dashboard's "Connection" or "Settings" panel
2. Paste directly

---

### JWT_SECRET

| | |
|---|---|
| **Required** | Yes (enforced in production) |
| **Example** | `k7Gq3xLm9P2wR5tY8nB4vJ1cF6hD0aE3sQ7iO2uK5xZ8mW4nT9rY1bV6gC0fH` |

**What it does:** Signs JWT access tokens. A weak or leaked value compromises all user sessions.

**How to generate:**

```bash
# Using OpenSSL (recommended)
openssl rand -base64 48

# Using Node.js
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# Using Python
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

> **Never** use a short or guessable string in production. The app will refuse to start if this is left as the default dev value.

---

### JWT_EXPIRES_IN

| | |
|---|---|
| **Required** | No |
| **Default** | `7d` |
| **Example** | `7d` |

**What it does:** Controls how long an access token remains valid. Uses the [ms](https://www.npmjs.com/package/ms) library format: `2h`, `7d`, `30m`, etc.

**How to set:** Use any valid ms-format string. Common values: `2h` (short), `7d` (default), `30d` (long).

---

### REFRESH_SECRET

| | |
|---|---|
| **Required** | Yes (enforced in production) |
| **Example** | `aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8gH9iJ0kL1mN2` |

**What it does:** Signs JWT refresh tokens. Separate from `JWT_SECRET` so access tokens can be rotated without invalidating refresh tokens.

**How to generate:**

```bash
openssl rand -base64 48
```

> Use a **different** value from `JWT_SECRET`.

---

### PORT

| | |
|---|---|
| **Required** | No |
| **Default** | `4000` |
| **Example** | `4000` |

**What it does:** The port the Express server listens on. Heroku sets this automatically via the `PORT` env var.

---

### WEB_ORIGIN

| | |
|---|---|
| **Required** | No |
| **Default** | `http://localhost:5173` |
| **Example** | `http://localhost:5173` |

**What it does:** Allowed CORS origin. Must match the URL where the frontend is served.

**How to set:**
- **Development:** `http://localhost:5173` (Vite default)
- **Production:** `https://your-domain.com`

---

### PUBLIC_BASE_URL

| | |
|---|---|
| **Required** | No |
| **Default** | `http://localhost:4000` |
| **Example** | `https://api.your-domain.com` |

**What it does:** The externally-accessible base URL of the API. Used to construct file upload URLs, receipt verification links, and email links.

**How to set:**
- **Development:** `http://localhost:4000`
- **Production:** `https://api.your-domain.com` or your Heroku app URL

---

### UPLOAD_DIR

| | |
|---|---|
| **Required** | No |
| **Default** | `./uploads` |
| **Example** | `./uploads` |

**What it does:** Local directory for file uploads when not using Cloudflare R2. Ignored when `STORAGE_DRIVER=r2`.

---

### STORAGE_DRIVER

| | |
|---|---|
| **Required** | No |
| **Default** | `r2` if `R2_ACCOUNT_ID` is set, otherwise `disk` |
| **Example** | `disk` |

**What it does:** Selects the file storage backend.
- `disk` — stores files in the local `UPLOAD_DIR`
- `r2` — stores files in Cloudflare R2

---

### R2_ACCOUNT_ID

| | |
|---|---|
| **Required** | Only if using R2 storage |
| **Example** | `your-cloudflare-account-id` |

**What it does:** Your Cloudflare account ID. Used to construct the R2 S3-compatible API endpoint.

**How to obtain:**
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select any domain or go to the right sidebar
3. Find your **Account ID** under "API" on the right panel, or go to **Workers & Pages** → your project → **Settings** → **General** → **Account ID**

---

### R2_ACCESS_KEY_ID

| | |
|---|---|
| **Required** | Only if using R2 storage |
| **Example** | `your-r2-access-key-id` |

**What it does:** R2 API access key for S3-compatible operations (upload, download).

**How to obtain:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → **Manage R2 API Tokens**
2. Click **Create API Token**
3. Set permissions to **Object Read & Write**
4. Select your bucket
5. Copy the **Access Key ID**

---

### R2_SECRET_ACCESS_KEY

| | |
|---|---|
| **Required** | Only if using R2 storage (shown once at creation) |
| **Example** | `your-r2-secret-access-key` |

**What it does:** R2 API secret key. Paired with `R2_ACCESS_KEY_ID` for authentication.

**How to obtain:**
1. Same screen as `R2_ACCESS_KEY_ID` above
2. Copy the **Secret Access Key** immediately after creation (it won't be shown again)

---

### R2_BUCKET

| | |
|---|---|
| **Required** | Only if using R2 storage |
| **Example** | `your-bucket-name` |

**What it does:** The name of the Cloudflare R2 bucket where files are stored.

**How to obtain:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → **Overview**
2. Your bucket name is listed there, or create a new one

---

### R2_PUBLIC_URL

| | |
|---|---|
| **Required** | No |
| **Example** | `https://pub-abc123.r2.dev` |

**What it does:** If set, file URLs use this public domain directly instead of presigned URLs. Required if you've configured a custom domain or public bucket access on R2.

**How to obtain:**
1. Go to R2 → your bucket → **Settings**
2. Under **Public Access**, enable and copy the **r2.dev** subdomain, or configure a custom domain

---

### GOOGLE_CLIENT_ID

| | |
|---|---|
| **Required** | No (Google sign-in disabled without it) |
| **Example** | `593007022712-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com` |

**What it does:** Validates Google OAuth ID tokens on the backend during Google sign-in.

**How to obtain:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project (or select existing)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add `http://localhost:5173` to **Authorized JavaScript origins** (for dev)
7. Add your production domain as well
8. Copy the **Client ID**

---

### RESEND_API_KEY

| | |
|---|---|
| **Required** | No (email notifications disabled without it) |
| **Example** | `re_your-resend-api-key` |

**What it does:** Authenticates with the Resend API to send transactional emails (receipts, notifications).

**How to obtain:**
1. Sign up at [resend.com](https://resend.com)
2. Go to **API Keys** → **Create API Key**
3. Copy the key (shown only once)
4. Free tier includes 100 emails/day and 3,000/month

---

### RESEND_FROM_EMAIL

| | |
|---|---|
| **Required** | Only if `RESEND_API_KEY` is set |
| **Default** | `onboarding@resend.dev` |
| **Example** | `no-reply@yourdomain.com` |

**What it does:** The "From" address on outgoing emails. Must be from a verified domain in Resend.

**How to set:**
1. For testing: use `onboarding@resend.dev` (Resend's default sandbox)
2. For production:
   1. Go to Resend → **Domains** → **Add Domain**
   2. Add the DNS records (SPF, DKIM) to your domain registrar
   3. Verify the domain
   4. Use `no-reply@yourdomain.com` as the from address

---

### MOCK_MODE

| | |
|---|---|
| **Required** | No |
| **Default** | `false` |
| **Example** | `false` |

**What it does:** When `true`, payment processing uses mock providers instead of real payment gateways. Useful for local development and testing.

---

## apps/web/.env

### VITE_GOOGLE_CLIENT_ID

| | |
|---|---|
| **Required** | No (Google sign-in button hidden without it) |
| **Example** | `593007022712-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com` |

**What it does:** The Google OAuth Client ID used by the frontend to initiate the Google sign-in flow. Must match `GOOGLE_CLIENT_ID` in `apps/api/.env`.

**How to obtain:** Same steps as [GOOGLE_CLIENT_ID](#google_client_id) above. This is the same value — just duplicated into the frontend env file because Vite requires `VITE_` prefixed variables to be available at build time.

---

## Quick Reference

| Variable | Where to get it | Required for dev? |
|----------|-----------------|-------------------|
| `DATABASE_URL` | PostgreSQL instance | Yes |
| `JWT_SECRET` | Generate with `openssl rand -base64 48` | Yes |
| `REFRESH_SECRET` | Generate with `openssl rand -base64 48` | Yes |
| `JWT_EXPIRES_IN` | Any valid ms-format string | No (default: `7d`) |
| `PORT` | Any available port | No (default: `4000`) |
| `WEB_ORIGIN` | Frontend URL | No (default: `http://localhost:5173`) |
| `PUBLIC_BASE_URL` | API URL | No (default: `http://localhost:4000`) |
| `UPLOAD_DIR` | Local path | No (default: `./uploads`) |
| `STORAGE_DRIVER` | `disk` or `r2` | No (auto-detect) |
| `R2_ACCOUNT_ID` | Cloudflare Dashboard | Only for R2 |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 API Tokens | Only for R2 |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 API Tokens | Only for R2 |
| `R2_BUCKET` | Cloudflare R2 Buckets | Only for R2 |
| `R2_PUBLIC_URL` | R2 bucket public access | No |
| `GOOGLE_CLIENT_ID` | Google Cloud Console | No |
| `RESEND_API_KEY` | Resend Dashboard | No |
| `RESEND_FROM_EMAIL` | Resend verified domain | No |
| `MOCK_MODE` | `true` or `false` | No (default: `false`) |
| `VITE_GOOGLE_CLIENT_ID` | Same as `GOOGLE_CLIENT_ID` | No |
