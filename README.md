# Pāvati Pustak

> Digital Trust, Donation & Receipt Management

Pāvati Pustak is a full-stack web application designed for trusts, NGOs, and community organizations to manage donations, generate official receipts, track campaigns, and communicate with members — all from a single platform.

Built as a TypeScript monorepo with an Express.js API, React frontend, and PostgreSQL database.

---

## Features

- **Multi-provider Authentication** — Phone, Email, and Google OAuth sign-in with JWT access/refresh token pairs
- **Trust Management** — Create and configure trusts with custom branding, registration details, financial year settings, and join policies (open, approval-based, invite-only)
- **Role-Based Access Control** — Granular permission system with 11 trust roles (Primary Admin, President, Secretary, Treasurer, Collector, etc.) and per-member permission overrides
- **Donation Tracking** — Record donations with multiple payment modes (Cash, UPI, Bank Transfer, Card, Online, Mixed), split payments, categories, and donor privacy controls (Public, Private, Anonymous)
- **Receipt Generation** — PDF receipt engine with customizable templates (A4/A5/A6/Custom page sizes), background images, field positioning, auto-numbering with configurable prefixes, and verification tokens
- **Payment Campaigns** — Create campaigns with suggested amounts, QR codes, and public donation pages via slug-based URLs
- **Announcements** — Publish notices, events, festival greetings, and meeting announcements with read tracking
- **Notifications** — Multi-channel messaging (Email via Resend, SMS, WhatsApp) for receipt delivery and trust communications
- **File Uploads** — Cloudflare R2 object storage with presigned URLs, or local disk fallback for development
- **Dashboard & Reports** — Donation summaries, collection analytics, and exportable reports
- **Audit Logging** — Full activity trail for compliance and accountability
- **Receipt Verification** — Public verification page using unique tokens to validate receipt authenticity

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js >= 20 |
| **Language** | TypeScript 5.6 |
| **Monorepo** | npm workspaces |
| **API Framework** | Express.js 4 |
| **ORM** | Prisma 6 |
| **Database** | PostgreSQL |
| **Frontend** | React 19, Vite 6, Tailwind CSS 4 |
| **State Management** | Zustand, TanStack React Query |
| **Forms** | React Hook Form + Zod validation |
| **PDF Engine** | pdf-lib with fontkit |
| **Object Storage** | Cloudflare R2 (S3-compatible) |
| **Email** | Resend |
| **Auth** | JWT (access + refresh tokens), Google OAuth 2.0 |
| **Testing** | Vitest, Supertest |
| **Logging** | Pino |

---

## Project Structure

```
pavati-app/
├── apps/
│   ├── api/                  # Express.js REST API
│   │   ├── prisma/           # Database schema & migrations
│   │   └── src/
│   │       ├── config/       # Environment configuration
│   │       ├── lib/          # Utilities (email, HTTP, logger)
│   │       ├── middleware/    # Auth, rate limiting, error handling
│   │       ├── modules/      # Feature modules (auth, trusts, donations, receipts, etc.)
│   │       ├── providers/    # External services (storage, messaging)
│   │       └── services/     # Business logic
│   └── web/                  # React SPA
│       └── src/
│           ├── app/          # Router configuration
│           ├── components/   # Shared UI components
│           ├── features/     # Page-level feature modules
│           ├── lib/          # Stores, API client, utilities
│           └── styles/       # Global styles
├── packages/
│   ├── shared/               # Shared types, schemas, permissions, utilities
│   └── receipt-engine/       # PDF receipt generation library
├── Procfile                  # Heroku deployment
├── package.json              # Root workspace config
└── tsconfig.base.json        # Shared TypeScript config
```

---

## Prerequisites

- **Node.js** >= 20 ([download](https://nodejs.org/))
- **npm** >= 10 (comes with Node.js)
- **PostgreSQL** >= 14 ([download](https://www.postgresql.org/download/))
- **Git** ([download](https://git-scm.com/))

Optional:
- **Cloudflare R2** account (for production file storage)
- **Resend** account (for email notifications)
- **Google Cloud Console** project (for OAuth sign-in)

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-org/pavati-app.git
cd pavati-app
```

### 2. Install dependencies

```bash
npm install
```

This installs all workspace dependencies (`apps/api`, `apps/web`, `packages/shared`, `packages/receipt-engine`) from the root.

### 3. Set up the database

Create a PostgreSQL database:

```sql
CREATE DATABASE pavati;
CREATE USER pavati WITH PASSWORD 'pavati_dev';
GRANT ALL PRIVILEGES ON DATABASE pavati TO pavati;
```

### 4. Configure environment variables

Copy the example environment files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/api/.env` and set your `DATABASE_URL` and other secrets. See [Environment Variables](#environment-variables) below or refer to [env-vars-guide.md](./env-vars-guide.md) for detailed instructions on obtaining each value.

### 5. Run database migrations

```bash
npm run db:migrate
```

### 6. (Optional) Seed the database

```bash
npm run db:seed
```

### 7. Build shared packages

```bash
npm run build
```

This compiles `@pavati/shared` and `@pavati/receipt-engine` before building the API and web app.

---

## Environment Variables

Both `apps/api/.env` and `apps/web/.env` are required. Example files are provided:

- [`apps/api/.env.example`](./apps/api/.env.example)
- [`apps/web/.env.example`](./apps/web/.env.example)

> **Never commit `.env` files to version control.** They are listed in `.gitignore`.

For a detailed guide on obtaining every variable value, see **[env-vars-guide.md](./env-vars-guide.md)**.

---

## Running the Application

### Development (recommended)

Starts both the API (port 4000) and web dev server (port 5173) concurrently with hot-reload:

```bash
npm run dev
```

### Individual services

```bash
# API only (with tsx watch)
npm run dev:api

# Web only (Vite dev server)
npm run dev:web
```

### Production build

```bash
npm run build
npm run start -w @pavati/api
```

The API serves the built web app from `apps/web/dist/` when `WEB_DIST_DIR` is set.

### Database commands

```bash
npm run db:migrate    # Run Prisma migrations
npm run db:seed       # Seed sample data
npm run db:studio     # Open Prisma Studio (browser UI)
```

### Type checking

```bash
npm run typecheck
```

### Tests

```bash
npm run test
```

---

## API Endpoints

All API routes are prefixed with `/api/v1/`:

| Module | Base Path | Description |
|--------|-----------|-------------|
| Auth | `/api/v1/auth` | Sign up, sign in, refresh tokens, Google OAuth |
| Trusts | `/api/v1/trusts` | CRUD for trust entities |
| Members | `/api/v1/trusts/:trustId/members` | Member management, roles, invites |
| Donations | `/api/v1/trusts/:trustsId/donations` | Record and manage donations |
| Receipts | `/api/v1/trusts/:trustId/receipts` | Generate, preview, and verify receipts |
| Templates | `/api/v1/trusts/:trustId/templates` | Receipt template editor |
| Campaigns | `/api/v1/campaigns` | Payment campaigns with QR codes |
| Announcements | `/api/v1/trusts/:trustId/announcements` | Trust announcements |
| Notifications | `/api/v1/trusts/:trustId/notifications` | Email/SMS/WhatsApp notifications |
| Reports | `/api/v1/trusts/:trustId/reports` | Donation reports and exports |
| Dashboard | `/api/v1/trusts/:trustId/dashboard` | Dashboard statistics |
| Users | `/api/v1/users` | User profile management |
| Uploads | `/api/v1/uploads` | File upload endpoints |
| Health | `/health` | Health check |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and ensure type checking passes: `npm run typecheck`
4. Run tests: `npm run test`
5. Commit with a descriptive message
6. Push to your fork and open a Pull Request

### Code conventions

- All source code is **TypeScript** with strict mode enabled
- Backend follows a **modular architecture** — each feature lives in `apps/api/src/modules/<feature>/`
- Frontend features live in `apps/web/src/features/<feature>/`
- Shared types and validation schemas are in `packages/shared/`
- Use **Zod** for runtime validation
- Use **Pino** for structured logging (not `console.log`)
- Never commit `.env` files or secrets

---

## License

MIT
