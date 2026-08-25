# Heroku + Cloudflare R2 + .tech — Deployment Plan

**Status:** Approved · Phases 1–4 COMPLETE · Phases 5–6 ready to execute
**Confirmed values:** app `pavati-pustak` (EU region assumed, verify via `heroku info`) · domain `pavati.tech` · DB addon live (`postgresql-animated-45955`) · R2 bucket + token created · secrets at `apps/api/.env.r2` (all 4 keys verified present)

## Execution-state notes (Phase 5 pre-flight)

- Local branch is **master**; deploy = `git push heroku master:main`… actually Heroku builds default branch pushed to; use `git push heroku master`.
- ALL session work is UNCOMMITTED (~40+ files). Deploying requires commits → plan: **one comprehensive commit** (features + deploy artifacts) approved by user before push.
- Root `.gitignore` must gain `.env.r2` BEFORE committing (currently unignored; file lives at `apps/api/.env.r2`).
- Heroku CLI not installed → install via `npm i -g heroku` (no sudo); user runs `heroku login` once interactively (browser), then agent drives all commands.
- Current registrar nameservers are orderbox-dns.com (Endurance panel) → will be replaced by Cloudflare-assigned NS during Phase 6.

## Current progress

- ✅ `@aws-sdk/client-s3@3.1116.0` + `@aws-sdk/s3-request-presigner` installed into `apps/api/package.json` (npm install completed before plan-mode lock)
- ⬜ Everything below pending execution

## Architecture

```
Browser ──► https://<domain>.tech            Heroku Basic dyno $7 (ONE process)
              │  Express: React SPA (static) + API (/api/v1)
              │  files ──► R2 private bucket, presigned GETs (free 10 GB)
              └  Prisma ─► Heroku Postgres Essential-0 $5 (1 GB)
```

Key fact: all disk I/O flows through `apps/api/src/providers/storage.ts` only.
DB URLs keep the format `${PUBLIC_BASE_URL}/uploads/<key>` in BOTH drivers → zero frontend changes.

---

## Phase 1 — Code: R2 storage driver

### 1a. `apps/api/src/config/index.ts`
Append after `uploadDir`:
```ts
storageDriver: (process.env.STORAGE_DRIVER as 'disk' | 'r2') ?? (process.env.R2_ACCOUNT_ID ? 'r2' : 'disk'),
r2AccountId: process.env.R2_ACCOUNT_ID ?? '',
r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
r2Bucket: process.env.R2_BUCKET ?? '',
webDistDir: process.env.WEB_DIST_DIR ?? '',
```

### 1b. `apps/api/src/providers/storage.ts` — rewrite as dual driver
- Keep exports/signature-compatible: `saveBuffer(buffer, ext, subdir)` → `{url, filename}`; `savePdf` unchanged wrapper.
- **New async:** `fileFromUrl(url): Promise<{ buffer: Buffer } | null>` (was sync).
- Driver selection helper `r2Active()` = storageDriver==='r2' && all 4 r2 vars set.
- Lazy singleton `S3Client({ region:'auto', endpoint: https://<accountId>.r2.cloudflarestorage.com, credentials })`.
- `saveBuffer` r2 path: key = `<subdir>/<ts>-<randomCode(6)>.<ext>`; PutObject with ContentType map {png,jpeg,jpg,webp,gif,pdf}; return url `${publicBaseUrl}/uploads/${key}`.
- `fileFromUrl` r2 path: parse key after `/uploads/`; GetObject; NoSuchKey → throw AppError(404,'File not found') (same semantics as disk).
- Export `presignedGetUrl(key, expiresIn=900)` via s3-request-presigner (used by uploads proxy in index.ts).

### 1c. Consumers of the now-async read
- `services/receipts.ts:79-80`:
  ```ts
  const background = template.backgroundImageUrl ? (await fileFromUrl(template.backgroundImageUrl))?.buffer ?? null : null
  const logo = trust.logoUrl ? (await fileFromUrl(trust.logoUrl))?.buffer ?? null : null
  ```
- `modules/receipts/routes.ts:101`: `const file = await fileFromUrl(receipt.pdfUrl)` — keep buffering + Content-Disposition (auth + filename behavior preserved).

### 1d. `apps/api/src/index.ts` — uploads route + SPA serving
Replace L34-36 static block:
```ts
if (r2Active()) {
  app.get(/^\/uploads\/(.+)$/, asyncHandler(async (req, res) => {
    const key = decodeURIComponent(req.params[0])
    if (!/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(key) || key.includes('..')) throw new AppError(400, 'Invalid file path')
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.redirect(302, await presignedGetUrl(key))
  }))
} else {
  /* existing ensureDir + express.static */
}
```
After all API routes, before notFound:
```ts
if (config.webDistDir) {
  const dist = path.isAbsolute(config.webDistDir) ? config.webDistDir : path.join(process.cwd(), config.webDistDir)
  app.use(express.static(dist))
  app.get(/^(?!\/api\/|\/uploads\/|\/health$).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}
```
Imports to add: AppError/asyncHandler from lib/http.js; r2Active/presignedGetUrl from providers/storage.js.

## Phase 2 — Deploy artifacts

- Root `Procfile`:
  ```
  release: npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
  web: node apps/api/dist/index.js
  ```
- Root package.json script: `"heroku-postbuild": "npm run build"` (existing build covers shared→receipt-engine→api→web).

## Phase 3 — Local verification (disk mode untouched)

1. `npm run typecheck` (all packages) + `npm test` → expect 47/47.
2. Optional R2 dry-run: scratch bucket + `.env` R2 vars → upload proof image → generate receipt → view PDF → restart server → files still served.

## Phase 4 — Cloudflare R2 setup (dashboard)

1. Create free CF account → R2 → create bucket `pavati-prod`, region auto, **private** (no public access, no custom domain, no r2.dev needed).
2. R2 → Manage API tokens → create token with Object Read+Write on that bucket → note Access Key ID / Secret / Account ID.

## Phase 5 — Heroku provisioning (finalized commands)

```bash
npm i -g heroku                       # agent (no sudo needed)
# → USER: run `heroku login` in own terminal (one-time browser auth)

heroku info pavati-pustak             # verify region/dynos
heroku git:remote -a pavati-pustak

# gitignore .env.r2, commit all work, then:
git push heroku master                # build + release-phase migrate + boot
heroku logs --tail

# config vars (R2 values sourced from apps/api/.env.r2, never echoed):
heroku config:set NODE_ENV=production WEB_DIST_DIR=apps/web/dist \
  JWT_SECRET=$(openssl rand -hex 32) REFRESH_SECRET=$(openssl rand -hex 32) \
  WEB_ORIGIN=https://pavati.tech PUBLIC_BASE_URL=https://pavati.tech \
  STORAGE_DRIVER=r2 R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=… -a pavati-pustak

DBURL=$(heroku config:get DATABASE_URL -a pavati-pustak)
heroku config:set "DATABASE_URL=${DBURL}?connection_limit=5" -a pavati-pustak
```
Order matters: set STORAGE_DRIVER vars BEFORE first boot so uploads go to R2 from request #1. Ideal sequence = set config vars FIRST, then push.

## Phase 6 — DNS for pavati.tech (finalized)

1. Agent: `heroku domains:add pavati.tech -a pavati-pustak` and `heroku domains:add www.pavati.tech -a pavati-pustak` → capture the two `<target>.herokudns.com` values.
2. User (Cloudflare dashboard): Add site `pavati.tech` → Free plan → note assigned NS pair.
3. User (registrar/Endurance panel): replace orderbox-dns nameservers with Cloudflare's two.
4. User (Cloudflare DNS): `CNAME @ → <apex target>` (flattening), `CNAME www → <www target>` — **grey cloud until HTTPS active**, then optional orange-cloud + Full(strict).
5. Heroku ACM auto-issues cert once DNS propagates; verify `https://pavati.tech/health`.

Fallback Option B (not chosen): registrar-only DNS, plain CNAME on `www`, apex unresolved.

## Phase 7 — Google OAuth go-live (optional, last)

GCP console → OAuth client → Authorized JavaScript origin `https://<domain>.tech` → then `heroku config:set GOOGLE_CLIENT_ID=… MOCK_MODE=false`. Verification QR URLs use `WEB_ORIGIN` (already https). Until this step, phone/email login works fine.

---

## Post-deploy smoke checklist

- [ ] `GET /health` returns ok over https
- [ ] Signup → create trust → upload logo/template background (prod DB starts empty)
- [ ] Create donation with UPI proof image → image renders (presigned redirect works)
- [ ] Generate receipt → PDF downloads with correct filename → public verify link works
- [ ] `heroku ps:restart` → images/PDFs still accessible (R2 persistence proven)
- [ ] SPA deep-link (e.g. /app/donations direct load) renders via fallback

## Ops notes & rollback

- Backups: Essential-0 has none automatic → weekly `heroku pg:backups:capture`.
- Rate-limit/lockout counters are in-memory → reset on dyno restart (acceptable).
- Rollback: `STORAGE_DRIVER=disk` reverts code path instantly; DB schema untouched by this work (no migrations added).
- Costs: dyno $7 + PG $5 = $12 ≤ $13 credit; R2 $0 (10 GB free); CF DNS $0; .tech renewal ~$50/yr after year 1.
