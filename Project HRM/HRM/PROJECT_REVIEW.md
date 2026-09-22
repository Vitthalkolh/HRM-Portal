# HRM Project Review

Review date: 2026-09-22
Reviewed commit state: working tree at `Project HRM/HRM` (untracked; the git repository root is `Vitthal/` and still tracks the legacy `HRM/` + `hrm-web/` tree).
Reviewer role: senior full-stack engineer / architect / code reviewer / QA / security reviewer.

---

## 1. Project Overview

The repository is meant to contain a single HRM product:

- `HRM.Server` — ASP.NET Core 10 Web API (C#), EF Core, SQL Server, JWT auth.
- `HRM.Client` — React 18 + TypeScript + Vite + MUI SPA.
- `HRM.sln` — solution tying both together.

The functional source of truth is the requirements set supplied by the user (single login portal, Admin + Employee roles, fixed leave quotas EL/SL/CL/FL/WFH, common calendar, company planning calendar with NTNS/Dry-Run/SNU rules, salary slips, reimbursements, referrals, notifications, emails, trending popup, working-days calculation).

**Headline finding:** what Codex produced is an *architectural skeleton*, not a working HRM application. The entire solution is ~50 KB of source across 24 files, with the whole frontend contained in a single 6 KB `main.tsx` whose non-dashboard routes render the literal text "This module is ready for its API data." Roughly 25 % of the required functionality exists in any form. The existing README is, to its credit, honest about several of these gaps.

Because of this, the work below is **not** a rewrite of working code — most of it is first implementation of functionality that was never written. Everything that did exist and was correct (the entity model, `AuthService`, the leave validation core, the transaction scaffolding, the theme direction) has been preserved and extended rather than replaced.

### Inventory of what actually existed

| Area | Files | State |
| --- | --- | --- |
| Entities | `Entities/Domain.cs` | Present and largely sound (16 entities) |
| DbContext | `Data/HrmDbContext.cs` | Present, thin (indexes only, no relationship config) |
| Seeding | `Data/DatabaseInitializer.cs` | Leave types + admin only; **no leave balances** |
| Auth | `Services/AuthService.cs`, `Controllers/AuthController.cs` | Present and mostly correct |
| File storage | `Services/FileStorage.cs` | Present, weak validation |
| Leave | `Controllers/LeavesController.cs` | Present, several defects |
| Calendar / Planning / Notifications / Profile | 4 thin controllers | Partial |
| Employees (admin), Holidays, Management leave, Dashboard, Salary, Reimbursement, Referral, Audit, Files | — | **Absent** |
| Email service | — | **Absent** (only an unused `SmtpOptions` class) |
| Birthday job | — | **Absent** |
| Migrations | — | **Absent** |
| Frontend | `src/main.tsx` (single file) | Login + shell + placeholders only |
| Tests | — | **Absent** |

---

## 2. Current Architecture

**Backend (as found):** controller-per-area with EF Core queried *directly from controllers*. No service layer beyond `IAuthService`/`IFileStorage`, no repository layer, no validation layer, no centralized error handling beyond a bare `UseExceptionHandler` lambda, no audit writer, no email sender, no background services. Responses are wrapped in `ApiResponse<T>` inconsistently — some endpoints return raw entities (`GET /api/leaves/types` returns `List<LeaveType>`, `GET /api/leaves/history` returns whole `LeaveRequest` graphs including `Employee.User.PasswordHash`).

**Frontend (as found):** one file. Context-based auth state in `localStorage`, `fetch` calls inline, no API layer, no refresh handling, no typed contracts, no pages.

**Database:** code-first, but bootstrapped through `EnsureCreatedAsync()` because no migration exists.

**Assessment:** the direction is fine for an application of this size (EF Core + controllers + a thin service layer; no need for CQRS/microservices/Redis per the "do not overengineer" constraint). What was missing is the layer that holds business rules — leave arithmetic, planning generation, notification fan-out — which had leaked into controllers or did not exist.

---

## 3. Already Correct

Preserved as-is or with only additive change:

1. **Entity model** (`Entities/Domain.cs`) — sensible, covers all required domains including expense claims, referrals, salary slips, audit logs, stored files.
2. **Leave type set** — seed already contains exactly EL 15 / SL 6 / CL 6 / FL 3 / WFH 40. Correct per requirement.
3. **Optional Holiday is genuinely absent** from the new solution (verified by exhaustive search — see §5 of this document and the search evidence below). Floater Leave is present as the replacement mechanism.
4. **Management Leave and National Holiday are modelled as separate entities**, not as `LeaveType` rows. Architecturally correct.
5. **JWT + rotating refresh tokens** — `AuthService` hashes refresh tokens with SHA-256 before storage, rotates on refresh, revokes on logout, revokes all sessions on password change/reset. This is good work and was kept.
6. **Password hashing** — ASP.NET Core `PasswordHasher<User>` (PBKDF2). Correct.
7. **Password reset tokens** — hashed at rest, 1-hour expiry, single-use via `UsedAtUtc`. Correct.
8. **Forgot-password response is non-enumerating** ("If an account exists…"). Correct.
9. **`Authorize` by default on controllers + an `Admin` policy.** Correct pattern.
10. **Transaction scaffolding** on leave approval/cancel existed (`BeginTransactionAsync`).
11. **Pending leave counted in availability** on apply. Correct per requirement §23.
12. **Weekend + national-holiday exclusion** in the day count.
13. **Single `/login` route**, role-based redirect after auth. Correct per requirement §7.
14. **Path-traversal guard** in `LocalFileStorage.OpenReadAsync`/`Delete`.
15. **CORS is configuration-driven**, defaulting to the Vite origin.
16. **`.env.example` / `appsettings.example.json` contain placeholders only** — no secrets committed.
17. **Theme direction** (dark navy `#0c1128` sidebar, `#6655e8` purple accent, `#f6f7fb` background, 12 px radius) matches the requested visual style and became the basis of the full design system.

---

## 4. Incorrect / Conflicting Requirements

| # | Finding | Severity |
| --- | --- | --- |
| 4.1 | `GET /api/leaves/types` returned the raw `LeaveType` entity list, not a DTO — leaking `CreatedAtUtc`/`IsActive` and coupling the client to the entity. | Medium |
| 4.2 | `GET /api/leaves/history` returned full `LeaveRequest` object graphs with `Include(Employee)`; serialization reached `Employee.User` in review paths — **exposing `PasswordHash`** to any authenticated caller. | **Critical** |
| 4.3 | Requirement §19 forbids fabricated dashboard data. The employee/admin dashboards rendered only a greeting; there was no dashboard endpoint at all, so the requirement was neither met nor violated — it was simply missing. | High |
| 4.4 | Requirement §12: "do not force redirect to change password". Not violated (no such redirect existed), but there was also no Change Password screen to satisfy the positive half of the requirement. | High |
| 4.5 | Requirement §26 (one common calendar): backend `GET /api/calendar` returned only holidays/management/leaves — no birthdays, anniversaries, or resignation/notice events, which the requirement explicitly lists. | High |
| 4.6 | Requirement §33 (working days): no implementation anywhere. | High |
| 4.7 | Requirement §20 (leave-type card page): no page existed. | High |
| 4.8 | Requirement §22 (single/multiple day toggle): no leave form existed. | High |

---

## 5. Missing Functionality

This is the dominant category. Verified absent:

**Backend**
- Admin employee management (list/create/update/deactivate/reset password) — no controller.
- National Holiday CRUD — no controller (`HolidayRequest` DTO existed, unused).
- Management Leave CRUD — no controller (`ManagementLeaveRequest` DTO existed, unused).
- Dashboard aggregation endpoints (admin + employee) — none.
- Salary slip upload/list/download — none. `SalarySlip` entity was orphaned.
- Reimbursement / expense claim endpoints — none. `ExpenseClaim` entity and `ExpenseClaimRequest` DTO orphaned.
- Referral endpoints — none. `ReferralApplication` entity and `ReferralRequest` DTO orphaned.
- Audit log write path and read endpoint — none. `AuditLog` entity orphaned; **no operation was ever audited**.
- Email: no `IEmailService`, no SMTP implementation, no templates. `SmtpOptions` existed but was never bound to DI or used. The approval email and birthday email (both hard requirements) did not exist.
- Birthday background job — none.
- Trending / monthly highlights endpoint — none.
- Leave-balance allocation on employee creation — none (see §6.1, this made leave application impossible).
- Profile *edit* (`PUT /api/employees/me`) — only `GET` and image upload existed.
- Company planning **generation rules** (NTNS ×4/yr on Sundays, Dry Run 1 week prior, SNU every 15 days on Wednesday with NTNS-proximity cancellation) — nothing; only manual CRUD.
- Pagination/filtering on any list endpoint.
- `StoredFile` metadata was never written despite the entity existing.
- `appsettings.json`, `Properties/launchSettings.json` — absent.
- EF Core migrations — absent.

**Frontend**
- Everything except the login page and the shell. Specifically: dashboards, leave apply, leave history, leave types, admin approvals, employees, holidays, management leave, calendar, planning, profile, profile image, change password, forgot/reset password, salary slips, reimbursements, referrals, notifications bell, trending popup, settings, audit logs.
- Password show/hide (requirement §11) — absent.
- Top-right profile menu with My Profile / Change Password / Settings / Logout (§17) — only a name and a logout button.
- Token refresh on 401 — absent; sessions would hard-fail after 30 minutes.
- Loading / empty / error states (§51) — absent.
- Button busy-state protection (§52) — absent.

---

## 6. Broken Functionality

| # | Finding | Severity |
| --- | --- | --- |
| 6.1 | **No leave balances are ever created.** `DatabaseInitializer` seeds `LeaveTypes` but never `LeaveBalances`, and there was no employee-creation path to allocate them. `POST /api/leaves` reads `balance is null` → returns "Insufficient available balance". **Leave application was 100 % non-functional.** | **Critical** |
| 6.2 | **`ProfileController` and `NotificationsController` read `User.FindFirstValue("sub")`.** JwtBearer's default inbound claim mapping rewrites `sub` → `ClaimTypes.NameIdentifier`, so `"sub"` resolves to `null` and `int.Parse(null!)` throws `ArgumentNullException` → 500. **Every profile and notification request failed.** | **Critical** |
| 6.3 | `LeavesController.Cancel` calls `db.LeaveBalances.SingleAsync(...)` inside a transaction with no null tolerance; if the balance row is missing it throws inside the transaction and surfaces as a 500. Same in `Review`. | High |
| 6.4 | `Cancel` and `Review` open a transaction, then `return BadRequest(...)` on validation failure **without rolling back** — the transaction is disposed by `await using`, which rolls back, but the pattern is fragile and the validation should precede the transaction. | Medium |
| 6.5 | **Double-approve race:** `Review` re-reads the request inside the transaction but uses the default `READ COMMITTED` isolation with no row lock and no concurrency token. Two concurrent approvals can both observe `Status == Pending` and both apply `b.Taken += x.Days`, double-deducting. Requirement §25 explicitly calls this out. | High |
| 6.6 | `Program.cs` registers `.AddJsonFile("appsettings.example.json", optional: false)` as the **primary** configuration file. The example file ships the literal placeholder secret, so a developer who sets real values in `appsettings.json` still gets the example loaded first; worse, deleting the example file makes the app refuse to boot. | High |
| 6.7 | The half-day rule computes `days = 0.5` but does **not** verify the single date is a working day; a half-day on a Sunday was accepted and deducted. | Medium |
| 6.8 | `WorkingDays` does `holidays.Contains(d)` against a `List<DateOnly>` loaded in full on every request — O(n·m) and an unnecessary full-table read. | Low |
| 6.9 | `HRM.Client/index.html` has no `<html>`, `<head>`, `<title>`, or charset — just two tags. Vite tolerates it; the result is an untitled, unstyled document shell. | Medium |
| 6.10 | `Login.tsx` used raw `<input>` elements inside an MUI card — unstyled, inconsistent with the design language, no labels. | Medium |
| 6.11 | The "Forgot password?" button had **no handler** — a dead control. | Medium |
| 6.12 | `Guard` redirects an Admin away from *every* non-admin route (`if(!admin && role==='Admin') → /admin/dashboard`), so an admin could never open a shared page such as the calendar. | Medium |
| 6.13 | Login stored the session then called `window.location.assign(...)`, forcing a **full page reload** on every sign-in. | Low |
| 6.14 | `Layout` calls `session!.user.role` unguarded; rendering the layout without a session throws. The route table nests guards *inside* `<Layout>`, so the layout evaluates first. | Medium |
| 6.15 | Calendar leave events were exposed to **all** authenticated users including full employee names for every approved leave, with no visibility rule. | Medium |

---

## 7. Security Issues

| # | Finding | Severity |
| --- | --- | --- |
| 7.1 | **Password hash disclosure** via `GET /api/leaves/history` returning `LeaveRequest → Employee → User` graphs (see 4.2). | **Critical** |
| 7.2 | **No authorization on the reviewed-entity read path** — an employee calling `/api/leaves/history` got their own rows (correct), but the admin branch returned every employee's full record including nested user data. | High |
| 7.3 | **IDOR surface, unbuilt but imminent:** requirement §54 lists `/api/salary-slips/{id}`, `/api/reimbursements/{id}`, `/api/referrals/{id}`, `/api/employees/{id}`. None existed, so none enforced ownership. Any implementation had to be ownership-checked from the start. | High |
| 7.4 | **File-upload validation trusts the declared content type and extension only** — `file.ContentType.StartsWith("image/")` in `ProfileController` and an extension allow-list in `LocalFileStorage`. No magic-byte sniffing, no dimension check (requirement §32 demands ≥ 300×300), and the extension check is skipped entirely for any category other than `"profile"`. A `.exe` renamed to `.pdf` uploaded to a non-profile category would have been stored verbatim. | High |
| 7.5 | **`StartsWith(_root)` path check is prefix-based**, so `/storage-evil` passes the guard for root `/storage`. Needs a directory separator anchor. | Medium |
| 7.6 | **No rate limiting** on `/api/auth/login` or `/api/auth/forgot-password` — unrestricted credential stuffing and reset-mail flooding. | Medium |
| 7.7 | **Refresh-token reuse is not detected.** `RefreshAsync` revokes the old token and records `ReplacedByTokenHash`, but presenting an already-revoked token simply fails instead of revoking the whole chain — a stolen token stays usable until the legitimate user rotates. | Medium |
| 7.8 | **Reset token returned in the HTTP response** when `ASPNETCORE_ENVIRONMENT=Development`, read via `Environment.GetEnvironmentVariable` rather than `IHostEnvironment`. Acceptable for local dev but must be impossible to reach otherwise; the env-var read bypasses the host's environment resolution. | Medium |
| 7.9 | **No account lockout** after repeated failed logins. | Medium |
| 7.10 | **Access tokens and refresh tokens stored in `localStorage`** — XSS-readable. Mitigated but not eliminated; documented as an accepted trade-off for this SPA (see §18). | Medium |
| 7.11 | **No security headers** (HSTS, X-Content-Type-Options, X-Frame-Options / CSP). | Medium |
| 7.12 | **No audit trail at all** despite an `AuditLog` entity — requirement §53 lists 12 auditable operations. | High |
| 7.13 | **Downloaded files were never served through an authorized endpoint** — `ProfileImagePath` was returned raw to the client with no controller able to serve it, implying either a static-file mount (unauthorized) or a broken image. | High |
| 7.14 | **SQL injection: none found.** All data access is EF Core LINQ; there is no raw SQL, no string-concatenated query, no `FromSqlRaw`. Verified by search. | — (pass) |
| 7.15 | JWT config validates issuer, audience, lifetime and signing key with 30 s clock skew — correct. Secret strength is enforced at boot (≥ 32 chars, placeholder rejected) — good. | — (pass) |

---

## 8. Database Issues

| # | Finding |
| --- | --- |
| 8.1 | **No migrations.** Startup used `EnsureCreatedAsync()`, which creates the schema but can never evolve it — the first entity change requires dropping the database. Requirement §44 asks for a migration-based strategy. |
| 8.2 | **No relationship configuration.** Only `User ↔ Employee` was mapped explicitly. `LeaveRequest → Employee/LeaveType`, `LeaveBalance → Employee/LeaveType`, `Notification → User`, `AuditLog → User`, `SalarySlip/ExpenseClaim/Referral → Employee` relied on convention, producing default **cascade delete** everywhere — deleting an employee would silently destroy their leave history. |
| 8.3 | **Missing indexes** on every foreign key used for filtering: `LeaveRequest.EmployeeId`, `(EmployeeId, Status)`, date ranges, `Notification.(UserId, IsRead)`, `ExpenseClaim.EmployeeId`, `Referral.EmployeeId`, `AuditLog.(UserId, CreatedAtUtc)`, `RefreshToken.TokenHash`, `PasswordResetToken.TokenHash`. The token-hash lookups in particular run on **every authenticated refresh** and were unindexed table scans. |
| 8.4 | **No `LeaveBalance` seeding** for employees (see 6.1). |
| 8.5 | **No string length constraints** — every `string` maps to `nvarchar(max)`, including `User.Email`, which is then given a **unique index**; SQL Server cannot index `nvarchar(max)` and this would have failed at `EnsureCreated` time on a real SQL Server. |
| 8.6 | `ManagementLeave.Date` and `CompanyPlanningEvent` dates unindexed despite being the primary calendar query filters. |
| 8.7 | No `RowVersion`/concurrency token on `LeaveBalance` or `LeaveRequest`, enabling the double-approve race (6.5). |
| 8.8 | No entity for birthday-email idempotency (requirement §40). |
| 8.9 | `Employee` has no resignation/notice-period fields although requirement §26 requires them on the common calendar. |
| 8.10 | `NationalHoliday.Date` carries a **unique** index — two holidays cannot share a date, which is a real scenario (e.g. regional overlap). Questionable but retained for now as it prevents duplicates; noted as a deliberate decision. |
| 8.11 | No historical Optional Holiday data exists in this database (it is a fresh schema), so nothing needed preservation. The legacy `Project HRM Old` tree retains its own Optional Holiday tables untouched. |

---

## 9. Backend/API Issues

| # | Finding |
| --- | --- |
| 9.1 | Entities returned directly instead of DTOs (4.1, 4.2). |
| 9.2 | Inconsistent envelope — `Types()` returns a bare list, everything else returns `ApiResponse<T>`. |
| 9.3 | `UseExceptionHandler` returns a flat 500 for *everything*, including validation and not-found conditions; no `ProblemDetails`, no correlation id, no logging. |
| 9.4 | No `ILogger` usage anywhere in the codebase. |
| 9.5 | Duplicated `Id()`/`Employee()` claim-reading helpers copy-pasted across four controllers, two of which use the wrong claim key (6.2). |
| 9.6 | No model-level validation wiring — DTOs carry `[Required]`/`[Range]` attributes, but `ApiBehaviorOptions` was never configured, so validation failures return the default `ProblemDetails` shape while every other error returns `ApiResponse` — the client cannot parse both. |
| 9.7 | No pagination on `/api/leaves/history` (returns every request ever made) or `/api/notifications` (hard-capped at 100 with no paging). Requirement §63. |
| 9.8 | `Types()` returns `Task<List<LeaveType>>` (not `IActionResult`) — inconsistent, and unauthorized responses can't be shaped. |
| 9.9 | No `/api/employees` (admin) despite the client sidebar linking to `/admin/employees`. Every admin nav item except Dashboard led to a placeholder. |
| 9.10 | Swagger is enabled unconditionally, including in Production. |
| 9.11 | No JWT bearer definition in Swagger — the "Authorize" button was absent, making manual API testing impossible. |
| 9.12 | `DatabaseInitializer.SeedAsync` runs `MigrateAsync`/`EnsureCreatedAsync` **on every startup in every environment** with no guard. |
| 9.13 | Health endpoint exists (good) but does not check database connectivity. |

---

## 10. Frontend/UI Issues

| # | Finding |
| --- | --- |
| 10.1 | The entire SPA is one 6 KB file; 10 of 12 routes render the placeholder string "This module is ready for its API data." |
| 10.2 | Raw `<input>` in the login form (6.10); no password visibility toggle (§11). |
| 10.3 | No API client, no interceptor, no token refresh, no 401/403 handling. |
| 10.4 | Sidebar has no icons, no active-route highlight, no collapse behaviour, no section grouping — requirement §16 asks for all four. |
| 10.5 | Top bar shows a name and a logout button; no avatar, no menu, no My Profile link, no notification bell, no trending button (§17, §18). |
| 10.6 | No loading/empty/error states, no snackbars, no confirm dialogs, no busy buttons (§51, §52). |
| 10.7 | No responsive handling — `Drawer variant="permanent"` at a fixed 240 px overlaps content on mobile. |
| 10.8 | `index.html` is malformed (6.9): no `<title>`, no charset, no viewport meta — so the app is **not** mobile-scaled at all. |
| 10.9 | Theme defines only `primary` and `background`; no typography scale, no component overrides, no consistent card/table/button styling — requirement §15 asks for one coherent product feel. |
| 10.10 | `tsconfig.json` has no `noUnusedLocals`/`noUnusedParameters`, no path aliases; no ESLint configuration exists at all despite requirement §46. |
| 10.11 | `package.json` `test` script is `vitest run --passWithNoTests` with zero tests — a green signal that verifies nothing. |
| 10.12 | No `.gitignore` in `HRM.Client` or at the solution level — `node_modules`, `bin`, `obj`, `appsettings.json` were all commit candidates. |

---

## 11. Authentication Issues

| # | Finding |
| --- | --- |
| 11.1 | Wrong claim key used for user id in two controllers (6.2) — **breaks authentication-dependent endpoints entirely**. |
| 11.2 | No refresh flow on the client — the 30-minute access token expiry logs users out mid-session with an unexplained failure. |
| 11.3 | Logout clears `localStorage` but **never calls `POST /api/auth/logout`**, so the refresh token stays valid server-side for up to 14 days (requirement §10 explicitly requires invalidation). |
| 11.4 | No forgot-password or reset-password UI — the flow is unreachable from the product. |
| 11.5 | No change-password UI. |
| 11.6 | `RefreshAsync` calls `IssueAsync` (which saves) then mutates `stored.ReplacedByTokenHash` and saves again — two round-trips, and the window between them is not transactional. |
| 11.7 | `LoginAsync` performs no timing-safe short-circuit: a non-existent user returns without hashing, a real user pays the PBKDF2 cost — a measurable **user-enumeration timing oracle**. |
| 11.8 | No lockout / rate limit (7.6, 7.9). |
| 11.9 | Reset token expiry is 1 hour and single-use — correct. Token is hashed at rest — correct. |

---

## 12. Authorization Issues

| # | Finding |
| --- | --- |
| 12.1 | The `Admin` policy is correctly applied to approve/reject/cancel/planning-write. Good. |
| 12.2 | `/api/leaves/history` admin branch returns all employees' data without DTO shaping (7.1/7.2). |
| 12.3 | `withdraw` correctly checks `x.EmployeeId != e.Id` — good ownership check, and the only one in the codebase. |
| 12.4 | Every endpoint that requirement §54 flags for IDOR testing did not exist yet, so the access matrix in §55 was ~30 % implementable. |
| 12.5 | Frontend `Guard` blocks admins from shared routes (6.12). |
| 12.6 | No endpoint exposes audit logs, so the "Audit Logs: Admin yes / Employee no" row of the matrix was unimplementable. |

---

## 13. Email / Notification Issues

| # | Finding |
| --- | --- |
| 13.1 | **There is no email implementation of any kind.** No `IEmailService`, no SMTP client, no templates, no queue, no logging. `SmtpOptions` is declared and never registered. Requirement §38 names this as "one of the major areas that must actually work". |
| 13.2 | Leave-approval email to all users — **missing**. |
| 13.3 | Birthday email to all users — **missing**, along with the background job (§40) and any idempotency mechanism. |
| 13.4 | Password-reset email — **missing**; `AuthController.Forgot` has a comment saying "Send token via IEmailService in production" and returns the token in the response instead. |
| 13.5 | In-app notifications: a row is written on leave review only. No notification for cancellation, birthday, anniversary, or planning events. No unread-count endpoint. |
| 13.6 | `read-all` uses `ExecuteUpdateAsync` — efficient and correct. |
| 13.7 | Missing SMTP configuration produces no error and no log — the requirement asks for a clear failure signal. |

---

## 14. File Storage Issues

| # | Finding |
| --- | --- |
| 14.1 | Validation trusts extension/declared MIME only; no content sniffing, no dimension check (7.4). |
| 14.2 | The 2 MB cap and the image extension list are applied to *all* categories, but the extension check only fires for `category == "profile"` — so salary slips and resumes had **no type restriction whatsoever**. |
| 14.3 | Prefix-based containment check (7.5). |
| 14.4 | No authorized download endpoint (7.13). |
| 14.5 | `StoredFile` metadata entity never populated — no ownership record, so ownership could not be checked on download even in principle. |
| 14.6 | `Delete` is best-effort and silent; a failed delete leaves an orphan with no log. |
| 14.7 | No per-category size policy (a resume and an avatar share one 2 MB limit; salary slip PDFs may legitimately exceed it). |

---

## 15. Configuration / Deployment Issues

| # | Finding |
| --- | --- |
| 15.1 | `appsettings.example.json` loaded as a **required** primary config source (6.6). |
| 15.2 | No `appsettings.json` / `appsettings.Development.json` / `Properties/launchSettings.json` — `dotnet run` binds to a random port, breaking the documented `VITE_API_TARGET=http://localhost:5000` default. |
| 15.3 | `SmtpOptions` never registered with the options system. |
| 15.4 | No `.gitignore` anywhere in the new tree (10.12). |
| 15.5 | README documents `npm test` as a verification step although no tests exist. |
| 15.6 | README references `../HRM-Portal-main` which does not exist at that path (the legacy tree is at `Project HRM Old/OLD PROJECT/HRM-Portal-main`). |
| 15.7 | No HTTPS redirection, no HSTS. |
| 15.8 | The solution sits **untracked** inside a git repo whose index still holds the entire legacy project as deleted-but-staged. |

---

## 16. Testing Gaps

- **Zero tests exist.** No backend test project, no frontend test file.
- The business rules most in need of tests are exactly the ones with no coverage: working-day counting, leave availability arithmetic (total − taken − pending), balance restore on cancel, and the company-planning date generator (NTNS/Dry-Run/SNU with proximity cancellation).
- No integration test proves the authorization matrix (§55).
- `npm test --passWithNoTests` produces a false-green.

---

## 17. Required Fixes

Ordered by priority. All items below were implemented — see `IMPLEMENTATION_NOTES.md` for the mapping from fix to file.

**P0 — correctness/security blockers**
1. Stop returning entities; introduce DTOs for every response (fixes password-hash disclosure).
2. Fix the `sub` claim reads; centralize claim access in one extension.
3. Allocate `LeaveBalance` rows on employee creation and via a seeding/backfill path, so leave application works.
4. Replace `appsettings.example.json`-as-primary with a proper configuration chain.
5. Add magic-byte + dimension + per-category validation to file storage; anchor the path containment check.
6. Add an authorized download endpoint and populate `StoredFile` metadata; never expose filesystem paths.
7. Add row-level locking / concurrency control to leave approval to defeat the double-approve race.

**P1 — required functionality**
8. Implement `IEmailService` over SMTP with templates, plus the approval and birthday emails and the reset-password email.
9. Implement the birthday background job with a persisted idempotency log.
10. Implement the missing controllers: Employees (admin), National Holidays, Management Leaves, Dashboard, Salary Slips, Reimbursements, Referrals, Audit Logs, Highlights, Files.
11. Implement audit logging on all operations listed in §53.
12. Implement the company-planning generator (NTNS/Dry Run/SNU) as a pure, unit-testable function with admin override.
13. Extend the common calendar with birthdays, anniversaries and notice-period events.
14. Implement working-days calculation (years/months/days + total working days).
15. Build the entire frontend: 20+ pages, API layer with refresh, design system, sidebar, profile menu, notification bell, trending popup, password show/hide, loading/empty/error states, busy buttons.

**P2 — hardening/quality**
16. EF Core migrations replacing `EnsureCreated`; string lengths; indexes; restrict delete behaviour; concurrency tokens.
17. Centralized exception handling with `ProblemDetails`, logging and correlation ids.
18. Rate limiting on auth endpoints; login lockout; refresh-token reuse detection.
19. Security headers; Swagger restricted to development; JWT bearer in Swagger.
20. Pagination on list endpoints.
21. Tests for the business rules named in §16.
22. `.gitignore`, `launchSettings.json`, accurate README, `.env.example`.

---

## 18. Risk Assessment

| Risk | Likelihood | Impact | Mitigation taken |
| --- | --- | --- | --- |
| Scope: the "review and fix" framing understates the work — most of the app does not exist | Certain | High | Stated plainly here and in the final report; implemented the missing functionality rather than reporting it as merely "missing" |
| Regression in the parts that *did* work (auth, leave validation) | Medium | High | `AuthService` logic preserved; leave rules preserved and extended; changes are additive where possible |
| Schema change breaks existing data | Low | Medium | The database is fresh (`EnsureCreated`, no migration, no production instance). Legacy Optional Holiday data lives only in the untouched `Project HRM Old` tree |
| `localStorage` token storage remains XSS-exposed | Medium | High | Documented as an accepted trade-off; refresh tokens are rotated, hashed at rest and revocable; a move to httpOnly cookies is recorded as future work |
| Email cannot be verified without real SMTP credentials | Certain | Medium | Implemented with a file/log-based development sink so the full path is exercisable without credentials; real SMTP marked BLOCKED for local verification |
| Environment lacks the .NET SDK | Was true at review start | High | .NET 10.0.401 SDK installed locally; backend genuinely compiled and run |
| Company-planning rules are ambiguous ("near NTNS" is not numerically defined) | Certain | Low | Implemented as a configurable threshold with a documented default, centralized in one testable function, with full admin override |

---

## 19. Validation Plan

1. **Static:** re-run the Optional Holiday search across the whole tree; confirm zero functional hits.
2. **Backend build:** `dotnet restore` + `dotnet build` on .NET 10; zero errors, zero warnings where practical.
3. **Backend tests:** unit tests for working days, leave availability, balance restore, and planning generation; run `dotnet test`.
4. **Database:** run a real SQL Server 2022 instance in Docker, apply the generated migration, confirm the schema and seed data (5 leave types with the exact quotas, admin user, balances).
5. **Runtime API:** start the API against that database and exercise, with curl: login, refresh, logout, forgot/reset, change password, anonymous access to protected endpoints (expect 401), employee access to admin endpoints (expect 403), leave apply → approve → balance movement → cancel → balance restore, withdraw, double-approve attempt, IDOR attempts on salary/reimbursement/referral/employee by id, file upload validation (wrong type, oversize, undersized dimensions), dashboard, calendar, planning generation, notifications.
6. **Frontend build:** `npm install`, `tsc`, `vite build`, `npm test`; zero TypeScript errors, no `any`/`@ts-ignore` escapes.
7. **Contract check:** compare every client request/response type against the server DTOs.
8. **Docs:** verify every command in the README against what was actually executed.

Results of this plan are recorded in `FINAL_VERIFICATION.md`, with each section marked PASS / FAIL / BLOCKED / NOT APPLICABLE.
