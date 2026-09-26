# Mertis Self-Hosted Deployment Guide

Mertis is designed as a **downloadable, licensable** bug tracker you host on your own infrastructure. Configure your database, file storage, and external integrations without vendor lock-in.

## Quick Start

```bash
git clone https://github.com/turneratech/mertis.git
cd mertis
cp .env.example .env
npm run install-all
cd hybrid-storage && npm install && cd ..

# Option A: Zero-config evaluation (CSV mode)
DATABASE_PROVIDER=csv npm run dev

# Option B: Production with MySQL
mysql -u root -p -e "CREATE DATABASE mertis;"
mysql -u root -p mertis < server/database/mantis.sql
mysql -u root -p mertis < server/database/license_schema.sql
mysql -u root -p mertis < server/database/deployment_schema.sql
npm run dev
```

Activate your licence at **Admin → Deployment → License**. Community Edition is free but still needs a key: register at turneratech.com and paste the `TT-` key you are emailed.

## Database Options

| Provider | Use Case | Configuration |
|----------|----------|---------------|
| **auto** (default) | Try MySQL, fall back to CSV | `DB_*` env vars |
| **mysql** | Self-hosted, RDS, Azure MySQL, PlanetScale | `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` |
| **supabase** | Supabase hosted Postgres | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` |
| **postgres** | Any PostgreSQL (Neon, Railway, self-hosted) | `DATABASE_URL=postgresql://...` |
| **csv** | Evaluation / air-gapped demo | `DATABASE_PROVIDER=csv` |

### Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run `server/database/mantis.postgres.sql` in the SQL Editor (when available) or use MySQL externally
3. Set env vars:
   ```env
   DATABASE_PROVIDER=supabase
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
4. Test connection in **Admin → Deployment**

> **Note:** PostgreSQL/Supabase is fully supported as a data backend. Apply `server/database/mantis.postgres.sql` in the Supabase SQL editor or via `psql $DATABASE_URL -f server/database/mantis.postgres.sql`, then set `DATABASE_PROVIDER=supabase` or `postgres`.

### Syncing to Your Own Database (Webhooks)

If you need data in a custom database (Snowflake, MongoDB, internal ERP), use **outbound webhooks**:

1. Go to **Admin → Deployment → Webhooks**
2. Add your endpoint URL and select events (`bug.created`, `bug.updated`, etc.)
3. Verify with **Test Webhook**
4. Your middleware receives signed JSON payloads and writes to your DB

Payload format:
```json
{
  "event": "bug.created",
  "timestamp": "2026-06-13T12:00:00.000Z",
  "data": { "bug": { "bugId": "SM-0001", "title": "..." }, "projectKey": "SM" }
}
```

Verify signatures with header `X-Mertis-Signature` (HMAC-SHA256 of body using `WEBHOOK_SECRET`).

### Custom Plugins

Drop JavaScript files in `server/plugins/`:

```javascript
module.exports = {
  name: 'my-crm-sync',
  description: 'Push bugs to internal CRM',
  async onEvent(event, data) {
    if (event === 'bug.created') {
      await fetch('https://internal-api.example/bugs', { method: 'POST', body: JSON.stringify(data) });
    }
  }
};
```

See `server/plugins/example.plugin.js`.

## File Storage Options

| Provider | Configuration |
|----------|---------------|
| **local** | Default — files in `uploads/` |
| **s3** | `S3_BUCKET`, `AWS_*`, optional `S3_ENDPOINT` for MinIO |
| **azure** | `AZURE_STORAGE_CONNECTION_STRING` or account+key |
| **sharepoint** | `AZURE_CLIENT_ID`, `SHAREPOINT_SITE`, etc. |
| **supabase** | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (S3-compatible storage API) |

Set `DEFAULT_STORAGE=s3|azure|sharepoint|local`.

Install hybrid-storage dependencies:
```bash
cd hybrid-storage && npm install
```

## Admin UI Configuration

**Admin → Deployment** (godmode can save; admins can test):

- **Database** — provider selection, connection test
- **Storage** — default provider, connection test (upload/delete probe)
- **Webhooks** — register external endpoints
- **Plugins** — list loaded server plugins

Settings are saved to `server/data/deployment.local.json` (gitignored). Env vars take precedence for secrets in production.

## Licensing Tiers

| Tier | Users | Projects | Highlights |
|------|-------|----------|------------|
| Community | 5 | 3 | Core bug tracking, GitHub basic |
| Professional | Unlimited | Unlimited | AI, reports, API, S3/Azure storage |
| Enterprise | Unlimited | Unlimited | SSO, audit logs, webhooks, white-label |
| Cloud | Per-user | Unlimited | Managed hosting by Turnera Tech |

Activate keys at **Admin → Deployment → License** or via `POST /api/license/activate`. Accepts a `TT-` key from [license.turneratech.com](https://license.turneratech.com) (exchanged server-side, once) or a pre-signed token for air-gapped installs.

## First-Run Setup (Self-Hosted)

On a fresh install (production), open **`/mertis/setup`** — no login required:

1. **Create administrator** — local account on your server (not turneratech.com)
2. **Database** — MySQL, PostgreSQL, Supabase, or CSV (eval)
3. **Storage** — local, S3, or Azure
4. **Licence** — paste the `TT-` key emailed after registering at turneratech.com (free for Community), or a signed token if this server has no internet access

The instance ID shown in the wizard is for support requests.

Development mode (`NODE_ENV=development` or `MERTIS_DEV_DEFAULTS=true`) still seeds `admin` / `admin123` for local testing.

## Production Checklist

- [ ] Set strong `JWT_SECRET`
- [ ] Configure MySQL with SSL (`DB_SSL=true`)
- [ ] Set `DEFAULT_STORAGE` to S3 or Azure (not local)
- [ ] Activate license key
- [ ] Run `npm run build && npm start`
- [ ] Configure Nginx reverse proxy at `/mertis`
- [ ] Set up webhook endpoints for your data warehouse
- [ ] Back up MySQL and object storage regularly

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/deployment/status` | Current deployment config (admin) |
| POST | `/api/deployment/settings` | Save settings (godmode) |
| POST | `/api/deployment/test/database` | Test DB connection |
| POST | `/api/deployment/test/storage` | Test file storage |
| POST | `/api/deployment/test/webhook` | Test webhook URL |
| GET | `/api/deployment/plugins` | List loaded plugins |
| GET | `/api/health` | Runtime health + storage providers |

## Support

- Documentation: [GitHub Wiki](https://github.com/turneratech/mertis/wiki)
- License keys: [turneratech.com](https://turneratech.com)
