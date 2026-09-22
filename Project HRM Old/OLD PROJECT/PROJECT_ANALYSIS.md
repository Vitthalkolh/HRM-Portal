# A. Already Correct

- A single React login and JWT-based sign-in already exist, with server-side role checks for administrator actions.
- The API has a useful leave workflow, working-day calculation, overlap checks, leave-balance records, SMTP abstraction, Swagger, and SQL Server scripts.
- The UI already has protected routes, profile editing/image handling, responsive layout primitives, loading/error components, and basic leave/holiday/employee pages.

# B. Needs Modification

- Rename/restructure the solution to `HRM.Server` and `HRM.Client` and replace the current JavaScript client with TypeScript + Vite + MUI.
- Replace the ADO.NET repository/stored-procedure persistence layer with EF Core entities, DbContext, migrations, and transaction-safe services.
- Update leave quotas to EL 15, SL 6, CL 6, FL 3, WFH 40; remove pro-rating/yearly allocation behavior while preserving historical records.
- Rework authentication for access/refresh tokens, token revocation, forgot/reset password, robust API error envelopes, and logout invalidation.
- Replace old non-namespaced routes with the specified role-specific routes and a single common calendar.

# C. Needs Removal

- Optional Holiday frontend pages, routes, navigation, endpoints, services, models, stored procedures, and database tables after a dependency-preserving migration.
- Separate My Calendar and Company Calendar concepts; they become one authorized common calendar.
- Management Leave and National Holiday from employee leave types and balances.
- External logo markup and unrelated remote branding in the current layout.

# D. Needs Addition

- EF Core data model, migrations, refresh-token and password-reset token storage, normalized roles/employees, notifications, audit logs, planning, claims, referrals, salary slips, and reusable stored-file metadata.
- Company Planning, Management Leave, Reimbursement, Referral, Salary Slip, Notifications, Settings, Reports, and Trending/Highlights modules.
- Reusable MUI theme, application layout, data-table/form/calendar/chart components, role-aware navigation, snackbars, global error handling, and light/dark mode.
- Hosted birthday-email processing with idempotency and separate HTML templates.
- Automated tests for authentication, leave transaction rules, planning rules, and file authorization.

# E. Database Changes

- The current schema is destructive on rerun and is therefore unsuitable for production migration. Introduce EF migrations that retain existing employee and leave history.
- Map existing users/leaves/balances where viable; deprecate optional-holiday records rather than relabeling them as employee leave.
- Add tables/indexes for refresh tokens, reset tokens, notifications, audit logs, planning events, management leaves, expense claims, referrals, salary slips, file metadata, and birthday-email delivery records.
- Seed only Admin/Employee roles and the five required employee leave types. Initial admin credentials must come from configuration, not committed SQL.

# F. Backend Changes

- Add consistent API envelopes, validation, global exception/correlation middleware, EF transactional leave approval/cancellation, role policies, and authorization checks on every protected resource.
- Build reusable SMTP email and file-storage abstractions. Email failures must be logged/queued without rolling back completed business transactions.
- Centralize planning-date generation and file validation; expose documented REST endpoints and JWT-capable Swagger.

# G. Frontend Changes

- Build the requested MUI design system and responsive dashboard shell with a navy sidebar, header menus, notification bell, and profile menu.
- Create single-login, refresh-aware session handling and role guards for `/admin/*` and `/employee/*` routes.
- Replace Optional Holiday and duplicate calendar pages with the five-type leave form and shared calendar; add the remaining role-appropriate modules.
- Keep remote data in a service/query layer, and local auth/theme/notification state in focused stores.

# H. Notification Changes

- Existing email sends on multiple leave outcomes; change the required email behavior to send the leave-approved message to all users only on approval.
- Add in-app notifications with unread/read state, mark-one/all operations, and separate delivery from email.
- Add idempotent birthday email dispatch and template files for approved leave, birthday, and password reset.

# I. Migration / Risk

- Do not run the current `01_Schema.sql` against production: it drops tables. Back up first, introduce additive migrations, and verify Optional Holiday references before deprecation.
- Existing leave records using ML/NH or old quotas must remain historical and must not be silently reclassified.
- The current configuration contains a development JWT key and an environment-specific database host; replace with examples/environment variables before deployment.
- No EF models or migrations currently exist, so the persistence migration requires staged data validation and rollback planning.

# J. UI/UX Changes

- Replace the current plain CSS/emoji navigation and remote logo with an accessible MUI theme, iconography, typography, cards, dialogs, toasts, skeletons, and responsive drawer.
- Recreate the supplied design language with a navy/purple login hero and white card, rather than copying external artwork.
- Standardize pages around section label, title, description, actions, loading/empty/error states, searchable pageable tables, and accessible form controls.

# K. Testing Plan

- Unit-test credential/token flows, refresh/logout, password-reset expiry, role authorization, leave capacity including pending requests, overlap, approval/cancellation restoration, and planning-date rules.
- Integration-test protected API endpoints, upload type/size/ownership restrictions, notification state, and consistent validation envelopes.
- Add frontend route-guard/form-validation tests and smoke-test admin/employee dashboards, shared calendar, responsive navigation, and theme switching.
