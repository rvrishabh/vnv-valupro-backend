# VNV ValuPro — backend architecture

This document describes how the ValuPro NestJS backend is intended to be structured. The primary reference is the [ValuPro backend structure artifact](https://claude.ai/public/artifacts/83d2e408-6af8-4890-94fb-c7e3a2fa1256) (user-generated). When that artifact disagrees with this repository, **this file plus committed code are authoritative**.

## Platform note

The public artifact examples use Express-style `NestFactory.create`. **This project uses Fastify** (`@nestjs/platform-fastify`). Apply the same behaviors (global prefix, validation, CORS, Swagger, uniform errors/responses) using Nest + Fastify-compatible setup.

## RBAC — four roles, no super-admin

There is **no `SUPER_ADMIN`**. Roles are:

| Role            | Typical client     | Login identifier     | Summary                                                                       |
| --------------- | ------------------ | -------------------- | ----------------------------------------------------------------------------- |
| `ADMIN`         | Web (admin portal) | **Email + password** | Users, banks, case assignment, fees oversight, exports, analytics             |
| `CHECKER`       | Web (admin portal) | **Email + password** | Checker queue, valuation review, queries; **provisioned only via admin RBAC** |
| `BANK_MANAGER`  | Mobile             | **Mobile**           | Create cases, upload docs, own bank cases                                     |
| `SITE_ENGINEER` | Mobile             | **Mobile**           | Assigned cases, valuation form, fee collection, engineer locations            |

Replace any artifact route that says `SUPER_ADMIN` with **`ADMIN`** (e.g. bank CRUD).

Guards: JWT authentication plus a roles guard; enforce `isApproved` and `isActive` for protected routes unless explicitly public.

## Authentication — two channels

Login is **not** one-size-fits-all. Mobile roles use OTP; web roles use **email and password**.

### Mobile login (`BANK_MANAGER`, `SITE_ENGINEER`)

- **Identifier:** Indian mobile number (`mobile` on `User`).
- **Flow:** `POST /auth/mobile/send-otp` → SMS (MSG91) → `POST /auth/mobile/verify-otp` → JWT pair.
- **Rules:**
  - User must already exist (created by admin); no self-registration.
  - Role must be `BANK_MANAGER` or `SITE_ENGINEER`; reject if role is web-only.
  - `mobile` is required and unique for these users.

### Email + password login (`ADMIN`, `CHECKER`)

- **Identifier:** email address (`email` on `User`).
- **Credentials:** bcrypt-hashed `passwordHash` on `User` (never store plain text).
- **Flow:** `POST /auth/login` with `{ email, password }` → verify hash → JWT pair.
- **Rules:**
  - `ADMIN` and `CHECKER` sign in on the **admin portal** only (email + password).
  - **`CHECKER` is assigned only through admin-portal RBAC** (users module): an `ADMIN` creates a user with role `CHECKER`, unique **email**, and an initial password (or forced reset on first login).
  - `email` is required and unique for `ADMIN` and `CHECKER`.
  - Mobile OTP endpoints must reject `CHECKER` / `ADMIN` identities.
  - Optional later: `POST /auth/change-password` (authenticated), admin-initiated password reset.

### Shared auth behavior

- Access JWT (~15m) and refresh JWT (~7d); payload includes `sub`, `role`, `isApproved`, `isActive`, and either `mobile` or `email` (not both required in token, but lookup key must match channel).
- Logout invalidates refresh token (Redis denylist).
- Mobile OTP stored in Redis with TTL (e.g. 5 minutes); rate-limit OTP sends per mobile.
- Web login: rate-limit failed password attempts per email (Redis or in-memory).

### Auth module routes (target)

| Route                          | Channel          | Roles allowed                   |
| ------------------------------ | ---------------- | ------------------------------- |
| `POST /auth/mobile/send-otp`   | Mobile OTP       | (lookup) → only mobile roles    |
| `POST /auth/mobile/verify-otp` | Mobile OTP       | `BANK_MANAGER`, `SITE_ENGINEER` |
| `POST /auth/login`             | Email + password | `ADMIN`, `CHECKER`              |
| `POST /auth/refresh`           | Either           | Any active, approved user       |
| `POST /auth/logout`            | Either           | Authenticated                   |

## Users module & admin-portal RBAC

Provisioning is separate from login:

| Action                 | Who                        | How                                                                                   |
| ---------------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| Create `ADMIN`         | Bootstrap / existing admin | Email + name + **password** (hashed); email/password login                            |
| Assign **`CHECKER`**   | **`ADMIN` only** (RBAC UI) | **Email + password required**; role `CHECKER`; no mobile; login via admin portal only |
| Create `BANK_MANAGER`  | `ADMIN`                    | Mobile + `bankId`; mobile login                                                       |
| Create `SITE_ENGINEER` | `ADMIN`                    | Mobile; mobile login                                                                  |
| Approve / deactivate   | `ADMIN`                    | `PATCH /users/:id/approve`, `deactivate`                                              |

**Checker rule:** There is no checker self-service or mobile app login. Every checker is created or role-changed by an admin using **email** as the stable identity.

## Modules (nine)

1. **auth** — Mobile OTP + email/password login, JWT issue, refresh, logout (channel split above)
2. **users** — Create users, RBAC (including checker-by-email), approve/deactivate, engineer locations
3. **banks** — Bank master data, managers per bank, seed data
4. **cases** — Create, assign, status transitions, audit log
5. **documents** — R2 presigned upload, register metadata, list, delete
6. **valuation** — Engineer visit/submit, checker review, PDF report
7. **fees** — Rate card, collection, customer OTP confirmation, discrepancy flags
8. **queries** — Checker raises queries; thread responses; resolve
9. **notifications** — FCM push + SMS (case assigned, approved, queries, fee SMS, etc.)

## Recommended build order

Foundation (config, throttling, Prisma client, shared guards/decorators/filters/interceptors, `main.ts` with `/api/v1`) → **banks** (so `bankId` exists) → **users** (provisioning + RBAC, password on create for web roles) → **auth** (mobile OTP + `POST /auth/login`) → **cases** + **documents** → **valuation** → **fees** → **queries** → **notifications** + PDF on approval.

Dependency sketch: Auth depends on Users; Cases on Banks + Users; Valuation on Cases; Fees on Valuation; Queries on Cases + Users; Notifications invoked from domain services.

## HTTP API

- Global prefix: **`/api/v1`**
- Swagger (when enabled): typically **`/api/docs`**
- Standard success envelope: `{ success, data, timestamp }`; errors: `{ success: false, error, statusCode }`

## Environment variables

Maintain a committed **`.env.example`** (no secrets) with at least:

- `PORT`, `NODE_ENV`, `FRONTEND_URL`
- `DATABASE_URL`, `DIRECT_URL` (Prisma / Neon)
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`
- `REDIS_URL` (OTP, rate limits, refresh denylist as needed)
- R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, optional public URL
- MSG91: auth key, template IDs, sender (mobile OTP only)
- Firebase / FCM: project id, client email, private key (if using push)

## Schema and product notes

- Prisma **Role** enum: `ADMIN`, `CHECKER`, `BANK_MANAGER`, `SITE_ENGINEER` (no `SUPER_ADMIN`).
- **`User` model (planned):** support both identifiers with role-based rules:
  - `email String? @unique` — required for `ADMIN` and `CHECKER`
  - `passwordHash String?` — required for `ADMIN` and `CHECKER` (bcrypt); never expose in API responses
  - `mobile String? @unique` — required for `BANK_MANAGER` and `SITE_ENGINEER`
  - Enforce in application layer: web roles must have email + passwordHash; mobile roles must have mobile; checker created only by admin with email + password.
- Case status transitions and audit logging should be enforced in the **cases** service (centralized, not left to callers).
- Align **valuation** DTO fields with the real report template before freezing `SubmitValuationDto`.

## Further reading

- [NestJS documentation](https://docs.nestjs.com/)
- [Prisma documentation](https://www.prisma.io/docs)
