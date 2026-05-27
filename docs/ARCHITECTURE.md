# VNV ValuPro — backend architecturee authoritative**.
## Platform note

The public artifact examples use Express-style `NestFactory.create`. **This project uses Fastify** (`@nestjs/platform-fastify`). Apply the same behaviors (global prefix, validation, CORS, Swagger, uniform errors/responses) using Nest + Fastify-compatible setup.

## RBAC — four roles, no super-admin

There is **no `SUPER_ADMIN`**. Roles are:

| Role | Typical client | Summary |
|------|----------------|---------|
| `ADMIN` | Web | Users, banks (create/update), case assignment, fees oversight, exports, analytics |
| `CHECKER` | Web | Checker queue, valuation review, queries |
| `BANK_MANAGER` | Mobile | Create cases, upload docs, own bank cases |
| `SITE_ENGINEER` | Mobile | Assigned cases, valuation form, fee collection, engineer locations |

Replace any artifact route that says `SUPER_ADMIN` with **`ADMIN`** (e.g. bank CRUD).

Guards: JWT authentication plus a roles guard; enforce `isApproved` and `isActive` for protected routes unless explicitly public.

## Modules (nine)

1. **auth** — OTP send/verify, access + refresh JWT, logout  
2. **users** — Create users, RBAC fields, approve/deactivate, engineer locations  
3. **banks** — Bank master data, managers per bank, seed data  
4. **cases** — Create, assign, status transitions, audit log  
5. **documents** — R2 presigned upload, register metadata, list, delete  
6. **valuation** — Engineer visit/submit, checker review, PDF report  
7. **fees** — Rate card, collection, customer OTP confirmation, discrepancy flags  
8. **queries** — Checker raises queries; thread responses; resolve  
9. **notifications** — FCM push + SMS (case assigned, approved, queries, fee SMS, etc.)

## Recommended build order

Foundation (config, throttling, Prisma client, shared guards/decorators/filters/interceptors, `main.ts` with `/api/v1`) → **banks** (so `bankId` exists) → **auth** → **users** → **cases** + **documents** → **valuation** → **fees** → **queries** → **notifications** + PDF on approval.

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
- MSG91: auth key, template IDs, sender where applicable  
- Firebase / FCM: project id, client email, private key (if using push)

## Schema and product notes

- Prisma **Role** enum should match the four roles above.  
- Case status transitions and audit logging should be enforced in the **cases** service (centralized, not left to callers).  
- Align **valuation** DTO fields with the real report template before freezing `SubmitValuationDto`.

## Further reading

- [NestJS documentation](https://docs.nestjs.com/)  
- [Prisma documentation](https://www.prisma.io/docs)  
- Source artifact (same as top link): [VNV ValuPro Backend Structure — NestJS Architecture Guide](https://claude.ai/public/artifacts/83d2e408-6af8-4890-94fb-c7e3a2fa1256)
