# HRM Portal

Leave and holiday management for the company, built as **two separate projects**:

```
Vitthal/
├── HRM/        ASP.NET Core 10 Web API  (backend + SQL Server scripts)
└── hrm-web/    React 18 + Vite SPA      (frontend)
```

The SPA talks to the API over JSON and authenticates with a JWT.

---

## 1. Database

Nothing in the app works until the database exists. Run the four scripts **in order**
against your SQL Server instance (SSMS, Azure Data Studio or `sqlcmd`):

| Order | Script | What it does |
|-------|--------|--------------|
| 1 | `HRM/Database/01_Schema.sql` | Creates the `HRM` database, tables, keys and indexes |
| 2 | `HRM/Database/02_SeedData.sql` | Leave types, statuses, 2026 holidays, six demo users, email templates |
| 3 | `HRM/Database/03_StoredProcedures.sql` | Every `SP_*` the API calls, plus two helper functions |
| 4 | `HRM/Database/04_AllocateBalances.sql` | Gives each seeded employee their leave quota for this year and next |

`01_Schema.sql` **drops the existing tables** before recreating them, so do not run it
against a database that already holds real data.

### Leave types

| Code | Name | Annual quota | Half day | Deducted from a quota |
|------|------|--------------|----------|------------------------|
| EL | Earned Leave | 15 | yes | yes |
| SL | Sick Leave | 8 | yes | yes |
| CL | Casual Leave | 6 | yes | yes |
| FL | Floater Leave | 5 | no | yes (also caps optional holidays) |
| WFH | Work From Home | — | yes | no, but still needs approval |
| ML | Management Leave | — | yes | no, but still needs approval |
| NH | National Holiday | — | — | company-wide, cannot be applied for |

Quotas live in `LEAVE_TYPES.DEFAULT_ENTITLEMENT` and are pro-rated by joining month.
An admin can override any individual quota via `POST /api/leave/allocate`.

---

## 2. Backend — `HRM/`

### Configure

The app settings file ships with an empty `Jwt:Key`; the API **refuses to start** without
one of at least 32 characters. The Development settings file contains a development key,
so `dotnet run` works out of the box.

For anything beyond your own machine, supply the real values outside source control:

```bash
cd HRM
dotnet user-secrets init
dotnet user-secrets set "Jwt:Key" "<a long random string>"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "<your connection string>"
```

Update `ConnectionStrings:DefaultConnection` to point at your SQL Server
(it currently reads `Server=DELL3511;Database=HRM;Trusted_Connection=True;`).

### Run

```bash
cd HRM
dotnet restore
dotnet run
```

| URL | |
|-----|---|
| `https://localhost:7273` | HTTPS |
| `http://localhost:5278` | HTTP (what the SPA proxy uses) |
| `https://localhost:7273/swagger` | Swagger UI, with an **Authorize** button for the JWT |
| `/health` | anonymous health check |

### Endpoints

| Method | Route | Who |
|--------|-------|-----|
| POST | `/api/auth/login` | anonymous |
| GET | `/api/auth/me` | any signed-in user |
| POST | `/api/auth/change-password` | any signed-in user |
| GET | `/api/users` · `/api/users/{id}` | any (an employee may only read their own record) |
| POST/PUT/DELETE | `/api/users…` | **admin** |
| POST | `/api/users/{id}/reset-password` | **admin** |
| GET | `/api/leave/types` | any |
| POST | `/api/leave` | any — applies for *themselves* |
| GET | `/api/leave` · `/api/leave/{id}` | any (employees see only their own) |
| PUT | `/api/leave/status/{id}` | **admin** — approve (2) / reject (3) |
| PUT | `/api/leave/cancel/{id}` | employee may withdraw their own *pending* leave; admin may cancel any *approved* one |
| GET | `/api/leave/balance` | any |
| POST | `/api/leave/allocate` | **admin** |
| GET | `/api/calendar/company` · `/api/calendar/my` | any |
| GET/POST/DELETE | `/api/holiday` | read: any · write: **admin** |
| POST/GET | `/api/holiday/optional` | any |
| PUT | `/api/holiday/optional/status/{id}` | **admin** |
| GET | `/api/dashboard/summary` · `/birthdays` · `/anniversaries` | any |

Authorisation is enforced server-side from the JWT, not from anything the client sends —
an employee cannot read or act on another employee's leave by changing a query string.

---

## 3. Frontend — `hrm-web/`

```bash
cd hrm-web
npm install
npm run dev          # http://localhost:5173
```

`vite.config.js` proxies `/api` to `http://localhost:5278`, so **start the API first**.
The proxy is what links the two projects in development; it also avoids CORS and the
self-signed HTTPS certificate warning.

To point at a different API, either set `VITE_API_TARGET` (dev proxy) or create
`hrm-web/.env` with the full URL for a deployed build:

```
VITE_API_BASE_URL=https://hrm-api.company.com/api
```

Build for production with `npm run build`; the output in `dist/` is static files.
Whatever host serves them must return `index.html` for unknown paths (client-side routing),
and the API's `Cors:AllowedOrigins` must list that host.

### Pages

**Everyone:** Dashboard · Apply Leave · My Leaves · Optional Holiday · My Calendar ·
Company Calendar · Holiday List · Employee Directory · My Profile

**Admin only** (hidden from the sidebar and blocked by the API): Leave Approvals ·
Optional Holiday approvals · Manage Employees · Manage Holidays

---

## 4. Signing in

There is **one login form with two portal tabs**. The tab only pre-fills the demo
credentials and sets expectations — the role that actually governs access is the one
signed into the token, so picking "Administrator" does not grant admin rights.

| Portal | Username | Password |
|--------|----------|----------|
| Administrator | `admin` | `Admin@123` |
| Employee | `rushikesh` | `Employee@123` |

Also seeded as employees: `sneha`, `vitthal`, `priya`, `amit` — all `Employee@123`.

**Change these before anyone else can reach the app.** The seeded hashes are in a
committed SQL file, so the passwords are public.

---

## 5. How leave is counted

- **Working days only.** Weekends and active national holidays are skipped, so a
  Friday-to-Monday request is 2 days, not 4.
- **Half day** = `FromDate == ToDate` with `IsHalfDay`, counted as 0.5, and recorded as
  First Half or Second Half.
- **Applying** checks `entitlement − used − pending`, so two pending requests cannot
  together overdraw the balance.
- **Approving** moves the days into `USED`. **Rejecting** does not.
- **Cancelling an approved leave** credits the days back.
- A request that overlaps an existing pending or approved leave is refused.
- A request may not span two calendar years — apply once per year.

---

## 6. Notifications

`EmailService` fills the `{{Token}}` placeholders in `AUTO_EMAIL_NOTIFICATION` and sends
on apply, approve, reject and cancel. It is **disabled by default** (`Email:Enabled: false`)
and logs what it would have sent. Set the SMTP block in configuration to switch it on.
A mail failure is logged and swallowed — it never rolls back the leave action.

---

## 7. Passwords

Passwords are hashed with PBKDF2-HMAC-SHA256, 100,000 iterations, a 16-byte random salt
per user, stored as `PBKDF2$<iterations>$<salt>$<key>` and verified in constant time.
SQL Server only ever sees the hash — `SP_USER_LOGIN` takes a username and returns the
stored hash for the API to check.
