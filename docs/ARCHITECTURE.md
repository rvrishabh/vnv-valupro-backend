# VNV ValuPro — backend architecture

This document describes how the ValuPro NestJS backend is intended to be structured. The primary reference is the [ValuPro backend structure artifact](https://claude.ai/public/artifacts/83d2e408-6af8-4890-94fb-c7e3a2fa1256) (user-generated). When that artifact disagrees with this repository, **this file plus committed code are authoritative**.

## Platform note

The public artifact examples use Express-style `NestFactory.create`. **This project uses Fastify** (`@nestjs/platform-fastify`). Apply the same behaviors (global prefix, validation, CORS, Swagger, uniform errors/responses) using Nest + Fastify-compatible setup.

## Clients — three frontends, one API

| Client | Who gets an account | How account is created | Login |
|--------|---------------------|-------------------------|--------|
| **Web portal** | Bootstrap admin + web staff | Seed (admin) or **admin creates** user | Email + password |
| **Bank manager mobile app** | Bank managers | **Self-register** in app | Email OTP + Google |
| **Site engineer mobile app** | Site engineers | **Self-register** in app | Email OTP + Google |

All clients call the same backend (`/api/v1`). Enforce role and client at **registration**, **login**, and **every protected route**.

`client: 'bank_manager_app' | 'site_engineer_app'` on mobile requests maps server-side to seeded role names `BANK_MANAGER` and `SITE_ENGINEER`. The client must **never** send `roleId` on self-registration.

There is **no `SUPER_ADMIN`**. Replace any artifact route that says `SUPER_ADMIN` with bootstrap **`ADMIN`** or permission checks (e.g. `users:create`, `banks:write`).

---

## RBAC — roles and permissions in the database

Roles are **not** a Prisma enum. They live in tables:

- **`Role`** — `name`, `description`, `loginChannel` (`WEB` | `MOBILE`), `isSystem`
- **`Permission`** — `resource` + `action` (e.g. `valuation:review`, `users:create`)
- **`RolePermission`** — many-to-many link

### System roles (seed, `isSystem: true`)

| `Role.name` | `loginChannel` | Account creation |
|-------------|----------------|------------------|
| `ADMIN` | `WEB` | Seed / env bootstrap only |
| `BANK_MANAGER` | `MOBILE` | **Self-register** via bank manager app |
| `SITE_ENGINEER` | `MOBILE` | **Self-register** via site engineer app |

### Custom web roles (admin-created, `isSystem: false`, `loginChannel: WEB`)

Examples: `Checker`, `Operations`, `Finance` — created in the web RBAC UI with permissions via `RolePermission`. Staff sign in on the **web portal** with email + password.

**“Checker” is a role row**, not a hardcoded enum.

### Authorization

- **Web portal:** permission-based guards (e.g. `@RequirePermission('valuation:review')`).
- **Mobile apps:** role name + permissions on domain endpoints.
- Enforce `isActive` on all protected routes.
- **`isApproved`:** self-registered mobile users typically start as `isApproved: false` until admin approves on the web portal; login may succeed but API access stays limited until approved (product choice — default: block JWT until approved).

---

## Authentication

### Web portal — email + password (admin-created users only)

**Bootstrap admin:** seed from env (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) → one `User` with `roleId` → `ADMIN`, `isApproved: true`, `isActive: true`.

**Web staff:** admin creates users via the **users module** — email, password, name, `roleId` where `Role.loginChannel = WEB`. Admin **never** creates `BANK_MANAGER` or `SITE_ENGINEER` users.

**Flow:** `POST /auth/login` with `{ email, password }` → verify hash → JWT.

**Rules:**

- Reject mobile roles (`BANK_MANAGER`, `SITE_ENGINEER`).
- Reject if `!isActive` or `!isApproved`.
- Rate-limit failed password attempts per email.

### Mobile — self-registration (new users)

Admin does **not** create bank managers or site engineers. They register in the correct mobile app.

**Email OTP registration**

1. `POST /auth/register/email/send-otp` — `{ email, client }` (email must not already exist).
2. OTP → Redis → email provider (dev: console log).
3. `POST /auth/register/email/verify-otp` — `{ email, otp, client, name, bankId?, mobile? }`.
4. Server resolves role: `client` → `Role.name` (`BANK_MANAGER` | `SITE_ENGINEER`) → `roleId`.
5. Create `User`: `email`, `name`, `roleId`, `authMethod: EMAIL_OTP`, `passwordHash: null`, `isApproved: false` (default), `bankId` required when `client = bank_manager_app`.

**Google registration**

1. `POST /auth/register/google` — `{ idToken, client, name, bankId?, mobile? }`.
2. Verify Google token → extract email → reject if email already exists.
3. Same role lookup from `client` → create user with `authMethod: GOOGLE`, store `googleId`.

**Registration rules:**

- Reject duplicate email.
- Reject `client` mismatch (engineer app cannot register as bank manager).
- `bankId` required for `BANK_MANAGER`; optional for `SITE_ENGINEER`.
- Public `GET /banks` for bank picker during bank manager signup.

### Mobile — login (returning users)

**Email OTP:** `POST /auth/email/send-otp` → `POST /auth/email/verify-otp` — user must exist; `user.role.name` must match `client`.

**Google:** `POST /auth/google` — find user by email / `googleId`; role must match `client`.

**Rules:**

- Reject if user does not exist (use register endpoints for new users).
- Reject cross-app login (bank manager account on engineer app → 403).
- Reject if `!isActive` or `!isApproved` (if enforcing approval before JWT).

**Google OAuth:** `GOOGLE_CLIENT_ID_BANK_MANAGER`, `GOOGLE_CLIENT_ID_SITE_ENGINEER`.

### Shared auth behavior

- Access JWT (~15m) and refresh JWT (~7d).
- JWT payload: `sub`, `email`, `roleId`, `roleName`, `isApproved`, `isActive`, optional `bankId`, optional `permissions[]` (web).
- Logout invalidates refresh token (Redis denylist).
- Never return OTP in API responses.

### Auth module routes (target)

| Route | Purpose |
|-------|---------|
| `POST /auth/login` | Web: email + password |
| `POST /auth/register/email/send-otp` | Mobile: start signup |
| `POST /auth/register/email/verify-otp` | Mobile: complete signup → create user |
| `POST /auth/register/google` | Mobile: Google signup → create user |
| `POST /auth/email/send-otp` | Mobile: login OTP |
| `POST /auth/email/verify-otp` | Mobile: verify login → JWT |
| `POST /auth/google` | Mobile: Google login → JWT |
| `POST /auth/refresh` | Refresh access token |
| `POST /auth/logout` | Invalidate refresh |

---

## Users module & admin responsibilities

| User type | Created by | Admin actions |
|-----------|------------|---------------|
| Bootstrap `ADMIN` | Seed / env | — |
| Web staff (Checker, etc.) | Admin UI (users module) | Create, deactivate |
| `BANK_MANAGER` | **Self-register** (mobile) | **Approve**, deactivate, optional `bankId` fix |
| `SITE_ENGINEER` | **Self-register** (mobile) | **Approve**, deactivate |

| Action | Endpoint (target) |
|--------|-------------------|
| Create web user | `POST /users` (WEB roles only; reject mobile `roleId`) |
| List users (incl. pending mobile) | `GET /users` |
| Approve self-registered mobile user | `PATCH /users/:id/approve` |
| Deactivate user | `PATCH /users/:id/deactivate` |
| Roles & permissions CRUD | Web portal RBAC UI |

Engineer locations: `/engineers/*` (after engineer is approved).

---

## Modules (nine)

1. **auth** — Web login; mobile register + login (email OTP, Google); JWT, refresh, logout
2. **users** — Web user CRUD; approve/deactivate mobile signups; roles & permissions
3. **banks** — Master data + public list for bank manager registration
4. **cases** — Create, assign, status transitions, audit log
5. **documents** — R2 presigned upload, register metadata, list, delete
6. **valuation** — Engineer visit/submit, staff review, PDF report
7. **fees** — Rate card, collection, customer OTP confirmation, discrepancy flags
8. **queries** — Staff raises queries; thread responses; resolve
9. **notifications** — FCM push; transactional email/SMS (not auth login SMS)

## Recommended build order

Foundation → seed roles/permissions/bootstrap admin → **banks** (public list for signup) → **auth** (register + login flows) → **users** (web CRUD + approve mobile) → cases → documents → valuation → fees → queries → notifications.

## HTTP API

- Global prefix: **`/api/v1`**
- Swagger: **`/api/docs`**
- Success: `{ success, data, timestamp }`; errors: `{ success: false, error, statusCode }`

## Environment variables

- `PORT`, `NODE_ENV`, `FRONTEND_URL`
- `DATABASE_URL`, `DIRECT_URL`
- JWT secrets, `REDIS_URL`
- Bootstrap: `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Email OTP: `RESEND_API_KEY`, `EMAIL_FROM`
- Google: `GOOGLE_CLIENT_ID_BANK_MANAGER`, `GOOGLE_CLIENT_ID_SITE_ENGINEER`
- R2, FCM

## Schema notes

- **`User.roleId`** → `Role`; mobile self-register sets `roleId` from `client` → `Role.name`.
- Web users: `passwordHash` required; mobile self-register: `passwordHash` null, `authMethod` `EMAIL_OTP` or `GOOGLE`.
- Self-registered mobile users: default `isApproved: false` until admin approves.

## Further reading

- [NestJS documentation](https://docs.nestjs.com/)
- [Prisma documentation](https://www.prisma.io/docs)
- [ValuPro backend structure artifact](https://claude.ai/public/artifacts/83d2e408-6af8-4890-94fb-c7e3a2fa1256)
