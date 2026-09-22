# HRM — Human Resource Management Portal

A single product made of an ASP.NET Core 10 Web API and a React + TypeScript + Vite SPA, backed
by Microsoft SQL Server.

| Layer | Technology | Location |
| --- | --- | --- |
| Backend | ASP.NET Core 10 / C#, EF Core | `HRM.Server` |
| Frontend | React 18 + TypeScript + Vite + MUI | `HRM.Client` |
| Tests | xUnit (backend), Vitest (frontend) | `HRM.Server.Tests`, `HRM.Client/src/test` |
| Database | Microsoft SQL Server 2019+ / LocalDB | EF Core migrations |

---

## What the product does

**Everyone (one sign-in page, role decides the destination)**

- Single `/login` page; administrators land on the admin dashboard, employees on theirs.
- Password show/hide on every password field; forgot-password and reset-password by email.
- Change password from the account menu or the sidebar — never a forced redirect.
- One common calendar: birthdays, work anniversaries, approved leave, national holidays,
  management leave, and (administrators only) notice-period dates.
- A separate company planning calendar for releases and company events.
- Trending / monthly highlights popup with a slow rotating ring of this month's celebrations.
- In-app notifications with an unread badge, mark-one-read and mark-all-read.
- Profile with photo upload/replace/remove and an automatic working-duration calculation.
- Salary slips, reimbursement claims and candidate referrals.

**Employees**

- Apply for leave with a single-day / multiple-day toggle, optional half day, and a mandatory reason.
- Leave balances, leave history, and withdrawal of their own pending requests.

**Administrators**

- Create, edit, activate and deactivate employees; reset an employee's password (never read it).
- Approve, reject and cancel leave, with balances updated transactionally.
- Manage national holidays, management leave and the company planning calendar.
- Generate the yearly release schedule and override any generated date.
- Upload salary slips, review reimbursements and referrals, and read the audit log.

### Leave types (fixed)

| Code | Name | Annual quota | Half day |
| --- | --- | ---: | --- |
| EL | Earned Leave | 15 | Yes |
| SL | Sick Leave | 6 | Yes |
| CL | Casual Leave | 6 | Yes |
| FL | Floater Leave | 3 | No |
| WFH | Work From Home | 40 | Yes |

There are no other employee leave types. **Management Leave and National Holiday are company-wide
calendar events**: they never appear in a leave balance, cannot be applied for, and are never
deducted. There is no Optional Holiday module — Floater Leave replaces it.

### Leave rules

- Weekends and national holidays are never counted. The server calculates the day count and the
  client displays exactly that figure (`POST /api/leaves/preview`).
- A half day must be a single date, on a leave type that allows it.
- Overlapping pending or approved requests are refused.
- **Availability = quota − approved − pending.** Pending days are counted when validating a new
  request, so an employee cannot stack pending requests beyond their quota.
- Approve deducts the balance and emails everyone; reject deducts nothing; cancel restores the
  balance; an employee may withdraw only their own pending request.
- Approval and cancellation run in a transaction with a guarded status transition, so a
  double-click or two simultaneous approvals cannot deduct twice.

### Company planning rules

- **NTNS (NT)** — 4 per year, roughly every 3 months, always a Sunday.
- **Dry run (IT)** — exactly one week before each NTNS release.
- **SNU** — fortnightly on a Wednesday. An occurrence within `App:SnuCancellationWindowDays`
  (default 7) of an NTNS release is cancelled and reported.
- **Company event (E)** — added by hand.

The rules live in one testable function (`Services/CompanyPlanningGenerator.cs`); no dates are
hard-coded in React. Administrators preview the schedule, generate it, and may edit any generated
date — an edited event is marked "adjusted" and regeneration leaves it alone.

---

## Prerequisites (Windows)

- Windows 10/11
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) — check with `dotnet --version`
- Node.js 20 LTS or later — check with `node --version`
- SQL Server 2019+, SQL Server Express, or LocalDB
- PowerShell 7+ recommended

---

## Running it on Windows

### 1. Backend

```powershell
cd "HRM\HRM.Server"

dotnet restore
dotnet build

# Secrets stay out of the repository.
dotnet user-secrets init
dotnet user-secrets set "Jwt:Secret" "a-unique-random-value-of-at-least-32-characters"
dotnet user-secrets set "InitialAdmin:Password" "a-strong-local-admin-password"
```

Set the connection string in `appsettings.json` if LocalDB is not what you want. The default is:

```json
"DefaultConnection": "Server=(localdb)\\MSSQLLocalDB;Database=HRM;Trusted_Connection=True;TrustServerCertificate=True"
```

Create the database and start the API:

```powershell
dotnet tool install --global dotnet-ef      # once per machine
dotnet ef database update
dotnet run
```

The API listens on `http://localhost:5000`. Swagger (development only) is at
`http://localhost:5000/swagger`, and `http://localhost:5000/health` reports database connectivity.

On first start the app seeds the five leave types, the initial administrator, and leave balances
for the current year. In the Development environment it also seeds three demo employees
(`priya.sharma`, `arjun.mehta`, `neha.iyer`, password `Demo@12345`), sample holidays and a
generated planning schedule. Turn that off with `"InitialAdmin": { "SeedDemoData": false }` in
`appsettings.Development.json`.

### 2. Frontend

In a second PowerShell window:

```powershell
cd "HRM\HRM.Client"

npm install
npm run build      # type-check and production build
npm run dev        # development server on http://localhost:5173
```

If the API is not on port 5000:

```powershell
$env:VITE_API_TARGET = "http://localhost:<api-port>"
npm run dev
```

### 3. Sign in

Username `admin` (or the email in `InitialAdmin:Email`, default `admin@hrm.local`) with the
password you set in user secrets.

---

## Tests

```powershell
cd "HRM"
dotnet test                      # 61 backend tests

cd "HRM.Client"
npm test                         # frontend unit tests
npm run lint                     # ESLint, zero warnings allowed
```

Backend tests cover working-day arithmetic, the employment-duration calculation, the leave engine
(quotas, pending-aware availability, half days, overlaps, approve/reject/cancel/withdraw, balance
restoration, double-approval) and file content inspection.

---

## Configuration

Environment variables override JSON; user secrets override `appsettings.json`. `appsettings.example.json`
is documentation only and is never loaded by the application.

| Setting | Required | Purpose |
| --- | --- | --- |
| `ConnectionStrings__DefaultConnection` | Yes | SQL Server connection string |
| `Database__Provider` | No | `SqlServer` (default) or `Sqlite` for a machine without SQL Server |
| `Jwt__Secret` | Yes | Unique signing secret, 32+ characters. The app refuses to start without it |
| `Jwt__Issuer`, `Jwt__Audience` | No | Token issuer and audience |
| `Jwt__AccessTokenMinutes`, `Jwt__RefreshTokenDays` | No | Session lifetimes (30 minutes / 14 days) |
| `InitialAdmin__Email`, `InitialAdmin__UserName` | No | Initial administrator identity |
| `InitialAdmin__Password` | First run | Initial administrator password |
| `InitialAdmin__SeedDemoData` | No | Seeds demo employees and sample data. Local evaluation only |
| `Smtp__Enabled` | No | `false` writes email to a local pickup folder instead of sending |
| `Smtp__Host`, `Smtp__Port`, `Smtp__UseStartTls` | For email | SMTP server |
| `Smtp__Username`, `Smtp__Password` | For email | SMTP credentials |
| `Smtp__FromEmail`, `Smtp__FromName` | For email | Sender identity |
| `Smtp__PickupDirectory` | No | Where the development mail sink writes `.eml` files |
| `Storage__RootPath` | No | Upload root (default `App_Data/Storage`) |
| `App__ClientBaseUrl` | For email | Base URL used to build password-reset links |
| `App__CompanyName` | No | Name shown in emails |
| `App__SnuCancellationWindowDays` | No | SNU-to-NTNS proximity window (default 7) |
| `RateLimiting__AuthPermitLimit`, `RateLimiting__AuthWindowSeconds` | No | Auth rate limit (default 10/minute per IP) |
| `Cors__AllowedOrigins` | No | Allowed SPA origins |

Never commit `appsettings.json` with real values, `.env`, JWT secrets, SMTP passwords or
production connection strings. See [`.env.example`](.env.example) for the variable names.

### Email

Three emails are sent, and only these three:

1. **Leave approved** — to every active user, with employee, type, dates, days and approver.
2. **Birthday** — to every active user including the birthday employee, once per employee per day.
3. **Password reset** — the reset link, to the requesting address only.

No email is sent on leave application, rejection or cancellation; those are in-app notifications.

With `Smtp:Enabled=false` (the default) every message is written as an `.eml` file to
`App_Data/Mail`, so the whole path can be exercised without credentials. With `Smtp:Enabled=true`
and an incomplete configuration, the failure is logged loudly rather than swallowed.

The birthday mailer is a background service that writes a row to `BirthdayEmailLogs` before
sending. A unique index on `(EmployeeId, SentForDate)` makes a duplicate send impossible across
restarts or multiple instances.

---

## API map

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `/change-password`; `GET /api/auth/me` |
| Employees | `GET/PUT /api/employees/me`; `POST/DELETE /api/employees/me/profile-image`; `GET /api/employees/{id}/profile-image`; `GET /api/employees/directory`; admin: `GET/POST /api/employees`, `GET/PUT /api/employees/{id}`, `POST /api/employees/{id}/reset-password|deactivate|activate` |
| Leave | `GET /api/leaves/types`, `/balance`, `/history`, `/{id}`; `POST /api/leaves`, `/preview`, `/{id}/approve|reject|cancel|withdraw` |
| Calendar | `GET /api/calendar`, `GET /api/calendar/highlights` |
| Holidays | `GET/POST /api/national-holidays`, `PUT/DELETE /api/national-holidays/{id}` |
| Management leave | `GET/POST /api/management-leaves`, `PUT/DELETE /api/management-leaves/{id}` |
| Planning | `GET/POST /api/company-planning`, `PUT/DELETE /api/company-planning/{id}`, `POST /api/company-planning/generate`, `/generate/preview` |
| Dashboards | `GET /api/dashboard/admin`, `GET /api/dashboard/employee` |
| Salary slips | `GET /api/salary-slips`, `GET /api/salary-slips/{id}/download`, `POST/DELETE` (admin) |
| Reimbursements | `GET/POST /api/reimbursements`, `GET/PUT/DELETE /{id}`, `POST /{id}/review` (admin), `POST/GET /{id}/attachment` |
| Referrals | `GET/POST /api/referrals`, `GET /{id}`, `POST /{id}/review` (admin), `POST/GET /{id}/resume` |
| Notifications | `GET /api/notifications`, `/unread-count`; `POST /{id}/read`, `/read-all` |
| Audit | `GET /api/audit-logs`, `/modules` (admin) |

Every endpoint returns the same envelope, including errors:

```json
{ "success": true, "message": "…", "data": { }, "errors": null }
```

### Access matrix

| Feature | Admin | Employee |
| --- | --- | --- |
| Dashboard | Yes | Yes |
| Employee management | Yes | No |
| Own profile | Yes | Yes |
| Other employee profile | Full | Directory view only |
| Leave apply | Yes | Yes |
| Leave approve / reject / cancel | Yes | No |
| Withdraw pending leave | — | Own request only |
| Leave balance | Own and others' | Own only |
| National holidays / management leave | Manage | View |
| Common calendar | Yes | Yes |
| Company planning | Manage | View |
| Salary slips | All | Own only |
| Reimbursements | Review all | Own only |
| Referrals | Review all, internal notes | Own only, no internal notes |
| Audit logs | Yes | No |

---

## Security

The server is the security boundary; the SPA's route guards are a convenience only.

- JWT access tokens (30 minutes) with rotating refresh tokens, hashed with SHA-256 at rest.
  Presenting a rotated or revoked token revokes the whole chain.
- Logout revokes the refresh token server-side; changing or resetting a password revokes every session.
- Passwords hashed with ASP.NET Core `PasswordHasher` (PBKDF2). No endpoint returns a password.
- Account lockout after 5 failed attempts, plus IP rate limiting on the auth endpoints.
- Forgot-password never reveals whether an address exists; reset tokens are hashed, expire in one
  hour and are single-use. Tokens are never returned in a response or written to the audit log.
- Every response is a DTO, so no entity graph (and no password hash) can be serialized by accident.
- Ownership is checked on every by-id endpoint: salary slips, reimbursements, referrals, leave
  requests and employee records. An employee cannot read another employee's data by changing an id.
- Uploads are identified by **content**, not by extension or declared MIME type. Profile photos
  must be JPG/PNG/WebP, at least 300×300, at most 2 MB; salary slips and resumes must be PDF.
- Files are served only through authorized endpoints; no storage path is ever exposed.
- All data access is EF Core LINQ — no raw SQL anywhere.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`); HSTS and
  HTTPS redirection outside Development. Swagger is Development-only.
- Audit logging on sign-in, sign-out, leave decisions, employee changes, password resets, holiday
  and planning changes, salary uploads, reimbursement and referral reviews. Never passwords or tokens.

**Known trade-off:** tokens are held in `localStorage`, which is readable by any XSS on the origin.
Moving them to `httpOnly` cookies with CSRF protection is recorded as future work.

---

## Database

Code-first with EF Core migrations in `HRM.Server/Data/Migrations`.

- Startup applies pending migrations. It never drops or recreates an existing database.
- Relationships are configured explicitly; leave history, audit rows and service records use
  `Restrict`/`SetNull` so deactivating an employee never destroys their history. Employees are
  deactivated, never deleted.
- Indexes cover every filtered foreign key, both token-hash lookups, and the calendar date ranges.
- Leave balances are allocated when an employee is created and backfilled at startup, so a new
  employee can apply for leave immediately.

To add a migration after changing an entity:

```powershell
cd "HRM\HRM.Server"
dotnet ef migrations add <Name>
dotnet ef database update
```

---

## Troubleshooting

- **"Jwt:Secret must be set…" on startup** — run the `dotnet user-secrets set "Jwt:Secret" …` command above.
- **"No users exist yet and InitialAdmin:Password is not set"** — set `InitialAdmin:Password` in user secrets.
- **SQL connection failure** — check LocalDB with `sqllocaldb info`, then correct the connection string.
- **Client cannot reach the API** — set `$env:VITE_API_TARGET` to the API URL and restart Vite.
- **Port already in use** — `dotnet run --urls http://localhost:5001`, then point `VITE_API_TARGET` at it.
- **`dotnet ef` not found** — `dotnet tool install --global dotnet-ef`, then reopen PowerShell.
- **No email arriving** — with `Smtp:Enabled=false`, look in `HRM.Server/App_Data/Mail`. With it
  enabled, check the application log for the SMTP error.

---

## Repository layout

```text
HRM/
├── HRM.sln
├── HRM.Server/            ASP.NET Core 10 Web API
│   ├── Controllers/       12 controllers
│   ├── Services/          Auth, leave, calendar, dashboard, email, files, audit, planning
│   ├── Data/              DbContext, migrations, seeding
│   ├── Entities/          Domain model
│   ├── DTOs/              Request and response contracts
│   └── Infrastructure/    Options, claims, error handling
├── HRM.Server.Tests/      xUnit tests
├── HRM.Client/            React + TypeScript + Vite SPA
│   └── src/
│       ├── api/           Typed client and service layer
│       ├── auth/          Session context and route guards
│       ├── components/    Layout, shared UI, feedback states
│       ├── pages/         Application screens
│       ├── hooks/         Data-fetching and action helpers
│       └── theme.ts       Design system
├── PROJECT_REVIEW.md      Review of the inherited codebase
├── IMPLEMENTATION_NOTES.md What changed and why
├── FINAL_VERIFICATION.md  What was verified, and how
└── .env.example           Configuration variable names (placeholders only)
```
