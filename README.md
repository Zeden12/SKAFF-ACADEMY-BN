# SKAFF Academy — Backend API

Backend/API service for **SKAFF Academy**, a physical-campus-first digital campus
platform. This service is the counterpart to the existing **SKAFF-ACADEMY** Next.js
frontend and will eventually expose the APIs that frontend consumes for admissions,
student/staff accounts, programs, classes, materials, assignments, attendance,
results, fees, documents, announcements, and notifications.

> **Status: Backend Phase 2.** Program discovery, authentication, intakes, and
> the full admissions/admissions-review/enrollment-conversion workflow are
> implemented. Academic delivery (materials, assignments, attendance,
> results), fees, and communications are not — see
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
  intakes/
    intakes.service.ts        Public "current eligible intake" lookup + STAFF admin CRUD
    admin-intakes.controller.ts  /admin/intakes (STAFF only)
    intake-eligibility.util.ts   Single source of truth for "is this intake open" — see Intakes API
  applications/
    applications.controller.ts       Public applicant-facing endpoints (/applications)
    applications.service.ts          Shared lookups, applicant self-service, response mapping
    admin-applications.controller.ts /admin/applications (STAFF only)
    admin-applications.service.ts    Queue/detail/review actions
    enrollment-conversion.service.ts APPROVED → User + StudentProfile + Enrollment (transactional)
    application-status.policy.ts     Central state-transition table — see State Machine
    application-history.util.ts      Shapes ApplicationHistoryEntry rows (PUBLIC/INTERNAL)
    dto/                             ~15 request/response DTOs — see Applications API
  app.module.ts
  main.ts                 Bootstrap: prefix, CORS, Helmet, ValidationPipe, Swagger

prisma/
  schema.prisma           User, StudentProfile, StaffProfile, Program, Intake, ClassGroup,
                           Enrollment, Application, ApplicationDocument, ApplicationHistoryEntry,
                           SequenceCounter
  seed.ts                 8 official programs + dev accounts + 7 demo applications (see Seed Data)

test/
  app.e2e-spec.ts               HTTP-layer e2e test (health + error envelope)
  programs.e2e-spec.ts          Program listing/ordering, slug lookup, 404
  auth.e2e-spec.ts              Login, /auth/me, invalid tokens, STUDENT/STAFF guard
  intakes.e2e-spec.ts           Current-intake lookup, admin intake CRUD, STAFF protection
  applications.e2e-spec.ts      Public application create/update/submit, intake-eligibility
                                 rejections, applicant verification
  admin-applications.e2e-spec.ts Review lifecycle, state machine, enrollment conversion
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
`Enrollment`, `Application`, `ApplicationDocument`, `ApplicationHistoryEntry`,
`SequenceCounter` — see `prisma/schema.prisma` for fields/enums. The remaining
entities in the [Domain Contract](#domain-contract) are not modeled yet.

`SequenceCounter` is a generic atomic counter (one row per key, e.g.
`application-2026`) backing server-generated identifiers — see
[Application Reference & Student Number Generation](#application-reference--student-number-generation).

### Seed Data

`prisma/seed.ts` is idempotent (safe to rerun) and creates/updates:

- The 8 official SKAFF Academy programs, in their official display order
  (see [Programs API](#programs-api)) — never reorder or replace this catalog.
- One development trainer (STAFF) and one development student (STUDENT)
  account — see [Authentication](#authentication) for their login credentials.
- One development intake (`applicationsOpen: true`, so the public admissions
  flow can be exercised end-to-end), class group, and enrollment linking that
  student to Full-Stack Development.
- 7 development applications against that intake, one per `ApplicationStatus`
  value (`DRAFT` … `ENROLLED`), each with a realistic history trail — see
  `SKA-APP-2026-9001` through `9007` in `prisma/seed.ts`. The `ENROLLED` row
  (`9007`) is a display-only demo: unlike a real `/enroll` call, it does not
  wire up an actual `User`/`StudentProfile`/`Enrollment` chain.

Seed/demo references and student numbers deliberately use the `9000+` range
(`SKA-APP-2026-9001`, `SKF-2026-9000`) so they can never collide with the real
`SequenceCounter`-generated values, which start at `0001` each year.

None of the development accounts, intakes, or applications are real Academy data.

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
    "studentProfile": { "id": "...", "studentNumber": "SKF-2026-9000", "fullName": "Aline Uwimana", "status": "ACTIVE" },
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

## Intakes API

The canonical academic relationship: **Program → Intake → Application →
(approved) → explicit enrollment conversion → User + StudentProfile →
Enrollment**. An `Intake` belongs to exactly one `Program`.

Public:

```
GET /api/v1/programs/:slug/intakes/current
```

Always returns `200`. There is deliberately no "closed" error response — the
frontend Apply button stays visible regardless of intake state, so this
endpoint returns a display-ready result either way:

```json
// An intake is open
{ "available": true, "intake": { "id": "...", "name": "...", "applicationsOpen": true, ... }, "message": null }

// No intake currently accepts applications
{ "available": false, "intake": null, "message": "Applications are currently closed for this program." }
```

"Current" means the most recently created intake (`createdAt` desc) among
those where `applicationsOpen = true`, `status` is not `COMPLETED`/`CANCELLED`,
`applicationOpenAt` (if set) has passed, and `applicationCloseAt` (if set)
hasn't — see `intake-eligibility.util.ts`. This same rule is re-checked
server-side on every application creation; the frontend fetching this
endpoint moments earlier is never trusted on its own.

STAFF only (`@ApiBearerAuth`, `UserTypes(STAFF)`):

```
GET    /api/v1/admin/intakes                          filters: programId, status, applicationsOpen
POST   /api/v1/admin/intakes
GET    /api/v1/admin/intakes/:id
PATCH  /api/v1/admin/intakes/:id                       programId is immutable after creation
PATCH  /api/v1/admin/intakes/:id/applications/open
PATCH  /api/v1/admin/intakes/:id/applications/close
```

There is intentionally no delete endpoint — an `Intake` may already be
referenced by `Application`/`ClassGroup`/`Enrollment` rows, and Prisma's
`onDelete: Restrict` on those relations backs this up at the DB level.

## Applications API

Applicants need **no account** — an `Application` is a standalone record
(`fullName`/`email`/`phone`/education fields), not tied to a `User` until
[enrollment conversion](#enrollment-conversion). "Applicants are not Students
yet" holds all the way through `APPROVED`.

```
POST   /api/v1/applications                    create a DRAFT
PATCH  /api/v1/applications/:reference          edit (DRAFT or MORE_INFORMATION_REQUIRED only)
POST   /api/v1/applications/:reference/submit   DRAFT → SUBMITTED
GET    /api/v1/applications/:reference/status   read-only, applicant-safe view
POST   /api/v1/applications/:reference/resubmit MORE_INFORMATION_REQUIRED → SUBMITTED
POST   /api/v1/applications/:reference/documents  attach document metadata (no file storage yet)
```

Creation verifies the `Program` is active, resolves/re-verifies the `Intake`
belongs to that program and [currently accepts applications](#intakes-api),
generates the `reference` server-side, and starts the record as `DRAFT`.
Submission additionally requires `highestEducationLevel`, `previousInstitution`,
and `completionYear` to be filled in (a `400` lists whichever are still
missing) — everything else stays optional through submission.

Every one of these endpoints returns the same `ApplicantApplicationViewDto`
shape: personal + education fields, `program`/`intake`, `documents`, `canUpdate`/
`canResubmit` flags, and **PUBLIC-only** history — never `internalAdminNotes`,
never an `INTERNAL` history entry, regardless of what staff have written
internally about the application.

### Applicant verification (interim, pre-auth)

A `reference` (`SKA-APP-2026-0001`) is not a secret — it is not treated as
authentication on its own. Every endpoint above except creation itself
requires `verificationEmail` (body field, or query param for the `GET
.../status` request) matching the application's current `email`. A wrong
email and a nonexistent reference return the **identical** `404`, so guessing
a reference can't be used to confirm it exists or to probe someone else's
data.

This is a deliberately lightweight, interim mechanism — there is no OTP or
email-confirmation link yet. It should be replaced by real applicant
authentication/secure tracking in a future phase; until then, treat
`verificationEmail` as "proof you know the email," not as a password.

### State machine

Enforced centrally in `application-status.policy.ts` — every status change in
every service goes through `assertValidTransition`, so the rules can't drift
between call sites:

```
DRAFT                     → SUBMITTED
SUBMITTED                 → UNDER_REVIEW
UNDER_REVIEW               → MORE_INFORMATION_REQUIRED | APPROVED | REJECTED
MORE_INFORMATION_REQUIRED → SUBMITTED
APPROVED                   → ENROLLED   (only via enrollment conversion)
REJECTED, ENROLLED          (terminal)
```

`REJECTED → APPROVED` and `ENROLLED → UNDER_REVIEW` are structurally
impossible, not just discouraged. Applicants have no endpoint capable of
setting `APPROVED` or `ENROLLED` — only the STAFF-only admin API can.

## Admin Admissions API

STAFF only (`@ApiBearerAuth`, `UserTypes(STAFF)`):

```
GET   /api/v1/admin/applications                        search, status, programId, intakeId, page, pageSize, sortBy, sortDir
GET   /api/v1/admin/applications/:reference              full detail: internal notes, full history, enrollmentReadiness
PATCH /api/v1/admin/applications/:reference/under-review SUBMITTED → UNDER_REVIEW
POST  /api/v1/admin/applications/:reference/request-information  UNDER_REVIEW → MORE_INFORMATION_REQUIRED (message required)
POST  /api/v1/admin/applications/:reference/approve       UNDER_REVIEW → APPROVED (does NOT create a student)
POST  /api/v1/admin/applications/:reference/reject        UNDER_REVIEW → REJECTED (applicant-facing message required)
PATCH /api/v1/admin/applications/:reference/internal-notes  replace internal notes (never shown to the applicant)
POST  /api/v1/admin/applications/:reference/enroll        APPROVED → ENROLLED — see Enrollment Conversion
```

The list endpoint returns `counts` — a breakdown by every `ApplicationStatus`
computed from the *other* active filters (search/program/intake) via a
Postgres `groupBy`, so an admin dashboard can render status tabs with live
counts without a second request.

## Enrollment Conversion

Approving an application (`UNDER_REVIEW → APPROVED`) **never** automatically
creates a `User`, `StudentProfile`, or `Enrollment` — it only marks the
application "ready for enrollment" (`enrollmentReadiness: true` in the admin
detail view). Conversion is a deliberate, separate STAFF action:

```
POST /api/v1/admin/applications/:reference/enroll
Body: { "classGroupId"?: string }
```

Inside one Prisma transaction:

1. Re-checks the application is still `APPROVED` (closes the race window
   between an earlier read and this write).
2. If `classGroupId` is given, verifies it belongs to the *same* `Program`
   **and** `Intake` as the application — a mismatched class group is a `400`,
   never silently ignored. Omit it to leave the enrollment unassigned for a
   staff member to assign a class group later.
3. Resolves a `User` by the application's email: reuses an existing
   `STUDENT` account (and its `StudentProfile`, if a returning applicant
   already has one — never duplicated or overwritten), rejects with `409` if
   the email belongs to a `STAFF` account, or creates a new `User`.
4. A newly created `User` is **inactive** (`isActive: false`) with an
   Argon2 hash of random bytes as its password — not a guessable default,
   not emailed anywhere (no email flow exists yet). It cannot log in until a
   future account-activation flow (email verification + real password set)
   flips `isActive` to `true`. `StudentProfile.status` is set to `ACTIVE`
   immediately, though — that field tracks academic standing, which is
   independent of login-credential activation.
5. Creates the `Enrollment` (`Program`/`Intake`/optional `ClassGroup`,
   linked back to the `Application` via a unique `applicationId`).
6. Marks the `Application` `ENROLLED`, sets `enrolledAt`, and appends a
   `PUBLIC` history entry.

Re-running `/enroll` on an already-converted application is rejected —
first by the status check (no longer `APPROVED`), and, as a second line of
defense against a genuine race between two concurrent requests, by the
database-level unique constraint on `Enrollment.applicationId`.

### Application reference & student number generation

Both are generated server-side — never trusted from the client — via
`SequenceService` (`src/prisma/sequence.service.ts`), which atomically
increments a row in the generic `SequenceCounter` table with a single
`INSERT … ON CONFLICT DO UPDATE … RETURNING` statement (safe under
concurrent requests; no read-then-write race). The counter increment happens
inside the same transaction as the row it numbers, so a failed application
creation or enrollment conversion never burns a number.

```
Application reference:  SKA-APP-{year}-{seq}   e.g. SKA-APP-2026-0001
Student number:         SKF-{year}-{seq}       e.g. SKF-2026-0001
```

Formatting lives entirely in `SequenceService`, so the pattern can change
later without touching any calling code.

## Domain Contract

The SKAFF-ACADEMY frontend already uses the following entity names and status
vocabularies. `User`, `StudentProfile`, `StaffProfile`, `Program`, `Intake`,
`ClassGroup`, `Enrollment`, `Application`, and `ApplicationDocument` are now
implemented as Prisma models (`prisma/schema.prisma`); the rest are not
modeled yet. Future modules **must** use these exact names/values to stay
aligned with the frontend — do not invent conflicting terminology.

`ApplicationHistoryEntry` and `SequenceCounter` are backend-only
implementation details (audit trail, id generation) with no direct frontend
equivalent, so they aren't part of this contract.

**Entities:** `User`, `StudentProfile`, `StaffProfile`, `Program`, `Intake`,
`ClassGroup`, `Enrollment`, `Application`, `ApplicationDocument`, `Module`,
`LearningMaterial`, `ClassSession`, `Assignment`, `Submission`,
`AttendanceRecord`, `Result`, `FeeRecord`, `PaymentTransaction`, `Announcement`,
`DocumentRequest`, `Notification`.

**Account families:** only `STUDENT` and `STAFF` (`UserType` enum — teachers
and admins are both `STAFF`; there is deliberately no separate `ADMIN` type;
finer-grained permissions can be layered on later via `@UserTypes(...)`).

**Application statuses** (`ApplicationStatus` Prisma enum — see
[State machine](#state-machine)): `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`,
`MORE_INFORMATION_REQUIRED`, `APPROVED`, `REJECTED`, `ENROLLED`.

**Student statuses** (`src/common/enums/student-status.enum.ts`): `active`,
`pending_payment`, `on_hold`, `suspended`, `completed`, `withdrawn`.

**Class session modes** (`src/common/enums/class-session-mode.enum.ts`):
`physical`, `online`, `offsite`. The platform is physical-campus-first — `online`
and `offsite` are the exception, not the default.

## Current Implementation Status

Implemented (Backend Phase 2 — intakes, admissions, and enrollment
conversion, on top of Phase 1's programs/auth foundation):

- NestJS project structure, strict TypeScript, ESLint + Prettier
- Environment configuration with startup validation (`JWT_SECRET`/`JWT_EXPIRES_IN`)
- Prisma wired to PostgreSQL: `User`, `StudentProfile`, `StaffProfile`, `Program`, `Intake`,
  `ClassGroup`, `Enrollment`, `Application`, `ApplicationDocument`, `ApplicationHistoryEntry`,
  `SequenceCounter`
- Idempotent seed script: 8 official programs, dev accounts, and 7 demo applications
  covering every `ApplicationStatus`
- Global `/api/v1` prefix
- `GET /api/v1/health`
- **Programs API** — `GET /api/v1/programs`, `GET /api/v1/programs/:slug` (public, ordered, 404-safe)
- **Authentication** — `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, JWT bearer tokens, Argon2 password hashing
- **Authorization foundation** — `@UserTypes(...)` + `UserTypesGuard` for STUDENT/STAFF-restricted routes
- **Intakes API** — public "current eligible intake" lookup, STAFF admin CRUD + open/close actions
- **Applications API** — public applicant self-service (create/update/submit/status/resubmit/documents),
  interim `verificationEmail` applicant verification, server-generated references
- **Admin Admissions API** — queue with search/filters/pagination/status counts, full detail,
  review actions (under-review/request-information/approve/reject/internal-notes)
- **Enrollment conversion** — transactional `APPROVED → ENROLLED`, creates/resolves
  `User` + `StudentProfile` + `Enrollment`, server-generated student numbers,
  duplicate-conversion and mismatched-class-group protection
- **Central state-transition policy** — every status change is validated centrally,
  never duplicated per call site
- Global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform)
- Global exception filter with a consistent error envelope
- CORS restricted to `FRONTEND_URL` (plus localhost in non-production)
- Helmet security headers
- Swagger/OpenAPI at `/api/docs` (non-production only), with bearer-auth support
- Unit tests (health controller, `UserTypesGuard`, state-transition policy, intake eligibility)
  and e2e tests (health, programs, auth, intakes, public applications, admin applications +
  enrollment) — 71 tests total

**Not implemented** (by design — future phases): academic delivery (modules,
schedule/sessions, materials, assignments, submissions, attendance, formal
results), fees/payments, student document requests, announcements,
notifications, email/SMS, cloud file storage (document metadata only —
no real upload yet), real admission-letter PDFs, refresh-token rotation.

## Planned Backend Modules

Suggested order for subsequent phases:

1. **Academic delivery** — `Module`, `ClassSession` (schedule), `LearningMaterial`,
   `Assignment`, `Submission`
2. **Attendance & results** — `AttendanceRecord`, `Result`
3. **Staff & student management** — richer `StaffProfile`/`StudentProfile`
   editing, staff permission granularity beyond STUDENT/STAFF, the
   account-activation flow enrollment conversion currently defers
   (email verification + real password set for newly created student accounts)
4. **Fees & payments** — `FeeRecord`, `PaymentTransaction`
5. **Documents & communication** — `DocumentRequest`, `Announcement`,
   `Notification`

Each phase should add the corresponding Prisma models/migrations, a feature
module under `src/`, DTOs validated via `class-validator`, and Swagger
annotations — following the conventions established so far.
