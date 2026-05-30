# VNV ValuPro — backend architecture

This document describes how the ValuPro NestJS backend is intended to be structured. The primary reference is the [ValuPro backend structure artifact](https://claude.ai/public/artifacts/83d2e408-6af8-4890-94fb-c7e3a2fa1256) (user-generated). When that artifact disagrees with this repository, **this file plus committed code are authoritative**.

## Platform note

The public artifact examples use Express-style `NestFactory.create`. **This project uses Fastify** (`@nestjs/platform-fastify`). Apply the same behaviors (global prefix, validation, CORS, Swagger, uniform errors/responses) using Nest + Fastify-compatible setup.

## Clients — three frontends, one API

| Client | Users | Login | Allowed roles (from `Role` table) |
|--------|--------|--------|-----------------------------------|
| **Web portal** | Bootstrap admin + staff | Email + password | Any role **except** mobile-only system roles |
| **Bank manager mobile app** | Bank managers | Email OTP + Google Sign-In | `BANK_MANAGER` only |
| **Site engineer mobile app** | Site engineers | Email OTP + Google Sign-In | `SITE_ENGINEER` only |

All clients call the same backend (`/api/v1`). Client separation is enforced on the server at **login** and on **every protected route** — do not rely on the app store split alone.

Optional login body hint: `client: 'web' | 'bank_manager_app' | 'site_engineer_app'` so auth can validate the expected role; always re-check `role.name` from the database.

There is **no `SUPER_ADMIN`**. Replace any artifact route that says `SUPER_ADMIN` with bootstrap **`ADMIN`** or permission checks (e.g. `users:create`, `banks:write`).

---

## RBAC — roles and permissions in the database

Roles are **not** a Prisma enum. They live in tables:

- **`Role`** — name, description, `isSystem` (seed/system roles vs admin-created)
- **`Permission`** — `resource` + `action` (e.g. `valuation:review`, `users:create`)
- **`RolePermission`** — many-to-many link

### System roles (seed, `isSystem: true`)

| `Role.name` | Client | Login channel |
|-------------|--------|---------------|
| `ADMIN` | Web portal | Email + password (bootstrap credential) |
| `BANK_MANAGER` | Bank manager app | Email OTP + Google |
| `SITE_ENGINEER` | Site engineer app | Email OTP + Google |

### Custom web roles (admin-created, `isSystem: false`)

Examples: `Checker`, `Operations`, `Finance` — created in the web RBAC UI with permissions assigned via `RolePermission`.

**“Checker” is a role row**, not a hardcoded enum. Staff with the Checker role sign in on the **web portal** with email + password like any other web role.

### Authorization

- **Web portal:** permission-based guards (e.g. `@RequirePermission('valuation:review')`), not fixed role name checks where possible.
- **Mobile apps:** role name + permissions on domain endpoints (bank manager vs engineer feature sets).
- Enforce `isApproved` and `isActive` on all protected routes unless explicitly public.

Long-term: add `loginChannel` (or similar) on `Role` (`WEB` | `MOBILE`) instead of hardcoding role names in auth — for v1, mobile-only roles are `BANK_MANAGER` and `SITE_ENGINEER`.

---

## Authentication

### Web portal — email + password

**Bootstrap admin:** one credential you set at deploy (seed from env: `ADMIN_EMAIL`, `ADMIN_PASSWORD`) → single `User` with `roleId` → `ADMIN`, `isApproved: true`, `isActive: true`. No public “register admin” endpoint.

**Other web staff:** created by admin in the web portal with `email`, `password` (stored as bcrypt `passwordHash`), `name`, and `roleId` (any non-mobile role).

**Flow:** `POST /auth/login` with `{ email, password }` → verify hash → JWT pair.

**Rules:**

- Reject if user’s role is mobile-only (`BANK_MANAGER`, `SITE_ENGINEER`).
- Reject if `!isActive` or `!isApproved`.
- Rate-limit failed password attempts per email (Redis).

### Mobile apps — email OTP + Google (no SMS)

SMS OTP is **not** used for login (paid). Mobile users authenticate with **email**.

**Email OTP**

1. `POST /auth/email/send-otp` — body includes `email` and optional `client` hint.
2. Generate 6-digit OTP → Redis (`otp:email:{email}`, TTL ~5 min) → send via email provider (Resend/Brevo/etc.; dev: log to console).
3. `POST /auth/email/verify-otp` — verify OTP → issue JWT.

**Google Sign-In**

1. App obtains Google ID token.
2. `POST /auth/google` with `{ idToken, client }`.
3. Verify token (`aud` matches app-specific client ID) → match user by email → issue JWT.
4. Optionally persist `googleId` on first successful login.

**Rules (both mobile flows):**

- User must already exist (admin-created); no self-registration.
- `role.name` must match the calling app (`BANK_MANAGER` vs `SITE_ENGINEER`).
- Reject web-only roles and password-only accounts.
- Reject if `!isActive` or `!isApproved`.
- Rate-limit OTP sends per email.

**Google OAuth:** separate client IDs per mobile app (`GOOGLE_CLIENT_ID_BANK_MANAGER`, `GOOGLE_CLIENT_ID_SITE_ENGINEER`).

### Shared auth behavior

- Access JWT (~15m) and refresh JWT (~7d).
- JWT payload: `sub`, `email`, `roleId`, `roleName`, `isApproved`, `isActive`, optional `bankId`, optional `permissions[]` (web).
- Logout invalidates refresh token (Redis denylist).
- Never return OTP in API responses; dev-only console logging is fine.

### Auth module routes (target)

| Route | Client | Purpose |
|-------|--------|---------|
| `POST /auth/login` | Web portal | Email + password (non-mobile roles) |
| `POST /auth/email/send-otp` | Mobile apps | Send OTP to email |
| `POST /auth/email/verify-otp` | Mobile apps | Verify OTP → JWT |
| `POST /auth/google` | Mobile apps | Google ID token → JWT |
| `POST /auth/refresh` | All | New access token |
| `POST /auth/logout` | All | Invalidate refresh |

Removed: `POST /auth/mobile/send-otp`, SMS/MSG91 for auth.

---

## Users module & web-portal provisioning

All users are created from the **web portal** (bootstrap admin or staff with `users:create` permission):

| User type | Created by | Fields | Login |
|-----------|------------|--------|--------|
| Bootstrap admin | Seed / env | email, password, `roleId` → ADMIN | Web password |
| Web staff (e.g. Checker) | Admin UI | email, password, name, `roleId` | Web password |
| Bank manager | Admin UI | email, name, `roleId` → BANK_MANAGER, `bankId` | Mobile OTP / Google (no password) |
| Site engineer | Admin UI | email, name, `roleId` → SITE_ENGINEER; optional `mobile` | Mobile OTP / Google (no password) |

| Action | Endpoint (target) |
|--------|-------------------|
| Create user | `POST /users` |
| List / filter users | `GET /users` |
| Approve user | `PATCH /users/:id/approve` |
| Deactivate user | `PATCH /users/:id/deactivate` |
| Manage roles & permissions | Roles/permissions CRUD on web portal |

Engineer locations (site engineers): existing artifact routes under `/engineers/*`.

---

## Modules (nine)

1. **auth** — Web password login; mobile email OTP + Google; JWT, refresh, logout
2. **users** — User CRUD, approve/deactivate; roles & permissions management
3. **banks** — Bank master data, seed data
4. **cases** — Create, assign, status transitions, audit log
5. **documents** — R2 presigned upload, register metadata, list, delete
6. **valuation** — Engineer visit/submit, staff review, PDF report
7. **fees** — Rate card, collection, customer OTP confirmation, discrepancy flags
8. **queries** — Staff raises queries; thread responses; resolve
9. **notifications** — FCM push; transactional SMS/email where needed (not auth OTP via SMS)

## Recommended build order

Foundation (config, throttling, Prisma, common guards/decorators/filters, `main.ts` `/api/v1`) → **seed** permissions, system roles, bootstrap admin → **banks** → **users** (RBAC + provisioning) → **auth** (web login + mobile OTP/Google) → **cases** + **documents** → **valuation** → **fees** → **queries** → **notifications** + PDF.

Dependency sketch: Auth depends on Users/Roles; Cases on Banks + Users; Valuation on Cases; Fees on Valuation; Queries on Cases + Users; Notifications from domain services.

## HTTP API

- Global prefix: **`/api/v1`**
- Swagger: **`/api/docs`**
- Success: `{ success, data, timestamp }`; errors: `{ success: false, error, statusCode }`

## Environment variables

Maintain **`.env.example`** with at least:

- `PORT`, `NODE_ENV`, `FRONTEND_URL`
- `DATABASE_URL`, `DIRECT_URL`
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`
- `REDIS_URL` (email OTP, rate limits, refresh denylist)
- Bootstrap (seed only): `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Email OTP: `RESEND_API_KEY` (or Brevo/SendGrid), `EMAIL_FROM`
- Google: `GOOGLE_CLIENT_ID_BANK_MANAGER`, `GOOGLE_CLIENT_ID_SITE_ENGINEER`
- R2, FCM, MSG91 (transactional notifications only — not auth login SMS)

## Schema notes

- **`Role`**, **`Permission`**, **`RolePermission`** — dynamic RBAC; no `Role` enum on `User`.
- **`User`:** `roleId` → `Role`; `email` required and unique for all users; `passwordHash` required for web users, null for mobile-only users; optional `googleId`, optional `mobile` (contact).
- **`AUTH_METHOD`:** prefer `PASSWORD` | `EMAIL_OTP` | `GOOGLE` (drop SMS/mobile-as-login).
- Case status transitions and audit logging enforced in **cases** service.
- Align valuation DTO fields with the real report template before freezing `SubmitValuationDto`.

## Further reading

- [NestJS documentation](https://docs.nestjs.com/)
- [Prisma documentation](https://www.prisma.io/docs)
- [ValuPro backend structure artifact](https://claude.ai/public/artifacts/83d2e408-6af8-4890-94fb-c7e3a2fa1256)
