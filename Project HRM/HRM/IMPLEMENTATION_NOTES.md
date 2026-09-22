# Implementation Notes

What changed relative to the inherited codebase, and why. `PROJECT_REVIEW.md` records what was
found; this document records what was done about it.

## Context

The inherited solution was an architectural skeleton: 24 files, ~50 KB of source, with the entire
frontend in one 6 KB `main.tsx` whose non-dashboard routes rendered the literal string "This
module is ready for its API data." Roughly a quarter of the required functionality existed.

Most of the work below is therefore **first implementation**, not rewriting. What did exist and
was correct was kept and extended.

---

## Kept from the inherited code

- The entity model in `Entities/Domain.cs` — extended, not replaced.
- `AuthService`: JWT issuance, SHA-256-hashed rotating refresh tokens, revoke-all on password
  change. The structure is intact; lockout, reuse detection and the reset email were added.
- The leave validation core: weekend/holiday exclusion, overlap detection, and pending-aware
  availability. Moved into a service and extended.
- The five leave types and their quotas (EL 15 / SL 6 / CL 6 / FL 3 / WFH 40) — already correct.
- Management Leave and National Holiday modelled as separate entities — already correct.
- The theme direction (navy `#0c1128`, purple `#6655e8`, canvas `#f6f7fb`, 12 px radius), which
  became the basis of the full design system.
- The single `/login` route and role-based redirect.

---

## Backend

### Correctness and security fixes

| Issue | Fix |
| --- | --- |
| `GET /api/leaves/history` serialized `LeaveRequest → Employee → User`, exposing `PasswordHash` | Every response is now a DTO. Leave uses one shared `Expression` projection so an entity graph cannot be returned by accident |
| `ProfileController` and `NotificationsController` read `User.FindFirstValue("sub")`, which JwtBearer remaps — `int.Parse(null)` threw on every call | One `ClaimsPrincipalExtensions.UserId()` that checks both claim keys, used everywhere |
| No leave balances were ever created, so **every** leave application failed | Balances are allocated on employee creation and backfilled at startup (`LeaveService.EnsureBalancesAsync`) |
| Double-approve could deduct twice | Approval claims the row with a guarded `ExecuteUpdateAsync` (`WHERE Status = Pending`) inside a transaction, then deducts with a second guarded statement (`WHERE Total - Taken >= days`). Zero rows affected means someone else won the race, and the transaction rolls back |
| Validation ran inside the transaction, and failures returned without an explicit rollback | Validation precedes the transaction; every failure path rolls back explicitly |
| `appsettings.example.json` was loaded as the **required** primary config source | Removed. Configuration is `appsettings.json` → environment file → user secrets → environment variables. The example file is documentation only |
| Uploads trusted the declared MIME type and extension; no dimension check; non-profile categories had no type check at all | `FileInspector` identifies JPEG/PNG/WebP/PDF from magic bytes and parses real dimensions. Per-category policies enforce type, size and minimum 300×300 for photos |
| `StartsWith(_root)` let a sibling directory pass the containment check | Anchored with a directory separator |
| Files had no authorized download path and `StoredFile` was never written | All downloads go through authorized endpoints that check ownership; `StoredFile` records owner, category, type and size |
| No rate limiting or lockout on auth | Fixed-window IP rate limiting (configurable) plus 5-attempt lockout for 15 minutes |
| Refresh-token reuse failed quietly | Presenting a rotated or revoked token now revokes the entire chain and is audited |
| Login timing revealed whether an account existed | A dummy hash is computed for unknown logins |
| No audit trail despite an `AuditLog` entity | `IAuditService` records 20+ operations. Passwords and tokens are never written |

### New functionality

- **Controllers**: Employees (admin CRUD, profile, photo), National Holidays, Management Leaves,
  Dashboard, Salary Slips, Reimbursements, Referrals, Audit Logs. Calendar, Planning, Leave and
  Notifications were rebuilt on the service layer.
- **Email**: `IEmailService` with a real `System.Net.Mail` SMTP implementation, HTML-encoded
  templates, and a development sink that writes `.eml` files so the path works without credentials.
  Misconfiguration is logged loudly rather than swallowed.
- **Birthday job**: `BirthdayNotificationService` (hosted service) with a `BirthdayEmailLogs`
  idempotency table carrying a unique index on `(EmployeeId, SentForDate)`. The claim row is
  inserted *before* the send, so a restart, a second instance or a repeated tick cannot duplicate.
- **Planning generator**: `CompanyPlanningGenerator`, a pure static function implementing the
  NTNS / dry-run / SNU rules with a configurable cancellation window. Admins preview, generate,
  and override; overridden events survive regeneration.
- **Calendar**: extended to birthdays, work anniversaries and notice-period dates, with 29 Feb
  handled and leave reasons hidden from non-administrators.
- **Working days**: `WorkingDaysCalculator` provides both the leave day count and the employment
  duration, so they can never disagree.
- **Dashboards**: every figure computed from live data. No trend percentages are produced, because
  no historical snapshots exist to compare against.
- **Cross-cutting**: centralized exception middleware with correlation ids, the `ApiResponse`
  envelope applied to model-validation failures and 401/403 too, `ILogger` throughout, pagination
  on all list endpoints, security headers, Swagger restricted to Development with a bearer
  definition, and a health check that verifies database connectivity.

### Database

- **Migrations** replace `EnsureCreated`. Startup applies pending migrations only; it never drops
  or recreates a database.
- Explicit relationships with deliberate delete behaviour: leave history, audit rows and service
  records use `Restrict`/`SetNull`, so an employee's history survives. Employees are deactivated,
  never deleted.
- String lengths on every property. Previously `User.Email` mapped to `nvarchar(max)` with a
  unique index, which SQL Server cannot create — the schema would have failed on a real server.
- Indexes on every filtered foreign key, both token-hash columns, and the calendar date ranges.
- New: `BirthdayEmailLogs`; `Employee.EmploymentStatus/ResignationDate/LastWorkingDate`;
  `User.MustChangePassword/FailedLoginCount/LockedOutUntilUtc/LastLoginAtUtc`;
  `LeaveType.DisplayOrder`; `LeaveRequest.ReviewedByUser`; `StoredFile.OwnerEmployeeId`.
- Leave-type seeding corrects quota drift on every start and retires (rather than deletes) any
  unexpected type, so historical records referencing it stay readable.

### A deliberate addition

`Database:Provider` allows SQLite instead of SQL Server. SQL Server remains the product database
and the documented default; the SQLite path exists so the API can be run and exercised on a
machine without SQL Server — which is how the runtime verification in `FINAL_VERIFICATION.md` was
performed. Migrations are authored for SQL Server; the SQLite path creates the schema from the model.

---

## Frontend

Rebuilt from one placeholder file into a complete application.

- **API layer**: typed client mirroring the server DTOs, with a request interceptor for the bearer
  token and a response interceptor that performs a single shared refresh-and-retry on 401 and ends
  the session when that fails. `ApiError` carries the server's message and field errors.
- **Auth**: session context that verifies a stored session against `/api/auth/me` before trusting
  it, so a revoked session cannot leave a stale name on screen. Logout calls the server to revoke
  the refresh token. Signing out in one tab signs out the others.
- **Guards**: `ProtectedRoute` (with `adminOnly`) and `PublicOnlyRoute`. Unauthenticated access to
  any protected URL redirects to `/login` and remembers the destination. The server enforces the
  same rules independently.
- **Design system** (`theme.ts`): one set of tokens and component overrides — navy sidebar, light
  canvas, white rounded cards, purple accents, soft shadows, consistent tables, buttons, dialogs
  and chips. Event types have a shared colour identity used by the calendar, planning and chips.
- **Shell**: collapsing dark navy sidebar with grouped sections, icons and active highlighting;
  top bar with avatar, name, account menu (My Profile / Change Password / Settings / Log out),
  notification bell with unread badge, and the Trending button.
- **Trending popup**: this month's birthdays, anniversaries, holidays and events, with a slow
  40-second avatar orbit that counter-rotates so faces stay upright. Decorative only — the same
  items are listed beneath, it is hidden from assistive technology and on small screens, and it
  stops entirely under `prefers-reduced-motion`.
- **Pages**: admin and employee dashboards, apply leave, leave history, leave types, admin leave
  review, employees, holidays (tabbed), common calendar, company planning, profile, change
  password, salary slips, reimbursements, referrals, audit log, settings, 404, login, forgot and
  reset password.
- **Leave form**: single/multiple toggle that swaps one date field for two, half-day options only
  where the type allows, mandatory reason, and a live day count fetched from the server so the
  displayed figure is exactly what will be deducted.
- **States**: `DataState` gives every list page loading, error, empty and loaded states.
  `BusyButton` disables and shows progress, so Approve, Save, Upload and Submit cannot double-fire.
  Toasts auto-dismiss; destructive actions confirm first.
- **Password fields**: one `PasswordField` with an eye/eye-off toggle, used on login, change,
  reset and admin password-set.
- **Quality**: `index.html` rebuilt with charset, viewport and title; strict TypeScript with
  `noUnusedLocals`/`noUnusedParameters`; ESLint with `no-explicit-any` as an error. No `any`,
  `@ts-ignore` or `@ts-nocheck` anywhere in the codebase.

---

## Removed

- `Controllers/ProfileController.cs` — superseded by `EmployeesController`, with which it
  conflicted on the `api/employees/me` route.
- The `main.tsx` placeholder component and its dead routes.
- The dead "Forgot password?" button that had no handler.
- The guard rule that redirected administrators away from shared pages such as the calendar.
- The `appsettings.example.json`-as-primary-configuration behaviour.

Nothing related to Optional Holiday was removed, because none existed in this solution — verified
by searching the whole tree. The only occurrences are the notes in the documentation stating that
it is deliberately absent. The legacy project under `Project HRM Old/` retains its own Optional
Holiday tables and was not touched.

---

## Deliberately not done

Per the "do not overengineer" constraint: no microservices, Redis, Kubernetes, Kafka, event
sourcing or CQRS framework. The application stays an ASP.NET Core API with EF Core, a thin service
layer and a React SPA.

Recorded as future work: moving tokens from `localStorage` to `httpOnly` cookies with CSRF
protection; virus scanning on uploads; and structured log shipping.
