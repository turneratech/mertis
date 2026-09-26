# Mertis Verification Guide

Local test matrix for Mertis. Each row has a stable **ID** for automation traceability (CI, Playwright, etc.).

**Quick start**

```bash
npm run verify          # all automated tests (unit + integration)
npm run test:unit       # fast — no HTTP server
npm run test:integration # API tests against in-process Express
```

Requires Node 18+ (native `node:test` + `fetch`). No Jest or extra test runner needed.

---

## Automated tests

| ID | Area | What it checks | Command |
|----|------|----------------|---------|
| VER-LIC-001 … 010 | License / tiers | 8-tier catalog, limits, v1 JWT compat | `npm run test:unit` |
| VER-CONV-001 … 004 | Conversion surface | Approaching-limit thresholds (80% / 95%); warnings wired, not just declared; limit buttons name the limit rather than Priority Support; upgrade link avoids the free signup page | `npm run test:unit` |
| VER-LIC-016 … 019 | Licence SQL path | NULL limit columns stay capped; an edited tier column is ignored; rows without a token resolve to Community; suspended stays Community | `npm run test:unit` |
| VER-LIC-020 … 023 | Limit races | Concurrent creates cannot exceed a cap; the refusal names the limit; a wedged handler releases its lock on timeout; a failed check fails open without holding the lock | `npm run test:unit` |
| VER-EXP-001 … 005 | Data export | The whole instance exports as JSON and a project as CSV on every backend; no password or bcrypt hash appears in the payload; quotes in a title survive as doubled quotes; export is reachable on Community, so it is not behind a licence feature; anonymous and unsupported-format requests are refused clearly | `npm run test:integration` |
| VER-PKG-001 … 004 | Release packaging | Every tier has a manifest; all eight bundles share one byte-identical payload; no `.env`, live rows, uploads or fixtures reach a bundle; the generated quickstart claims only the limits and features the routes actually gate | `npm run test:unit` |
| VER-WL-001 … 002 | White-label | No customer identifier anywhere in shipped server code; a waived instance names no one unless its operator configures a name | `npm run test:unit` |
| VER-CFG-001 … 004 | Deployment secrets | Editing a sibling field keeps a stored secret; explicit values still overwrite; arrays replaced; no AI key ships by default | `npm run test:unit` |
| VER-LIC-011 … 015 | Licence server bridge | Tier-less licence-server payload resolves to Community; an expired token still returns its payload and expiry; grace window keeps the tier, past grace falls back to Community; `TT-` keys vs signed tokens | `npm run test:unit` |
| VER-DESC-001 … 008 | Rich descriptions | HTML sanitization, inline images, XSS strip | `npm run test:unit` |
| VER-AUTH-001 … 003 | Auth | JWT generation, middleware | `npm run test:unit` |
| VER-ATT-001 … 003 | Attachments queue | Pre-save file queue semantics | `npm run test:unit` |
| VER-API-001 | Health | `GET /api/health` | `npm run test:integration` |
| VER-API-002 … 003 | License API | Public status, auth-gated limits | `npm run test:integration` |
| VER-API-004 … 006 | Auth API | Login, authenticated limits | `npm run test:integration` |
| VER-PULSE-LINE | Pulse Line | Dwell, bottleneck, insufficient history, no-commit gap | `npm run test:unit` + `api.pulse.test.js` |
| VER-PULSE-TAX | Pulse quality tax | Mixed Bug/Feature sentence; untyped degrades, never 0% | `pulse.qualityTax.test.js` + `api.pulse.test.js` |
| VER-PULSE-INT | Pulse interrupt | 35% budget, 7-day Pit accepts vs committed IP, overflow words | `pulse.interrupt.test.js` + `api.pulse.test.js` |
| VER-PULSE-BRIEF | Pulse Friday brief | Clauses + evidence IDs; insufficient history does not invent dwell | `pulse.brief.test.js` + `api.pulse.test.js` |
| VER-PULSE-GRAV | Pulse reopen gravity | Closed→Reopened pip + module ranking; never assignee; English “Reopened” comment is 0 | `pulse.gravity.test.js` + `api.pulse.test.js` |
| VER-PULSE-KILL | Pulse kill switch | `PULSE_ENABLED=false` → 404 `/api/pulse/board`; Pulse folder does not import BugList | `pulse.killswitch.test.js` + `pulse.packaging.test.js` + `api.pulse.killswitch.test.js` |
| VER-PULSE-LEDGER | Pulse one ledger | Status-only PUT keeps title/module/type/assignee; Pit accept does not change status; untriaged stays off Strike | `api.pulse.test.js` |
| VER-PULSE-VIS | Pulse visibility | Non-member 403 on board/pit/brief/line; empty Pit; Closed not in Pit | `pulse.visibility.test.js` + `api.pulse.test.js` |
| VER-PULSE-GAP | Pulse fix–verify gap | Commit + QA Not Started counts; duplicates once; bots / no commits degrade, never invent 0 | `pulse.line.test.js` + `api.pulse.test.js` |
| VER-PULSE-ESC | Pulse escaped Production | Production Bug after last close; Testing is not escaped; untyped env / no close degrade, never 0 | `pulse.escaped.test.js` + `api.pulse.test.js` |
| VER-PULSE-CYC | Pulse named interrupt window | Optional from/to around the existing ring; 35% reserve cannot be eaten; zero accepts degrade; overflow in words | `pulse.interrupt.test.js` + `api.pulse.test.js` |
| VER-PULSE-MIS | Pulse Missions | Outcome set + gravity/tax of that set; unclaimed listed; delete unlinks bugs; one mission per bug | `pulse.missions.test.js` + `api.pulse.test.js` |
| VER-PULSE-DECK | Pulse Command Deck | `/pulse` is Deck when >1 project; one project skips to Strike; missing Line degrades | `pulse.deck.test.js` + `api.pulse.test.js` |
| VER-PULSE-HOR | Pulse Horizon | Mission-grain bars only; unclaimed bugs are not bars; no dates degrades | `pulse.horizon.test.js` + `api.pulse.test.js` |
| VER-PULSE-AI | Pulse AI Friday prose | Professional+ paragraph under arithmetic; missing key/tier hides prose; Copy brief stays numbers; a hung upstream times out rather than hanging `/brief`; identical clauses are served from cache; different numbers are a different entry; a transport blip retries once and a refusal never does; every failure returns the deterministic clauses untouched | `pulse.aiFriday.test.js` + `api.pulse.test.js` |
| VER-PULSE-ENGINE | Pulse reconstruction engine | One reconstruction per bug per request across metrics; a new `now` is never a stale hit; cache key includes storage type; fingerprint tracks content; TTL expiry and bounded size; Deck project cap and My Pulse truncation are stated in `meta.degraded`, never silent | `pulse.engine.test.js` + `api.pulse.test.js` |
| VER-PULSE-BACKENDS | Pulse cross-backend equivalence | Every projection (line, dwell, tax, interrupt, gravity, escaped, brief metrics, wait, replay, forecast samples, card) returns identical output from the CSV shape (`from`/`to`, ISO strings, `''`) and the SQL shape (`fromStatus`/`toStatus` aliases, `Date` objects, `null`); absent timestamp is untriaged in both; all three adapters implement the Pulse storage surface | `pulse.backends.test.js` |
| VER-PULSE-CON | Pulse Command Deck constellation | Deck rows carry structured `metrics` (open volume, tax %, escaped, reopen) that agree with the sentences; an uncomputable metric is `null`, never 0; metrics add no `degraded` noise to the clause contract | `pulse.constellation.test.js` |
| VER-PULSE-LENS | Pulse lenses | Named lenses filter the right field; unknown lens / missing value / bad vocabulary are 400, never a silent everything; `mine` is next-move-is-you; `stale` is 14d without REAL activity; q matches title or ID; summary always reports the unfiltered total for that surface; an empty match is empty, not degraded | `pulse.lenses.test.js` + `api.pulse.test.js` |
| VER-PULSE-WAIT | Pulse The Wait | ARB becomes a per-person queue ordered by oldest parked work, never by volume; a sink holds work and waits on nobody; a standoff is a real two-cycle, not two busy people; self-parking creates no edge; unresolved ARB names are counted, never dropped; Closed excluded; an unused ARB field degrades rather than claiming nobody waits; output never ranks people | `pulse.wait.test.js` + `api.pulse.test.js` |
| VER-PULSE-LAND | Pulse Landing (forecast) | Same mission forecasts the same date on every call (seeded PRNG); P85 never precedes P50; a higher measured reopen rate widens the band and pushes P85 later; spread is attributed to the module that actually bounces; below the sample floor it refuses and names how many more bugs it needs; a finished mission has already landed; only stations still ahead need history; interrupt load is context, never a second multiplier; display labels come from the server so sentence and legend cannot disagree | `pulse.forecast.test.js` + `api.pulse.test.js` |
| VER-PULSE-REPLAY | Pulse Replay | Board at T is the status in force at T; a bug created after T is absent, not Open; the history boundary outranks everything below it and is stated, never an empty board; bugs without structured history are excluded AND counted; duplicated webhook rows count once; change summary is arithmetic over the window; replaying now matches the live board; bad timestamp 400s and the future is clamped; rewound cards drop live-only claims (next move, truth clock) and cannot be dragged | `pulse.replay.test.js` + `api.pulse.test.js` |
| VER-PULSE-GATE | Pulse packaging | Community keeps the whole wedge (board, pit, line, wait, brief, me); Landing and Replay 403 with `feature`, `currentTier` and `upgradeRequired`; the Deck stays reachable on Community but withholds briefs so the single-project redirect still resolves; a paid tier gets Deck, Landing and Replay; the gate closes again after the waiver is lifted | `api.pulse.gating.test.js` |
| VER-PULSE-TIPS | Pulse tooltips | One delegated tooltip layer mounted once inside `.pulse-scope`; tips raise on hover (delayed) and on keyboard focus; auto-retire after ~2s; dismissed by Escape, leave, scroll and click; `aria-describedby` set and cleaned up; tips never swallow pointer events; every interactive surface carries `data-tip` | `pulse.interaction.test.js` |
| VER-PULSE-KEYS | Pulse keyboard model | Modifier keystrokes are never commands (Ctrl+A must not triage); contentEditable is not hijacked; no surface binds `keydown` outside `usePulseKeys` | `pulse.interaction.test.js` |
| VER-PULSE-TOUCH | Pulse pointer, touch and keyboard drag | Board uses dnd-kit pointer/touch/keyboard sensors, no HTML5 `dataTransfer`; no fixed-width mobile board; reduced-motion and focus-visible exist | `pulse.interaction.test.js` |
| VER-PULSE-HONEST | Pulse UI honesty | Horizon says "longest open mission", never "critical path" (no dependency edges exist); server config such as `PULSE_ENABLED` is never shown to end users | `pulse.interaction.test.js` |

### Pulse contract

Every new Pulse packet ships in the **same change**:

1. Unit file under `server/tests/unit/pulse.*.test.js` covering the happy path **and** named corners (empty, untyped, English-only history, overflow, kill switch).
2. At least one HTTP assertion in `server/tests/integration/api.pulse.test.js`.
3. A `VER-PULSE-*` row in this table. Put the ID in the `it('VER-PULSE-…')` title when adding tests.
4. Greyed/`degraded` responses are asserted (no invented numbers).

`npm run test:unit -- server/tests/unit/pulse*.test.js` plus `api.pulse.test.js` is the Pulse gate before starting the next milestone.

### Test layout

```
server/tests/
  helpers/
    bootstrap.js      # storage + license init for integration tests
    fixtures.js         # shared HTML / JWT samples
    httpClient.js       # fetch wrapper
  unit/                 # pure logic, no server listen
    tierCatalog.test.js
    sanitizeDescription.test.js
    auth.test.js
    pendingFilesQueue.test.js
  integration/          # in-process Express on random port
    api.health.test.js
    api.license.test.js
    api.auth.test.js
scripts/
  verify.js             # CI entrypoint (exit 0/1)
```

### CI (future)

```yaml
# .github/workflows/verify.yml (sketch)
- run: npm install
- run: npm run verify
  env:
    NODE_ENV: test
    MERTIS_DEV_DEFAULTS: true
    JWT_SECRET: ci-test-secret
```

Integration tests use **CSV storage** by default (no MySQL required). Set `DB_*` env vars to exercise MySQL/Postgres in a dedicated job later.

---

## Manual checklist (UI / E2E backlog)

Run with `npm run dev`, open http://localhost:3000/mertis, login `admin` / `admin123` (when `MERTIS_DEV_DEFAULTS=true`).

| ID | Feature | Steps | Expected |
|----|---------|-------|----------|
| VER-UI-001 | Rich description editor | New bug → Description field | Toolbar visible (B/I/U, lists, link) |
| VER-UI-002 | Paste image | Copy screenshot → Ctrl+V in description | Image appears inline; “Uploading image…” then thumbnail |
| VER-UI-003 | Drop image | Drag PNG into description | Same as paste |
| VER-UI-004 | Attach before save | New bug → Add Attachment (no save yet) | “N file(s) queued — will upload on save” |
| VER-UI-005 | Flush on save | Queue file + save bug | File in attachment list on edit page |
| VER-UI-006 | Doc link in description | Upload PDF with “Add link in description” checked | Clickable filename in description |
| VER-UI-007 | Description viewer | Open saved bug detail | HTML renders; inline images load |
| VER-UI-008 | Legacy plain text | View old bug with plain description | Newlines preserved, no broken HTML |
| VER-UI-009 | License badge | Navbar / header | Community tier badge visible |
| VER-UI-010 | Bug limit banner | Community + near 250 bugs | Upgrade/limit messaging (when applicable) |

Map manual IDs → future Playwright/Cypress specs using the same `VER-UI-*` names.

---

## Pre-release smoke (5 min)

1. `npm run verify` — all green  
2. `npm run dev` — app loads, login works  
3. VER-UI-002 + VER-UI-004 — paste image + queue attachment on new bug  
4. `GET /api/health` — `storage.connected: true`  
5. `GET /api/license/status` — `tier: community`, `limits.maxWebhooks: 1`

---

## Adding tests

1. Pick the next ID (`VER-XXX-NNN`) in this doc.  
2. Add a `node:test` file under `unit/` or `integration/`.  
3. Reference the ID in the test name: `it('VER-DESC-009: …', ...)`.  
4. Run `npm run verify` before opening a PR.

Server exports `{ app, startServer }` from `server/index.js` so integration tests can bind without starting production.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Integration auth fails | Ensure `MERTIS_DEV_DEFAULTS=true`; CSV must seed `admin` |
| Port in use | Integration uses port `0` (OS-assigned); no conflict |
| MySQL tests needed | Set `DB_*` and add a separate `integration/mysql/` suite later |
| Windows path errors | Run from repo root: `npm run verify` |
