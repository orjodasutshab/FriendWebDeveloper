# Friend Web Developer – Agency Platform

React + TypeScript (Vite) frontend, Node.js + Express backend. Data is stored in `data.json`.

    npm install
    npm run dev                  # site: http://localhost:5173  (API on :3000)
    npm run build && npm start   # production on :3000

## Logins
- Staff / Admin / Client: `/#/admin`  (first run creates `admin` / `admin123`, role Super Admin)
- Client self-registration: `/#/register`  (needs admin approval)
- Admin-created client: Clients -> Add client -> send the invitation link
Change the default admin before going live:

    # PowerShell
    $env:ADMIN_USER="name"; $env:ADMIN_PASS="strong-password"; npm start

## Included (Phase 1, 3, 4 core, 5, 6 core)
Roles & permission matrix (Create/Read/Update/Delete/Approve per module), team members, recruitment,
client management + client portal, projects (milestones, revisions, approval, files), Kanban tasks,
invoices / payments / verification / expenses / profit-loss, support tickets, chat with unread counts,
notifications, activity logs, reports, CSV export, printable PDF invoices & receipts.

## Not included yet
Attendance & leave, interview scheduling, two-factor auth, email sending (verification / invitation emails,
so invitation links are copied manually), real file upload, online payment gateway, database backup tool.

## Security notes
Passwords hashed (scrypt), 7-day sessions, login rate limit, server-side permission checks on every route,
clients only see their own projects/invoices/files/tickets. Auth uses a Bearer token header (no cookies), so CSRF does not apply.
For production put the site behind HTTPS.
