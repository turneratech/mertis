<p align="center">
  <img src="./imgs/logo_mid.png" alt="Mertis" width="140">
</p>

<h1 align="center">Mertis</h1>

<p align="center">
  <strong>Self-hosted, multi-project bug tracking — MySQL, PostgreSQL/Supabase, or zero-config CSV</strong>
</p>

<p align="center">
  <a href="#download">Download</a> •
  <a href="#features">Features</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#licensing">Licensing</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <a href="https://github.com/turneratech/mertis/releases/latest"><img src="https://img.shields.io/badge/download-2.2.0-1ecc77.svg" alt="Download"></a>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/changelog-2.2.0-blue.svg" alt="Changelog"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg" alt="Node">
  <img src="https://img.shields.io/badge/react-18.x-61dafb.svg" alt="React">
  <img src="https://img.shields.io/badge/MySQL-8.x-orange.svg" alt="MySQL">
  <img src="https://img.shields.io/badge/PostgreSQL-15+-336791.svg" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/license-BSL_1.1-blue.svg" alt="License">
</p>

---

## Overview

**Mertis** is a bug tracker for software teams that you run yourself. It installs on your own
infrastructure — a VPS, on-prem hardware, Docker, or a laptop — and keeps your defect history in
your own database, behind your own network.

The licence is activated once and verified **offline** from then on: take the machine off the
internet, restart, and Mertis comes up on the same tier. Community Edition is free in production
within its limits, with no expiry and no card.

- **Flexible database** — MySQL, PostgreSQL/Supabase, or CSV (evaluation / air-gapped demo)
- **Flexible file storage** — local disk, S3, Azure Blob, SharePoint, Supabase Storage
- **Outbound webhooks & plugins** — sync bugs to your data warehouse or internal systems (Trello, GitHub)
- **Tiered licensing** — Community through Enterprise / Cloud ([details](#licensing))
- **First-run setup wizard** — configure database, storage, and license after install

Built with React 18, Express, and a storage abstraction layer so application code stays backend-agnostic.


---

## Download

Install from a release tarball. That is the supported path and it needs no git:

```bash
curl -LO https://github.com/turneratech/mertis/releases/latest/download/mertis-community-2.2.0.tar.gz
curl -LO https://github.com/turneratech/mertis/releases/latest/download/mertis-community-2.2.0.tar.gz.sha256
sha256sum -c mertis-community-2.2.0.tar.gz.sha256
tar -xzf mertis-community-2.2.0.tar.gz
cd mertis-community-2.2.0
```

Follow `QUICKSTART.md` inside the bundle, or [Quick Start](#quick-start) below. Register at
[mertis.turneratech.com](https://mertis.turneratech.com/) for a free Community key, delivered
by email.

Clone this repository instead if you intend to read or change the code: it carries the tests,
which the release bundle does not.

---

## Screenshots

<p align="center">
  <img src="./imgs/dashboard_img.png" alt="Mertis admin dashboard" width="900">
</p>

<p align="center">
  <em>Admin dashboard — project health, bug metrics, and team activity</em>
</p>

<p align="center">
  <img src="./imgs/logo_small.png" alt="Mertis logo mark" width="80">
</p>

---

## Features

### Bug tracking
| | |
|---|---|
| Multi-project | Unique bug IDs per project (`SM-0001`, `RM-0042`, …) |
| Rich fields | Severity, priority, status, type, assignee, QA owner, ARB, attachments |
| Workflow | Open → In Progress → Resolved → Closed → Reopened |
| Activity log | Full audit trail of changes and comments |
| Role visibility | Users see only bugs they own, report, QA, or appear on ARB |

### Administration
| | |
|---|---|
| **Roles** | `godmode` → `admin` → `user` |
| Users & projects | CRUD, members, password reset |
| **Deployment UI** | Database, storage, webhooks, plugins, license (`/deployment`) |
| **Setup wizard** | First-run guide for CSV / new installs |
| Email reports | Scheduled SMTP reports (requires MySQL/PostgreSQL) |
| GitHub webhooks | Link commits to bugs |

### Self-hosted deployment
| | |
|---|---|
| Database | `auto`, `mysql`, `postgres`, `supabase`, `csv` |
| Attachments | `local`, `s3`, `azure`, `sharepoint`, `supabase` |
| Integrations | Signed outbound webhooks, `server/plugins/` loader |
| Health API | `GET /api/health` — storage type, DB connection, file providers |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  React client (homepage: /mertis)                             │
│  Login · Dashboard · Bugs · Projects · Deployment · License   │
└────────────────────────────┬─────────────────────────────────┘
                             │ REST /api/*
┌────────────────────────────▼─────────────────────────────────┐
│  Express server (port 5000)                                   │
│  auth · bugs · projects · analytics · attachments · deployment  │
│  license · email · github-webhook                             │
└────────────────────────────┬─────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   MySQL / Postgres      CSV files          hybrid-storage
   (production)       (demo / fallback)    (S3 · Azure · local)
```

**Startup detection** (`DATABASE_PROVIDER`):

1. `csv` → CSV only  
2. `postgres` / `supabase` → PostgreSQL  
3. `mysql` → MySQL  
4. `auto` (default) → try MySQL, then PostgreSQL, then CSV fallback  

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Supabase, S3, Azure, and webhook setup.

---

## Quick Start

### Prerequisites

- **Node.js** 16+ and **npm** 8+
- **MySQL 8** or **PostgreSQL** (optional — CSV mode needs no database)
- **Git**

### 1. Clone and install

```bash
git clone https://github.com/turneratech/mertis.git
cd mertis
cp .env.example server/.env
npm run install-all
cd hybrid-storage && npm install && cd ..
```

### 2. Choose a run mode

**Option A — CSV (fastest, no database)**

```bash
# In .env set:
# DATABASE_PROVIDER=csv

npm run dev
```

**Option B — MySQL (production)**

```bash
mysql -u root -p -e "CREATE DATABASE mertis;"
mysql -u root -p mertis < server/database/mantis.sql
mysql -u root -p mertis < server/database/license_schema.sql
mysql -u root -p mertis < server/database/deployment_schema.sql

# Edit .env with DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
# DATABASE_PROVIDER=mysql   (or auto)

npm run dev
```

**Option C — PostgreSQL / Supabase**

```bash
psql "$DATABASE_URL" -f server/database/mantis.postgres.sql
# DATABASE_PROVIDER=postgres  or  supabase
npm run dev
```

### Option D — Docker (fastest path to a running instance)

```bash
cp .env.example server/.env
# set JWT_SECRET, DB_PASSWORD and DB_ROOT_PASSWORD
docker compose up -d
# app at http://localhost:5000/mertis
```

The named volumes matter: `mertis-data` holds `server/data/deployment.local.json`,
which carries the **instance ID your licence binds to**. Remove that volume and
you must re-activate the licence.

### 3. Open the app

| | |
|---|---|
| **Dev UI** | [http://localhost:3000/mertis](http://localhost:3000/mertis) |
| **API** | [http://localhost:5000/api/health](http://localhost:5000/api/health) |
| **First account** | Created by the setup wizard on first run — it becomes the instance owner |

> The React app is served under **`/mertis`** (see `client/package.json` → `homepage`).  
> In dev, the client proxies `/mertis/api` to the Express server on port **5000**.
>
> **Local UI + remote EC2 API:** copy `client/.env.example` → `client/.env.local`, set `REACT_APP_API_TARGET` (e.g. `http://your-server:5000`), restart the React dev server, and **do not** start local Express. Full steps are in that example file and in `client/src/setupProxy.js`. There is no `server.py` — EC2 runs `server/index.js`.

### 4. First-run setup

A fresh install has no accounts. Open the app and the **Setup Wizard** walks through:

1. Welcome  
2. Database provider (optional upgrade from CSV)  
3. File storage (local / S3 / Azure)  
4. Licence key — paste the free Community key emailed to you after registering
   at [mertis.turneratech.com](https://mertis.turneratech.com/)  
5. Finish  

The account you create in the wizard is the instance owner (`godmode`). There is exactly one
per instance; promoting someone else transfers it. Setting `MERTIS_DEV_DEFAULTS=true` seeds
`admin` / `admin123` and skips the wizard — for local development only, never an install you
rely on.

Ongoing changes: **Admin → Deployment** (`/deployment`).

### Production build

```bash
npm run build
NODE_ENV=production npm start
# App + API at http://localhost:5000/mertis
```

---

## Configuration

Copy `.env.example` to `server/.env` and adjust:

```env
# Server
PORT=5000
NODE_ENV=development
JWT_SECRET=change-me-in-production
JWT_REFRESH_SECRET=change-me-too

# Database: auto | mysql | postgres | supabase | csv
DATABASE_PROVIDER=auto
DB_HOST=localhost
DB_PORT=3306
DB_USER=mertis
DB_PASSWORD=
DB_NAME=mertis
DATABASE_URL=postgresql://user:pass@localhost:5432/mertis

# File attachments: local | s3 | azure | sharepoint | supabase
DEFAULT_STORAGE=local

# Optional
OPENAI_API_KEY=           # optional; or set it in Admin -> Deployment -> AI
WEBHOOKS_ENABLED=true
WEBHOOK_SECRET=
```

| Variable | Purpose |
|----------|---------|
| `DATABASE_PROVIDER=csv` | Zero-config demo; data in `server/data/*.csv` |
| `DATABASE_PROVIDER=auto` | Try MySQL → Postgres → CSV |
| `DEFAULT_STORAGE` | Attachment backend (install `hybrid-storage` deps first) |
| `server/data/deployment.local.json` | UI-saved deployment settings (gitignored) |

Full reference: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## Project structure

```
mertis/
├── client/                 # React 18 frontend (base path /mertis)
│   ├── public/             # favicon.ico, index.html
│   └── src/
│       ├── components/     # UI + SetupWizard, DeploymentConfig
│       ├── contexts/       # LicenseContext
│       └── assets/         # Bundled logo
├── server/
│   ├── config/             # deployment, license, features
│   ├── database/           # mantis.sql, mantis.postgres.sql, license_schema.sql
│   ├── data/               # Runtime CSV + deployment.local.json (gitignored)
│   ├── plugins/            # Webhook plugin loader
│   ├── routes/             # REST API
│   ├── services/           # license, email, webhooks, file storage
│   └── storage/            # mysql · postgres · csv abstraction
├── hybrid-storage/         # S3 / Azure / SharePoint providers
├── imgs/                   # Logo + README screenshots
├── docs/DEPLOYMENT.md      # Self-hosted deployment guide
├── .env.example
└── package.json
```

---

## API overview

| Area | Base path | Notes |
|------|-----------|--------|
| Health | `GET /api/health` | Storage type, DB connection, file providers |
| Auth | `/api/auth/*` | JWT login, users, change password |
| Bugs | `/api/bugs/*` | CRUD, comments, activity |
| Projects | `/api/projects/*` | CRUD, members |
| Analytics | `/api/analytics/*` | Dashboards, reports |
| Attachments | `/api/attachments/*` | Upload / download |
| Deployment | `/api/deployment/*` | Setup, DB/storage tests, webhooks |
| License | `/api/license/*` | Status, activate, limits |

```bash
# Example: health check
curl http://localhost:5000/api/health

# Example: login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your-user","password":"your-password"}'
```

---

## Deployment

Mertis is designed for **self-hosted** installs on EC2, VPS, or on-prem.

### Checklist

- [ ] Strong `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] MySQL or PostgreSQL (not CSV) for production
- [ ] `DEFAULT_STORAGE` = S3 or Azure (not local)
- [ ] `npm run build && NODE_ENV=production npm start`
- [ ] Reverse proxy with base path `/mertis`
- [ ] Activate license (or use Community limits)
- [ ] Back up database and object storage

### Nginx example (`/mertis` base path)

```nginx
server {
    listen 80;
    server_name bugs.example.com;

    location /mertis/ {
        proxy_pass http://127.0.0.1:5000/mertis/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Detailed guide: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

---

## Licensing

Mertis is source-available under the **Business Source License 1.1** — see
[LICENSE](LICENSE) for the terms and [LICENSING.md](LICENSING.md) for a plain-English
walkthrough. Community Edition is free for production use within the Additional Use
Grant: any number of instances, for your own internal operations, using the Community
capabilities, with no more than 5 user accounts, 3 projects and 250 bugs **per
instance**. Anything beyond that — more records, a reserved capability, or hosting
Mertis for third parties — needs a commercial licence.

The table below describes what each **supplied build** offers. It is a product
summary, not the legal terms; the grant in the `LICENSE` of the version you run is
what binds you.

| Tier | Users | Projects | Bugs | Highlights |
|------|-------|----------|------|------------|
| **Community** | 5 | 3 | 250 | Core tracking, Pulse boards, GitHub basic, data export |
| **Team** | 25 | 15 | 5,000 | S3 storage, REST API, custom fields |
| **Professional** | 500 | ∞ | ∞ | AI insights, advanced reporting, scheduled email, all storage backends |
| **Business** | 2,000 | ∞ | ∞ | Multi-instance, audit logs, advanced permissions |

Counts are per instance — one production deployment sharing one database or CSV
storage directory. Extra processes or a failover replica of that deployment are not
extra instances.

Agency, Enterprise, Enterprise Plus and Managed Cloud are contract tiers —
contact <sales@turneratech.com>.

**Getting a Community key:** register at
[mertis.turneratech.com](https://mertis.turneratech.com/). A key (`TT-XXXX-XXXX-XXXX-XXXX`)
is emailed to you. Paste it into the setup wizard, or later into
**Admin → Deployment → License**. This server exchanges it once with
[license.turneratech.com](https://license.turneratech.com) for a signed licence,
then verifies it **offline** from then on.

A key binds to one installation. To move it, use **Release this install** first.

**Air-gapped?** Paste a signed licence token (`eyJ…`) instead — it is verified
locally and never contacts the licence server.

---

## Security

| Priority | Action |
|----------|--------|
| Critical | Set a unique `JWT_SECRET` before exposing the instance |
| Critical | Leave `MERTIS_DEV_DEFAULTS` unset outside development — it seeds a known password |
| High | Use HTTPS (TLS termination at Nginx / load balancer) |
| High | Restrict database and S3 credentials via env vars, not commits |
| Medium | Keep dependencies updated (`npm audit`) |

---

## Development scripts

| Command | Description |
|---------|-------------|
| `npm run install-all` | Install root + client dependencies |
| `npm run dev` | Server (nodemon :5000) + client (:3000) |
| `npm run server` | Backend only |
| `npm run client` | Frontend only |
| `npm run build` | Production React build → `client/build` |
| `npm start` | Run server (serves build when `NODE_ENV=production`) |
| `npm run db:init` | Apply MySQL schema (`server/database/mantis.sql`) |

---

## Contributing

1. Fork the repository  
2. Create a branch: `git checkout -b feature/my-feature`  
3. Commit with clear messages  
4. Open a Pull Request  

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## Support

| | |
|---|---|
| **Deployment docs** | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| **Issues** | [GitHub Issues](https://github.com/turneratech/mertis/issues) |
| **License keys** | [turneratech.com](https://turneratech.com) |
| **Email** | support@turneratech.com |

---

## License

Business Source License 1.1 — see [LICENSE](LICENSE) and [LICENSING.md](LICENSING.md).

---

<p align="center">
  <img src="./imgs/logo_tiny.png" alt="Mertis" width="32">
  <br>
  Made with care by <a href="https://turneratech.com">Turnera Tech</a>
</p>
