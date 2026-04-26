# ElevagePro Ultimate (PHP) — WebReed-style app

A lightweight, self-hostable PHP/MySQL application for professional kennel & breeding management.
Built for shared hosting: pure PHP + MySQL (PDO), Bootstrap (CDN).

## Features (v1)
- Secure authentication (session + password hashing)
- Dogs (Setters, Pointers…): CRUD + filters (sexe, statut)
- Heat cycles: dates, phases, notes
- Matings & Litters: structure ready in DB (plug-in pages to add)
- Vaccinations & Deworming: reminders with next due dates
- Health tests & files (DB ready, UI to extend)
- Events & Tasks: unified agenda + ICS export
- Clients & Sales: DB ready (UI to extend)
- Dashboard KPIs & alerts (retards vaccin, chaleurs en cours, etc.)
- Server-side search, pagination, CSRF protection, flash messages
- Clean structure to grow into a full back-office

> Default admin: **admin@example.com** / **Admin123!** — change immediately after install.

## Install
1. Create a new MySQL database (utf8mb4_general_ci).
2. Import `migrations/001_init.sql`.
3. Edit `includes/config.php` with your DB credentials.
4. Upload the whole folder to your hosting (e.g., `public_html/elevage`).
5. Browse to `/auth/login.php` and sign in.

## Notes
- All app pages include your required lines:
  ```php
  require '../includes/auth.php';
  require '../includes/config.php';
  ```
- You can add more modules by duplicating the pattern in `/dogs`, `/heats`, `/vaccinations`.
- For Next.js/React admin later, reuse the same DB and add JSON endpoints.

## Roadmap
- Pedigree & COI calculator
- Mobile PWA + offline forms
- Finance: purchases/expenses dashboard
- PDF contracts & doc templates
- Role permissions (assistant/handler/vet/client portal)
