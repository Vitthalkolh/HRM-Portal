# Final Verification

Every section is marked **PASS** (genuinely executed and observed), **FAIL**, **BLOCKED** (could
not be executed here, with instructions to verify on Windows) or **NOT APPLICABLE**.

Nothing below is marked PASS on the strength of a code reading alone.

---

## Environment

**PASS (with one substitution, described below)**

| Tool | Status |
| --- | --- |
| .NET SDK | Not present at review start. Installed 10.0.401 locally, so the backend was genuinely compiled, run and tested |
| Node.js | 20.14.0, npm 10.7.0 — present |
| `dotnet-ef` | 10.0.12 — installed; migrations generated |
| SQL Server | **Not available.** Docker is installed but requires a password this session cannot supply, and there is no local SQL Server |
| Browser automation | Not available |

**Substitution:** because SQL Server could not be started, the API was run against SQLite via the
`Database:Provider` setting, and everything below was exercised against a **live, running API with
a real database**. This verifies all application logic, authorization and workflow. It does not
verify SQL-Server-specific schema creation — see **Database** below.

---

## Backend Build

**PASS**

```
dotnet build HRM.sln            -> Build succeeded, 0 errors, 0 warnings
dotnet build HRM.sln -c Release -> Build succeeded, 0 errors, 0 warnings
```

## Backend Tests

**PASS** — `dotnet test HRM.sln` → **61 passed, 0 failed**.

Coverage: working-day counting (weekends, holidays, inverted ranges), employment duration
(including the month-end borrow case), the planning generator (NTNS count and weekday, dry-run
offset, SNU cadence and cancellation, determinism, anchor snapping) and the leave engine (quota
allocation and idempotency, pending-aware availability, half-day rules, overlaps, weekend-only
rejection, holiday exclusion, approve/reject/cancel/withdraw, balance restoration, double-approval,
and a check that the projection never exposes the user entity).

Two real defects were found by these tests and fixed: the duration calculation returned a negative
day count when the joining day-of-month exceeded the previous month's length (31 Jan → 1 Mar), and
the planning generator produced only three dry runs because the first fell into the previous year.

## Frontend Build

**PASS**

```
npm install       -> ok
tsc -b            -> 0 errors (strict, noUnusedLocals, noUnusedParameters)
vite build        -> built in 2.66s, dist/assets/index.js 737.95 kB (225.31 kB gzip)
npm test          -> 6 passed
npm run lint      -> 0 errors, 0 warnings (no-explicit-any enforced)
```

No `any`, `@ts-ignore` or `@ts-nocheck` anywhere in the source.

## Database

**PASS** for the model, migration generation, seeding and all runtime behaviour.
**BLOCKED** for SQL Server schema creation specifically.

- An EF Core migration (`InitialCreate`) was generated **for the SQL Server provider** and is
  committed. Generating it exercises the full model configuration, so the string lengths, indexes,
  relationships and delete behaviours are all valid SQL Server DDL.
- The schema, seeding and backfill were then executed for real against SQLite: five leave types
  with the exact quotas, the initial administrator, demo employees, and leave balances for every
  employee.
- **BLOCKED:** applying that migration to a real SQL Server instance. Verify on Windows with:

  ```powershell
  cd "HRM\HRM.Server"
  dotnet ef database update
  dotnet run
  # then: http://localhost:5000/health  -> {"success":true,...,"database":"connected"}
  ```

  Then confirm in SSMS that `LeaveTypes` holds exactly EL 15, SL 6, CL 6, FL 3, WFH 40 and that
  `LeaveBalances` has five rows per employee for the current year.

## Authentication

**PASS** — verified against the running API.

| Check | Result |
| --- | --- |
| Correct credentials sign in, role returned | PASS |
| Wrong password → 401 | PASS |
| Login response contains no password hash | PASS |
| Refresh issues a new token pair | PASS |
| The rotated refresh token is rejected (401) | PASS |
| Logout → refresh afterwards returns 401 | PASS |
| Change password: wrong current / mismatch / too short all rejected | PASS |
| Change password succeeds; old password stops working, new one works | PASS |
| Forgot password returns the same answer for known and unknown addresses | PASS |
| Only the known address produces an email; no token in the response body | PASS |
| Reset with the emailed token succeeds and the new password works | PASS |
| Reusing the same reset token → 400 (single use) | PASS |
| Bogus reset token → 400 | PASS |
| Rate limiting engages on the auth endpoints | PASS |

## Authorization

**PASS** — verified against the running API.

| Check | Result |
| --- | --- |
| 16 protected endpoints return 401 when anonymous | PASS |
| Employee → admin dashboard / employee list / audit logs → 403 | PASS |
| Admin → admin endpoints → 200 | PASS |
| Employee → shared calendar → 200 | PASS |
| Employee reading another employee's record → 403 | PASS |
| Employee querying another's leave balance → 403 | PASS |
| Employee querying another's salary slips → 403 | PASS |
| One employee reading another's reimbursement claim → 403 | PASS |
| One employee reading another's referral → 403 | PASS |
| Employee downloading another's salary slip → 403 | PASS |
| Employee approving leave, reviewing their own claim, adding holidays, management leave or planning → 403 | PASS |
| Employee editing or deleting a planning event → 403 | PASS |
| Marking another user's notification as read → 404 | PASS |
| Internal referral notes returned to admins only, stripped for employees | PASS |
| No `passwordHash` or `tokenHash` in any of 10 sampled responses | PASS |
| Frontend: unauthenticated deep link to `/employee/dashboard` serves the SPA, which redirects to `/login` | PASS |

## Employee

**PASS**

Create (with duplicate-email conflict), sign-in as the new employee, automatic allocation of all
five leave balances, immediate leave application, deactivate (sign-in then refused), refusal to
deactivate the last administrator, admin password reset with `mustChangePassword` set, profile
read and edit with persistence, future date-of-birth rejected, and a working-days calculation that
is greater than zero and lower than the calendar-day count.

Profile image: a valid 320×320 PNG accepted; a 100×100 PNG rejected for dimensions; an executable
renamed `.png` rejected by content inspection; a PDF rejected; the image served through the
authorized endpoint (401 when anonymous); deletion works.

## Leave

**PASS**

Exactly five leave types with quotas EL 15 / SL 6 / CL 6 / FL 3 / WFH 40, and no Management,
National Holiday or Optional Holiday entry among them.

Workflow verified end to end: Mon–Fri applied as 5 days; pending days reduce availability to 10
while `taken` stays 0 and `remaining` stays 15; overlapping request → 409; weekend-only → 400;
empty reason → 400; inverted range → 400; over-quota → 400; employee approving → 403; admin
approve → `taken` 5, `remaining` 10, pending 0; **double approve → 409 with `taken` still 5**;
cancel → `taken` back to 0; half day = 0.5; half day over a range → 400; half day on FL (not
permitted) → 400; another employee withdrawing → 403; own withdraw → 200, second → 400; reject →
`taken` unchanged at 0; withdrawing a rejected record → 400. A national holiday inside a range
reduced a 5-day request to 4.

## Calendar

**PASS** — the single common calendar returns birthdays, work anniversaries, national holidays and
management leave in one response; leave reasons are hidden from non-administrators; the highlights
endpoint returns the right month's celebrations. There is one calendar, not two.

## Company Planning

**PASS** — against generated data for 2026: exactly 4 NTNS releases, all on a Sunday, spaced about
three months apart; exactly 4 dry runs, each exactly 7 days before its NTNS release; all SNU
releases on a Wednesday at fortnightly multiples; **no SNU within 7 days of an NTNS release**, with
the cancelled occurrences reported. Employees can view but cannot create, edit or delete;
administrators can do all three. Preview for a future year works without writing anything.

## Salary

**PASS** — admin upload accepted, employee upload refused (403), an image rejected as a salary
slip, owner download 200, other employee 403, anonymous 401, admin 200, and no filesystem path in
any response.

## Reimbursement

**PASS** — create, own-only listing, ownership enforced on read, employee cannot review their own
claim, admin review succeeds and notifies the employee.

## Referral

**PASS** — create, admin review with status change, internal notes visible to administrators and
absent for the referring employee (both on the detail endpoint and in list responses), ownership
enforced against other employees.

## Email

**PASS** for the leave-approval and password-reset paths through the development sink.
**BLOCKED** for real SMTP delivery.

Observed: the approval email was produced on approval, addressed to every active user, and
contained employee, leave type, from, to, days and approver. The password-reset email was produced
for a known address and **not** for an unknown one, and the link inside it completed a working
reset. No email was produced on application, rejection or cancellation, as required.

- **BLOCKED — real SMTP:** no credentials here. On Windows set `Smtp__Enabled=true` with your host,
  port, credentials and `FromEmail`, then approve a leave request and confirm the message arrives.
  With `Smtp__Enabled=false`, messages are written to `HRM.Server/App_Data/Mail` as `.eml` files.
- **BLOCKED — birthday email:** it fires for employees whose date of birth is today. To verify on
  Windows, set an employee's date of birth to today's month and day, restart the API and wait for
  the first pass (~20 seconds), then check `App_Data/Mail`. Restarting again must not produce a
  second message for the same day — that is the idempotency guarantee, enforced by a unique index
  on `BirthdayEmailLogs(EmployeeId, SentForDate)`.

## Notifications

**PASS** — notifications were created by the leave, reimbursement, referral and salary workflows;
the unread count is correct; mark-one-read works; marking another user's notification returns 404;
mark-all-read leaves the unread count at 0.

## Security

**PASS** for everything executable here.

- No password hash or token hash in any sampled response.
- Ownership enforced on every by-id endpoint (see **Authorization**).
- File uploads validated by content, not by extension or declared type; dimension minimum enforced.
- No raw SQL anywhere — verified by search; all access is EF Core LINQ.
- Errors return a message with no stack trace and no server exception detail.
- Audit trail present for Login, Logout, LoginFailed, Leave Apply/Approve/Reject/Cancel/Withdraw,
  ChangePassword, PasswordReset, AdminResetPassword, Employee Create/Update/Deactivate, holiday and
  planning changes, salary upload and download, and reimbursement and referral reviews — with no
  password or token material in any entry.
- Secrets scan across tracked JSON, C# and TypeScript found no committed credentials.
  `appsettings.json` ships with empty SMTP values and no JWT secret; the app refuses to start
  without a real one.
- **Known and documented:** tokens live in `localStorage`, readable by any XSS on the origin.

## UI

**PASS** for build, routing, guards and API integration.
**BLOCKED** for visual inspection.

Verified by running the SPA against the live API: the dev server serves the application, the `/api`
proxy reaches the backend (login through the proxy returned 200, an anonymous protected call
returned 401), and a deep link to `/employee/dashboard` serves the SPA, which then redirects an
unauthenticated visitor to `/login`.

- **BLOCKED — visual check:** no browser automation here. The design system, the sidebar, the
  trending animation, responsive behaviour and every page's appearance need a human look. Run both
  servers and walk the checklist at the end of this document.

## Known Limitations

1. **SQL Server was never contacted.** The migration is generated for SQL Server and the model
   configuration is valid, but applying it to a real instance is unverified. This is the single
   most important thing to check first on Windows.
2. **Real SMTP delivery is unverified.** The full code path was exercised through the file sink.
3. **The birthday job was not observed firing**, because it depends on the current date. Its
   idempotency is structural (a unique index), not merely procedural.
4. **No visual/browser testing.** Layout, spacing, the trending animation and mobile behaviour
   have not been seen.
5. **Tokens in `localStorage`** — an accepted trade-off, documented in the README.
6. **The frontend bundle is 738 kB (225 kB gzipped)** in a single chunk. Fine for an internal tool;
   route-level code splitting would be the next step if it matters.
7. **No load or concurrency testing.** The double-approval guard is verified logically and by a
   sequential test, not under genuine parallel load.
8. **The solution is untracked in git.** The repository root is `Vitthal/`, whose index still holds
   the legacy project as staged deletions. Committing this work is left to you.

## Windows Run Instructions

```powershell
# ---------- backend ----------
cd "Project HRM\HRM\HRM.Server"

dotnet restore
dotnet build

dotnet user-secrets init
dotnet user-secrets set "Jwt:Secret" "a-unique-random-value-of-at-least-32-characters"
dotnet user-secrets set "InitialAdmin:Password" "a-strong-local-admin-password"

dotnet tool install --global dotnet-ef     # once per machine
dotnet ef database update
dotnet run                                  # http://localhost:5000, Swagger at /swagger
```

```powershell
# ---------- frontend (second window) ----------
cd "Project HRM\HRM\HRM.Client"

npm install
npm run build
npm run dev                                 # http://localhost:5173
```

```powershell
# ---------- tests ----------
cd "Project HRM\HRM"
dotnet test

cd HRM.Client
npm test
npm run lint
```

Sign in as `admin` with the password you set. In the Development environment three demo employees
are seeded (`priya.sharma`, `arjun.mehta`, `neha.iyer`, password `Demo@12345`); disable this with
`"InitialAdmin": { "SeedDemoData": false }` in `appsettings.Development.json`.

### Manual checks worth doing

1. `http://localhost:5000/health` returns `"database":"connected"`.
2. In SSMS: `LeaveTypes` holds exactly EL 15, SL 6, CL 6, FL 3, WFH 40.
3. While signed out, paste `/admin/dashboard`, `/profile` and `/salary-slips` into the address bar —
   each must land on `/login` with no protected content flashing.
4. Sign in as an employee, apply for leave, then approve it as the administrator and confirm the
   balance moves; cancel it and confirm the balance returns.
5. Check `HRM.Server\App_Data\Mail` for the approval email.
6. Click the Trending button and confirm the ring rotates slowly and the list matches.
7. Upload a profile photo smaller than 300×300 and confirm it is refused with a clear message.
8. Narrow the browser to phone width and confirm the sidebar collapses behind the menu button.
