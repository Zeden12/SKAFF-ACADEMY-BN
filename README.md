# SKAFF Academy — Backend API

Backend/API service for **SKAFF Academy**, a physical-campus-first digital campus
platform. This service is the counterpart to the existing **SKAFF-ACADEMY** Next.js
frontend and will eventually expose the APIs that frontend consumes for admissions,
student/staff accounts, programs, classes, materials, assignments, attendance,
results, fees, documents, announcements, and notifications.

> **Status: backend foundation only.** No business/domain modules are implemented
> yet — see [Current Implementation Status](#current-implementation-status) and
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

## Architecture

```
src/
  common/
    enums/            Shared domain vocabulary (statuses, modes) — see Domain Contract
    filters/           Global exception filter (consistent JSON error envelope)
  config/
    configuration.ts   Typed accessor for env-derived app config
    env.validation.ts  class-validator schema; fails fast on invalid/missing env vars
  health/
    health.controller.ts  GET /api/v1/health
    health.module.ts
  prisma/
    prisma.service.ts  Single shared PrismaClient (connect/disconnect lifecycle)
    prisma.module.ts   @Global module exporting PrismaService
  app.module.ts
  main.ts               Bootstrap: prefix, CORS, Helmet, ValidationPipe, Swagger

prisma/
  schema.prisma          Datasource/generator only — no domain models yet

test/
  app.e2e-spec.ts         HTTP-layer e2e test (health + error envelope)
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

| Variable       | Description                                            | Example                                                              |
| -------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| `NODE_ENV`     | `development` \| `test` \| `staging` \| `production`      | `development`                                                         |
| `PORT`         | HTTP port the API listens on                              | `3000`                                                                 |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma                | `postgresql://postgres:postgres@localhost:5432/skaff_academy?schema=public` |
| `FRONTEND_URL` | Origin of the SKAFF-ACADEMY frontend, used for CORS        | `http://localhost:3001`                                               |

Never commit `.env` — it is gitignored. Only `.env.example` (with placeholder
values) is committed.

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
```

The schema currently defines only the `datasource`/`generator` blocks — no
domain models yet, so `prisma migrate dev` will produce an (initially empty)
baseline migration. This is intentional: see
[Planned Backend Modules](#planned-backend-modules).

**Note:** `PrismaService` attempts to connect on application startup and logs
an error if the database is unreachable, but it does **not** crash the process
— no feature currently depends on the database, so there is nothing yet for an
unavailable DB to break. This should be revisited (fail-fast, or a DB-aware
readiness check) once the first persistence-dependent module ships.

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

- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON: `http://localhost:3000/api/docs-json`

Swagger is not exposed when `NODE_ENV=production`.

## Health Check

```
GET /api/v1/health
```

```json
{ "status": "ok", "timestamp": "2026-08-20T12:00:00.000Z", "environment": "development" }
```

## Domain Contract

The SKAFF-ACADEMY frontend already uses the following entity names and status
vocabularies. None of these are implemented as Prisma models yet, but future
modules **must** use these exact names/values to stay aligned with the frontend
— do not invent conflicting terminology.

**Entities:** `User`, `StudentProfile`, `StaffProfile`, `Program`, `Intake`,
`ClassGroup`, `Enrollment`, `Application`, `ApplicationDocument`, `Module`,
`LearningMaterial`, `ClassSession`, `Assignment`, `Submission`,
`AttendanceRecord`, `Result`, `FeeRecord`, `PaymentTransaction`, `Announcement`,
`DocumentRequest`, `Notification`.

**Account families:** only `STUDENT` and `STAFF` (teachers and admins are both
`STAFF`; finer-grained permissions can be layered on later).

**Application statuses** (`src/common/enums/application-status.enum.ts`):
`draft`, `submitted`, `under_review`, `more_information_required`, `approved`,
`rejected`, `enrolled`.

**Student statuses** (`src/common/enums/student-status.enum.ts`): `active`,
`pending_payment`, `on_hold`, `suspended`, `completed`, `withdrawn`.

**Class session modes** (`src/common/enums/class-session-mode.enum.ts`):
`physical`, `online`, `offsite`. The platform is physical-campus-first — `online`
and `offsite` are the exception, not the default.

## Current Implementation Status

Implemented (this phase — backend foundation only):

- NestJS project structure, strict TypeScript, ESLint + Prettier
- Environment configuration with startup validation
- Prisma wired to PostgreSQL (no domain models yet)
- Global `/api/v1` prefix
- `GET /api/v1/health`
- Global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform)
- Global exception filter with a consistent error envelope
- CORS restricted to `FRONTEND_URL` (plus localhost in non-production)
- Helmet security headers
- Swagger/OpenAPI at `/api/docs` (non-production only)
- Unit test (health controller) and e2e test (HTTP layer)

**Not implemented** (by design — future phases): authentication/JWT, users,
students, staff management, admissions business logic, file uploads, programs
CRUD, enrollments, classes, materials, assignments, attendance, grades,
payments, documents, notifications.

## Planned Backend Modules

Suggested order for subsequent phases, based on the domain contract above:

1. **Auth & accounts** — `User`, STUDENT/STAFF account families, sessions/JWT
2. **Programs & intakes** — `Program`, `Intake`, `Module`
3. **Admissions** — `Application`, `ApplicationDocument`, application status
   workflow
4. **Students & staff profiles** — `StudentProfile`, `StaffProfile`
5. **Classes & enrollment** — `ClassGroup`, `Enrollment`, `ClassSession`
6. **Learning delivery** — `LearningMaterial`, `Assignment`, `Submission`
7. **Attendance & results** — `AttendanceRecord`, `Result`
8. **Fees & payments** — `FeeRecord`, `PaymentTransaction`
9. **Documents & communication** — `DocumentRequest`, `Announcement`,
   `Notification`

Each phase should add the corresponding Prisma models/migrations, a feature
module under `src/`, DTOs validated via `class-validator`, and Swagger
annotations — following the conventions established in this foundation phase.
