# SKAFF Academy — Backend API

Backend/API service for **SKAFF Academy**, a physical-campus-first digital campus
platform. This service is the counterpart to the existing **SKAFF-ACADEMY** Next.js
frontend and will eventually expose the APIs that frontend consumes for admissions,
student/staff accounts, programs, classes, materials, assignments, attendance,
results, fees, documents, announcements, and notifications.

> **Status: Backend Phase 1.** Program discovery and authentication are
> implemented. Admissions and every other business module are not — see
> [Current Implementation Status](#current-implementation-status) and
> [Planned Backend Modules](#planned-backend-modules) below.

## Relationship to SKAFF-ACADEMY (frontend)

SKAFF-ACADEMY (Next.js) is the public site, admissions flow, and student/staff
portal. This repository (SKAFF-ACADEMY-BN) is the API it will call over HTTP. They
are deployed and versioned independently but must stay aligned on domain vocabulary
— see [Domain Contract](#domain-contract).

## Tech Stack

- **Runtime:** Node.js
- **Framework:** NestJS (TypeScript)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **API docs:** Swagger / OpenAPI (`@nestjs/swagger`)
- **Validation:** `class-validator` / `class-transformer`
- **Config:** `@nestjs/config`, validated at startup
- **Auth:** JWT (`@nestjs/jwt`, Passport `passport-jwt`), passwords hashed with Argon2

## Architecture

```
src/
  common/
    enums/              Shared domain vocabulary (statuses, modes) — see Domain Contract
    filters/             Global exception filter (consistent JSON error envelope)
  config/
    configuration.ts     Typed accessor for env-derived app config
    env.validation.ts    class-validator schema; fails fast on invalid/missing env vars
  health/
    health.controller.ts    GET /api/v1/health
  prisma/
    prisma.service.ts    Single shared PrismaClient (connect/disconnect lifecycle)
    prisma.module.ts     @Global module exporting PrismaService
  programs/
    programs.controller.ts  GET /api/v1/programs, GET /api/v1/programs/:slug
    programs.service.ts     All Prisma access for programs — controller never queries Prisma directly
  auth/
    auth.controller.ts   POST /auth/login, GET /auth/me, GET /auth/staff-only (demo)
    auth.service.ts      Login, password verification, JWT signing, safe user projection
    strategies/          Passport JwtStrategy (verifies bearer tokens)
    guards/              JwtAuthGuard, UserTypesGuard (STUDENT/STAFF authorization)
    decorators/          @CurrentUser(), @UserTypes(...)
    dto/                 LoginDto, UserSummaryDto, LoginResponseDto, profile summaries
  app.module.ts
  main.ts                 Bootstrap: prefix, CORS, Helmet, ValidationPipe, Swagger

prisma/
  schema.prisma           User, StudentProfile, StaffProfile, Program, Intake, ClassGroup, Enrollment
  seed.ts                 8 official programs + dev trainer/student accounts (see Seed Data)

test/
  app.e2e-spec.ts         HTTP-layer e2e test (health + error envelope)
  programs.e2e-spec.ts    Program listing/ordering, slug lookup, 404
  auth.e2e-spec.ts        Login, /auth/me, invalid tokens, STUDENT/STAFF guard
```

**Response convention:**
- Successful responses return the resource/data directly (NestJS default
  serialization) — no artificial `{ data: ... }` wrapper.
- Errors always use a single consistent envelope, produced by the global
  `AllExceptionsFilter` (`src/common/filters/http-exception.filter.ts`):

  ```json
  {
    "success": false,
    "statusCode": 400,
    "message": "Validation failed",
    "errors": ["name must be a string"],
    "timestamp": "2026-08-20T12:00:00.000Z",
    "path": "/api/v1/some-endpoint"
  }
  ```

  Stack traces are logged server-side only, never returned in the response body.
  In non-production environments, unhandled (non-`HttpException`) errors include
  the underlying error message to aid debugging; in production they are reported
  generically as `"Internal server error"`.

**API prefix:** every route is served under `/api/v1` (e.g. `GET /api/v1/health`).

## Prerequisites

- Node.js 20+
- npm
- PostgreSQL 14+ (local install, Docker container, or hosted instance)

## Installation

```bash
npm install
```

`npm install` also runs `prisma generate` automatically (`postinstall`).

## Environment Variables

Copy `.env.example` to `.env` and fill in real values. Required variables are
validated at startup (`src/config/env.validation.ts`) — the app will refuse to
start if any are missing or malformed.

| Variable         | Description                                             | Example                                                                     |
| ---------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `NODE_ENV`       | `development` \| `test` \| `staging` \| `production`      | `development`                                                                 |
| `PORT`           | HTTP port the API listens on                              | `3000`                                                                        |
| `DATABASE_URL`   | PostgreSQL connection string used by Prisma               | `postgresql://postgres:postgres@localhost:5432/skaff_academy?schema=public`  |
| `FRONTEND_URL`   | Origin of the SKAFF-ACADEMY frontend, used for CORS       | `http://localhost:3001`                                                       |
| `JWT_SECRET`     | Signing secret for access tokens. At least 16 characters. Generate a real, unique value per environment (e.g. `openssl rand -base64 48`) — never reuse the placeholder. | *(no default — required)* |
| `JWT_EXPIRES_IN` | Access token lifetime (`jsonwebtoken`/`ms` duration string) | `1d`                                                                         |

Never commit `.env` — it is gitignored. Only `.env.example` (with placeholder
values) is committed. There is currently no refresh-token flow: when an access
token expires the user simply logs in again.

## PostgreSQL Setup

Any reachable PostgreSQL 14+ instance works. For local development:

```bash
# Docker
docker run --name skaff-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=skaff_academy -p 5432:5432 -d postgres:16
```

Then set `DATABASE_URL` in `.env` to point at it (see table above).

## Prisma Commands

```bash
npm run prisma:generate        # Regenerate the Prisma Client
npm run prisma:migrate:dev     # Create/apply a migration in development
npm run prisma:migrate:deploy  # Apply pending migrations (CI/production)
npm run prisma:validate        # Validate prisma/schema.prisma
npm run prisma:studio          # Open Prisma Studio
npx prisma db seed             # Run prisma/seed.ts (also runs automatically after `migrate dev`)
```

**Note:** `PrismaService` attempts to connect on application startup and logs
an error if the database is unreachable, but it does **not** crash the process.
No route currently depends on a live DB connection at *startup* (though
programs/auth routes will of course fail per-request without one). This should
be revisited (fail-fast, or a DB-aware readiness check) as more of the
platform comes to depend on persistence.

### Database Models (current)

`User`, `StudentProfile`, `StaffProfile`, `Program`, `Intake`, `ClassGroup`,
`Enrollment` — see `prisma/schema.prisma` for fields/enums. The remaining
entities in the [Domain Contract](#domain-contract) are not modeled yet.

### Seed Data

`prisma/seed.ts` is idempotent (safe to rerun) and creates/updates:

- The 8 official SKAFF Academy programs, in their official display order
  (see [Programs API](#programs-api)) — never reorder or replace this catalog.
- One development trainer (STAFF) and one development student (STUDENT)
  account — see [Authentication](#authentication) for their login credentials.
- One development intake, class group, and enrollment linking that student to
  Full-Stack Development, purely to exercise the relations above.

None of the development accounts or academic records are real Academy data.

## Development Commands

```bash
npm run start:dev     # Watch mode
npm run start         # Single run
npm run start:prod    # Run the compiled build (dist/)
npm run build         # Compile TypeScript
npm run lint          # ESLint (--fix)
npm run lint:check    # ESLint (no fix, used in CI)
npm run format        # Prettier (write)
npm run format:check  # Prettier (check only)
npm test              # Unit tests
npm run test:e2e      # e2e tests (HTTP layer)
npm run test:cov      # Unit tests with coverage
```

## API Documentation

With the app running in a non-production environment:

- Swagger UI: `http://localhost:3000/api/docs` (bearer-token auth supported — click **Authorize** and paste an access token)
- OpenAPI JSON: `http://localhost:3000/api/docs-json`

Swagger is not exposed when `NODE_ENV=production`.

## Health Check

```
GET /api/v1/health
```

```json
{ "status": "ok", "timestamp": "2026-08-20T12:00:00.000Z", "environment": "development" }
```

## Programs API

Public, unauthenticated endpoints backed by `ProgramsService` (the controller
never queries Prisma directly):

```
GET /api/v1/programs         → active programs, ordered by displayOrder ascending
GET /api/v1/programs/:slug   → a single active program, or 404 if the slug doesn't exist / isn't active
```

The 8 programs and their official order (`displayOrder` 1–8): Video
Production, Audio Production, Full-Stack Development, Backend Development,
Frontend Development, UI/UX Design, Power of AI, Digital Marketing & Social
Media Management. This order comes from seed data — see [Seed Data](#seed-data).

## Authentication

JWT bearer auth. Passwords are hashed with Argon2 (`argon2` package) — there
are no plaintext passwords anywhere in the system.

```
POST /api/v1/auth/login   → { email, password } → { accessToken, user }
GET  /api/v1/auth/me      → current user (requires Authorization: Bearer <token>)
GET  /api/v1/auth/staff-only  → demo route restricted to STAFF, proves the UserTypes guard works
```

`user` in the login response (and the `/auth/me` response) never includes
`passwordHash`, and includes `studentProfile`/`staffProfile` only for the
matching account type (the other is `null`):

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "cmt34z91h000dv70st8n4chga",
    "email": "student@skaffacademy.local",
    "userType": "STUDENT",
    "isActive": true,
    "studentProfile": { "id": "...", "studentNumber": "SKF-2026-0001", "fullName": "Aline Uwimana", "status": "ACTIVE" },
    "staffProfile": null
  }
}
```

**Login failures are intentionally indistinguishable:** an unknown email, a
wrong password, and a deactivated (`isActive: false`) account all return the
same `401 { "message": "Invalid email or password" }` — this avoids leaking
whether an email is registered or whether an account has been deactivated. A
token also stops working immediately if the account is deactivated after it
was issued, since `/auth/me` and every guarded route re-check `isActive` on
every request rather than trusting the token's claims.

**Authorization foundation:** `@UserTypes(UserType.STAFF)` (or `.STUDENT`),
combined with `@UseGuards(JwtAuthGuard, UserTypesGuard)`, restricts a route to
one or both account types. `GET /api/v1/auth/staff-only` is a minimal demo of
this — repurpose or remove it once a real STAFF-only route exists. There is no
finer-grained permission system yet (see [User Model / Account Rules](#domain-contract)).

**Development login credentials** (seeded — never use in staging/production):

| Role    | Email                          | Password        |
| ------- | ------------------------------- | ---------------- |
| STAFF   | `trainer@skaffacademy.local`    | `SkaffDev2026!`   |
| STUDENT | `student@skaffacademy.local`    | `SkaffDev2026!`   |

## Domain Contract

The SKAFF-ACADEMY frontend already uses the following entity names and status
vocabularies. `User`, `StudentProfile`, `StaffProfile`, `Program`, `Intake`,
`ClassGroup`, and `Enrollment` are now implemented as Prisma models
(`prisma/schema.prisma`); the rest are not modeled yet. Future modules **must**
use these exact names/values to stay aligned with the frontend — do not invent
conflicting terminology.

**Entities:** `User`, `StudentProfile`, `StaffProfile`, `Program`, `Intake`,
`ClassGroup`, `Enrollment`, `Application`, `ApplicationDocument`, `Module`,
`LearningMaterial`, `ClassSession`, `Assignment`, `Submission`,
`AttendanceRecord`, `Result`, `FeeRecord`, `PaymentTransaction`, `Announcement`,
`DocumentRequest`, `Notification`.

**Account families:** only `STUDENT` and `STAFF` (`UserType` enum — teachers
and admins are both `STAFF`; there is deliberately no separate `ADMIN` type;
finer-grained permissions can be layered on later via `@UserTypes(...)`).

**Application statuses** (`src/common/enums/application-status.enum.ts`):
`draft`, `submitted`, `under_review`, `more_information_required`, `approved`,
`rejected`, `enrolled`.

**Student statuses** (`src/common/enums/student-status.enum.ts`): `active`,
`pending_payment`, `on_hold`, `suspended`, `completed`, `withdrawn`.

**Class session modes** (`src/common/enums/class-session-mode.enum.ts`):
`physical`, `online`, `offsite`. The platform is physical-campus-first — `online`
and `offsite` are the exception, not the default.

## Current Implementation Status

Implemented (Backend Phase 1 — programs discovery + authentication, on top of
the earlier infrastructure foundation):

- NestJS project structure, strict TypeScript, ESLint + Prettier
- Environment configuration with startup validation (now includes `JWT_SECRET`/`JWT_EXPIRES_IN`)
- Prisma wired to PostgreSQL: `User`, `StudentProfile`, `StaffProfile`, `Program`, `Intake`, `ClassGroup`, `Enrollment`
- Idempotent seed script: 8 official programs + dev trainer/student accounts with real Argon2 password hashes
- Global `/api/v1` prefix
- `GET /api/v1/health`
- **Programs API** — `GET /api/v1/programs`, `GET /api/v1/programs/:slug` (public, ordered, 404-safe)
- **Authentication** — `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, JWT bearer tokens, Argon2 password hashing
- **Authorization foundation** — `@UserTypes(...)` + `UserTypesGuard` for STUDENT/STAFF-restricted routes
- Global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform)
- Global exception filter with a consistent error envelope
- CORS restricted to `FRONTEND_URL` (plus localhost in non-production)
- Helmet security headers
- Swagger/OpenAPI at `/api/docs` (non-production only), with bearer-auth support
- Unit tests (health controller, `UserTypesGuard`) and e2e tests (health, programs, auth)

**Not implemented** (by design — future phases): admissions business logic,
applicant documents, student conversion from application, staff management
beyond the base account, classes/materials/assignments, attendance, results,
fees/payments, document requests, announcements, notifications, file uploads,
email/SMS, refresh-token rotation.

## Planned Backend Modules

Suggested order for subsequent phases:

1. **Admissions** — `Application`, `ApplicationDocument`, application status
   workflow, converting an approved application into a `StudentProfile`
2. **Staff & student management** — richer `StaffProfile`/`StudentProfile`
   editing, staff permission granularity beyond STUDENT/STAFF
3. **Classes & enrollment management** — richer `ClassGroup`/`Enrollment`
   workflows, `ClassSession`
4. **Learning delivery** — `LearningMaterial`, `Assignment`, `Submission`
5. **Attendance & results** — `AttendanceRecord`, `Result`
6. **Fees & payments** — `FeeRecord`, `PaymentTransaction`
7. **Documents & communication** — `DocumentRequest`, `Announcement`,
   `Notification`

Each phase should add the corresponding Prisma models/migrations, a feature
module under `src/`, DTOs validated via `class-validator`, and Swagger
annotations — following the conventions established so far.
