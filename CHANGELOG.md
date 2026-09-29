# Changelog

All notable changes to Mertis are recorded here. This project follows
[Semantic Versioning](https://semver.org/): the **2.x** line is current.

Mertis is source-available under the Business Source License 1.1 — see
[LICENSE](LICENSE) and [LICENSING.md](LICENSING.md).

## [Unreleased]

## [2.2.0] — 2026-10-01

A licensing release. No application behaviour changes; what changes is what the
licence actually permits, and whether the customer-facing pages say the same thing.

### Changed
- **Additional Use Grant rewritten.** The grant now reserves production
  *capabilities* instead of forbidding source edits. It permits any number of
  instances for your own internal operations, defines what an Instance, User
  Account, Project and Bug are for counting, allows employees and contractors to
  use an instance on your behalf, and states plainly that providing Mertis as a
  hosted or managed service needs a commercial licence. Counts remain 5 accounts,
  3 projects and 250 bugs per instance.
- **Expiry is now a written permission, not just product behaviour.** When a
  commercial licence lapses or its scope shrinks, records created while it was in
  effect stay readable, editable and exportable even over the limits; new records
  follow the Community limit for their own record type.
- **Change Date is a literal date.** `2030-10-01`, replacing "four years from the
  date each version is first published". BSL's own four-year anniversary rule still
  applies to each version independently.
- **`LICENSING.md` and the README licensing section reconciled with `LICENSE`.**
  The tier table is now labelled as a description of the supplied build rather than
  as the legal terms, instance counting is explained the same way in both, and
  "free ... forever" is replaced by a description of this version's permission.

### Removed
- **The blanket anti-circumvention paragraph.** Forbidding modification of the
  licence checks conflicted with BSL 1.1's own grant of modification and
  redistribution rights, and with the Licensor's covenant not to restrict them. The
  grant's scope now applies whether the checks are present or not: modifying a build
  does not enlarge what you may do in production with it.
- **The "1 webhook" Community claim** from the customer-facing limits table. The
  field exists in `server/config/features.js` but no create path enforces it, so
  advertising it as a limit was not accurate.

### Notes
- These terms apply to 2.2.0 onward. Copies of 2.1.0 and earlier keep the terms
  they were distributed with; nothing here is applied retroactively.
- The grant was reviewed before release. The reserved-capability list is the
  licence's own; where the shipped build gates less than the licence reserves,
  the licence governs.

## [2.1.0] — 2026-09-28

Renamed the product, opened the source, and closed the ways an internal document
could leave with a release.

### Added
- **Calendar on My Pulse.** A person connects up to five published iCal links
  (Outlook publish, Google secret address, Apple) and sees the next seven days of
  busy time beside the work that is due, so a due date can be read against a real
  day. Any signed-in user can look up when a colleague is busy — that is the
  scheduling point — but meeting titles, feed URLs and due-date conflicts stay
  with the owner. Links must be public https: private and link-local addresses are
  refused before the request and again after DNS, redirects are not followed, and
  the fetch is capped at 8 seconds and 1 MB. Busy time is never written onto a bug.
- **`npm run package`** — builds one release folder per offering from a single
  source tree (`npm run package -- --all`, or `--offering=team`). Each folder
  carries the same application payload and differs only in its `.env.example`
  preset, a generated `QUICKSTART.md` and `OFFERING.json`. The quickstart reads
  limits and features out of the code at build time and marks anything the
  routes do not actually enforce as *declared only*, so a bundle cannot promise
  more than the app delivers. No licence key is ever packaged: keys are issued
  per customer and bound to one machine.

- **Data export.** `GET /api/export` returns the whole instance as JSON or one
  project as CSV, admin only, through the storage abstraction on every backend.
  There is no licence gate on it: getting your data out is not a paid feature.
- **`scripts/publish.js`** — generates the public source tree instead of forking
  the private one, one squashed commit per release, and refuses to write a tree
  containing a customer name, a private key, a cloud credential, a real licence
  key or a pointer into our internal notes.

### Changed
- **The product is now Mertis, not Mantis.** 491 occurrences across 93 files,
  including `LICENSE`. Every `MANTIS_*` environment variable keeps working:
  `server/config/envAliases.js` maps the ten of them both ways and warns once per
  process, so no install in the field breaks on upgrade. Rename them in your
  `.env` at your convenience.
- The client subdirectory deployment path moved from `/mantis` to `/mertis`, and
  the API is mounted at both `/api/*` and `/mertis/api/*`.

### Fixed
- **Tier limits could be exceeded by simultaneous creates.** The limit check counted
  existing rows and then let the request insert, so requests that arrived together all
  read the same count and all committed — twenty parallel creates at 249 of 250 bugs
  produced 269. A double-click was enough; no tampering was needed. Users, projects and
  bugs now hold a lock from the count until the response is sent.
- **An admin could not open a bug on a CSV install.** Bug detail fetched activity
  row ids with a raw MySQL query, and CSV has no pool, so it returned 500. CSV is
  the default and the wizard's first account is the godmode owner, which means on
  a default install the owner could not open a single bug. Comment delete had the
  same shape and now answers 501 with a reason.

### Security
- **No customer name can ship in the product.** A waived instance fell back to a
  hard-coded organisation name for its licensee, its startup banner and one migration
  filename. All three are removed: the only source of an organisation name is the
  operator's own `MERTIS_ORGANIZATION_NAME`, and a test greps the whole server tree on
  every run to keep it that way.
- **No release bundle can carry an internal document.** Bundles were shipping the
  counsel brief — registered office, company identifiers and our position on every
  open licensing question — along with the agent caches and their pointers into
  our internal notes. One list now decides what is ours, shared by the packager
  and the publisher, and the tests fail a bundle that breaks it.
- **No bundle preset seeds a default administrator.** The generated
  `.env.example` copied the developer's own file, so every bundle of every tier
  told its installer to run in development with dev defaults on: the same
  `admin`/`admin123` in every install, no setup wizard, and a first account that
  was not the godmode owner. The preset now ships production defaults with the
  setting commented and the reason stated.

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
