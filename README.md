# Friend Web Developer – Team Workspace

React + TypeScript (Vite) frontend, Node.js + Express backend. Data is stored in `data.json`.

    npm install
    npm run dev       # site: http://localhost:5173  (API on :3000)
    npm run build && npm start   # production on :3000

## Team login
Open `/#/admin` or click "Team Login". First run creates the admin account
(default `admin` / `admin123`). Change before going live:

    # PowerShell
    $env:ADMIN_USER="name"; $env:ADMIN_PASS="strong-password"; npm start

## Features
Dashboard, Team Members (profiles, active/inactive), Join applications (approve → account),
Projects (assign, deadline, progress, history, discussion), Tasks (pending / in progress / completed),
Notice Board, member-to-member messages, contact inbox, website settings. Roles: admin and member.
