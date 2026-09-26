# Changelog

All notable changes to Mertis are recorded here. This project follows
[Semantic Versioning](https://semver.org/): the **2.x** line is current.

Mertis is source-available under the Business Source License 1.1 — see
[LICENSE](LICENSE) and [LICENSING.md](LICENSING.md).

## [Unreleased]

### Added
- **`npm run package`** — builds one release folder per offering from a single
  source tree (`npm run package -- --all`, or `--offering=team`). Each folder
  carries the same application payload and differs only in its `.env.example`
  preset, a generated `QUICKSTART.md` and `OFFERING.json`. The quickstart reads
  limits and features out of the code at build time and marks anything the
  routes do not actually enforce as *declared only*, so a bundle cannot promise
  more than the app delivers. No licence key is ever packaged: keys are issued
  per customer and bound to one machine.

### Fixed
- **Tier limits could be exceeded by simultaneous creates.** The limit check counted
  existing rows and then let the request insert, so requests that arrived together all
  read the same count and all committed — twenty parallel creates at 249 of 250 bugs
  produced 269. A double-click was enough; no tampering was needed. Users, projects and
  bugs now hold a lock from the count until the response is sent.

### Security
- **No customer name can ship in the product.** A waived instance fell back to a
  hard-coded organisation name for its licensee, its startup banner and one migration
  filename. All three are removed: the only source of an organisation name is the
  operator's own `MERTIS_ORGANIZATION_NAME`, and a test greps the whole server tree on
  every run to keep it that way.

## [2.0.0] — 2026-09-23

First productised Community Edition release.

### Added
- **Licence activation against license.turneratech.com.** Register on the
  website, receive a `TT-XXXX-XXXX-XXXX-XXXX` key by email, and paste it into
  the setup wizard. Mertis exchanges it server-side for a signed ES256 token,
  then verifies that token **offline** — the licence server is contacted once
  at activation and never again for a licence to keep working.
- **Offline and air-gapped installs.** A signed licence token can be pasted
  directly, so an install with no outbound network never calls out at all.
- **Release this install** (Admin → Deployment → License), so a key can be
  moved to a new machine without contacting support.
- **Operator-supplied credentials.** S3, Azure Blob, SharePoint and OpenAI keys
  can now be set from Admin → Deployment instead of editing `.env` on the
  server. Secrets are never returned to the browser — you see a mask and the
  last four characters.
- **Docker packaging.** `Dockerfile` and `docker-compose.yml`, with MySQL.
  `server/data` must be on a persistent volume: it holds the instance id the
  licence is bound to.
- **Approaching-limit warnings** at 80% and 95% of a tier limit, including a
  bug counter that previously did not exist.
- `scripts/grant-godmode.js` — recovery path for a lost instance owner.

### Changed
- **The first account created in the setup wizard is now the God Mode owner.**
  Previously it was created as an admin, which left God Mode unreachable: only
  a God Mode user can change roles and nobody can change their own, so a
  self-hosted owner could not reset a colleague's password on their own server.
- **One God Mode account per instance.** Promoting someone transfers ownership
  and steps the current owner down to admin in the same operation.
- Relicensed from MIT to **BSL 1.1**. Community Edition remains free for
  production use within its limits (5 users, 3 projects, 250 bugs per instance).
- `LICENSE_PUBLIC_KEY` now **adds** trusted signing keys rather than replacing
  the keys pinned in the build, so rotating a key cannot silently un-trust the
  others.
- An install activated with a `TT-` key re-checks daily for a renewed expiry.
  Disable with `LICENSE_AUTO_REFRESH=false`. Verification itself is always
  offline; offline-token and Community installs never call out.

### Fixed
- **A Community licence granted unlimited users and projects on MySQL and
  PostgreSQL.** Licence-server tokens carry no limit claims, so activation
  wrote `NULL` into the limit columns, and `NULL` was read as "unlimited".
  Entitlement is now resolved from the verified token rather than from
  database columns, which also means editing the `licenses` table no longer
  grants a higher tier. CSV installs were never affected.
- A licence token with no `tier` claim activated as **Professional** instead of
  Community.
- An expired licence lost its expiry date, so nothing could tell the user when
  it lapsed — and in CSV mode it dropped to Community with no grace period.
- Limit-reached prompts described **Priority Support** rather than the limit the
  user had actually hit, and the upgrade link led to the free signup form.
- The setup wizard reported "You're all set!" before saving anything.
- `POST /api/auth/register` accepted any `role` from the request body, so an
  admin could create a God Mode account.
- Docker images could include `.env` files from subdirectories.

### Security
- Licence verification tolerates 60s of clock skew and retains the payload of
  an expired token, so expiry can be reported rather than silently degrading.
- Setup can no longer be completed without a licence key outside development.

[2.0.0]: https://github.com/turneratech/mertis/releases/tag/v2.0.0-community
