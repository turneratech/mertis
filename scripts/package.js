#!/usr/bin/env node
/**
 * Release packager — one source tree, one output folder per offering.
 *
 * Eight offerings do not mean eight branches: every tier difference is data in
 * server/config/features.js plus a claim in the signed licence token. What does
 * differ per offering is the *bundle* a customer receives, so this builds that
 * bundle and nothing else.
 *
 * The app payload is byte-identical across every offering — VER-PKG-002 proves
 * it — so a fix never has to be made twice. Only the generated files differ:
 * .env.example, QUICKSTART.md and OFFERING.json.
 *
 *   npm run package -- --offering=team
 *   npm run package -- --all
 *   npm run package -- --all --out=build/out
 *
 * Output folders are build artifacts. Never edit one: edit the source and
 * rebuild, or the eight folders drift into the eight branches this design
 * exists to avoid.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const { TIERS, TIER_LIMITS, TIER_FEATURES } = require('../server/config/features');
const plans = require('../server/config/plans');

const MANIFEST_DIR = path.join(root, 'build/offerings');

// Everything a self-hosted install needs, and nothing that carries local state,
// secrets or build output. Mirrors .dockerignore in intent.
const INCLUDE = [
  'server', 'client', 'hybrid-storage', 'imgs', 'scripts', 'docs',
  'package.json', 'package-lock.json', 'Dockerfile', 'docker-compose.yml',
  'LICENSE', 'LICENSING.md', 'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md'
];

/**
 * Documents that are ours, not the customer's. One list, because the packager
 * and scripts/publish.js were each keeping their own and had already drifted:
 * the public tree excluded the agent caches while every customer bundle shipped
 * them, complete with their pointers into our private notes directory.
 *
 *  - the caches describe how we work, and point into the private notes
 *  - the lawyer brief carries the registered office, the CIN and our preferred
 *    answer to every open licensing question
 *  - HISTORY is the migrated transcript index; the pulse-* files are
 *    pre-implementation planning, superseded by the code
 *
 * LICENSE and LICENSING.md are not here: those are what a customer is owed.
 */
const INTERNAL_DOCS = [
  /(^|\/)docs\/PROJECT_CACHE\.md$/,
  /(^|\/)docs\/PULSE_CACHE\.md$/,
  /(^|\/)docs\/SITE_MAP\.md$/,
  /(^|\/)docs\/HISTORY\.md$/,
  /(^|\/)docs\/legal(\/|$)/,
  /(^|\/)docs\/mertis-pulse-/,
  /(^|\/)docs\/Claude outputs(\/|$)/,
  /(^|\/)docs\/Turneratech_Commit_Message_Guidelines\.pdf$/,
  /(^|\/)CLAUDE\.md$/,
  /^\.cursor(\/|$)/,
  /^\.claude(\/|$)/,
  /^build\/offerings(\/|$)/
];

const DENY = [
  // Stale minified forks of auth.js, bugs.js and license.js sit beside their
  // sources, are gitignored, and still contain pre-fix logic — the register
  // route that trusted a role from the body, among others. They must never
  // reach a customer.
  /\.min\.js$/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)dist(\/|$)/,
  /(^|\/)uploads(\/|$)/,
  /(^|\/)build(\/|$)/,          // client/build and this build/ directory
  /(^|\/)server\/data(\/|$)/,   // a live install's rows
  /(^|\/)server\/tests(\/|$)/,  // fixtures, not product
  /(^|\/)imgs\/screenshots(\/|$)/,
  ...INTERNAL_DOCS,
  /\.env($|\.)/,                // never ship anyone's credentials
  /\.log$/
];

const denied = (rel) => DENY.some((re) => re.test(rel));

const walk = (abs, rel, out = []) => {
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (denied(childRel)) continue;
    const childAbs = path.join(abs, entry.name);
    if (entry.isDirectory()) walk(childAbs, childRel, out);
    else if (entry.isFile()) out.push(childRel);
  }
  return out;
};

/**
 * Tracked files are the source of truth for what ships. Walking the disk would
 * also pick up whatever a developer happens to have lying around — the stale
 * *.min.js forks are the live example — so ask git first and fall back to a
 * walk only outside a checkout.
 */
const trackedFiles = () => {
  try {
    const { execFileSync } = require('child_process');
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    const files = out.toString('utf8').split('\0').filter(Boolean);
    return files.length ? files : null;
  } catch (error) {
    return null;
  }
};

const collectPayload = () => {
  const included = (rel) => INCLUDE.some((entry) => rel === entry || rel.startsWith(`${entry}/`));

  const tracked = trackedFiles();
  if (tracked) {
    return tracked.filter((rel) => included(rel) && !denied(rel)).sort();
  }

  const files = [];
  for (const entry of INCLUDE) {
    const abs = path.join(root, entry);
    if (!fs.existsSync(abs)) continue;
    if (denied(entry)) continue;
    if (fs.statSync(abs).isDirectory()) walk(abs, entry, files);
    else files.push(entry);
  }
  return files.sort();
};

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * What the app actually enforces, read from the source at build time rather
 * than asserted here. A generated QUICKSTART that claimed an unenforced limit
 * would be the marketing problem all over again, one directory closer to the
 * customer.
 */
const readEnforcement = () => {
  const featureGates = new Set();
  const limitGates = new Set();
  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) { scan(abs); continue; }
      if (!entry.name.endsWith('.js') || entry.name.endsWith('.min.js')) continue;
      const src = fs.readFileSync(abs, 'utf8');
      for (const m of src.matchAll(/requireFeature\(FEATURES\.([A-Z0-9_]+)\)/g)) {
        featureGates.add(m[1].toLowerCase());
      }
      for (const m of src.matchAll(/requireFeature\(['"]([a-z0-9_]+)['"]\)/g)) {
        featureGates.add(m[1]);
      }
      for (const m of src.matchAll(/checkLimit\(['"]([a-z]+)['"]\)/g)) {
        limitGates.add(m[1]);
      }
    }
  };
  scan(path.join(root, 'server/routes'));
  scan(path.join(root, 'server/pulse'));
  // Attachment size has its own middleware rather than checkLimit.
  if (fs.readFileSync(path.join(root, 'server/routes/attachments.js'), 'utf8').includes('enforceAttachmentSize')) {
    limitGates.add('attachmentSize');
  }
  return { featureGates, limitGates };
};

const LIMIT_LABELS = {
  maxUsers: ['users', 'Users'],
  maxProjects: ['projects', 'Projects'],
  maxBugs: ['bugs', 'Bugs'],
  maxAttachmentSizeMB: ['attachmentSize', 'Attachment size (MB)'],
  aiRequestsPerMonth: [null, 'AI requests per month'],
  maxWebhooks: [null, 'Webhooks'],
  maxInstances: [null, 'Instances']
};

const quickstart = (manifest, plan, enforcement) => {
  const limits = TIER_LIMITS[manifest.tier] || {};
  const features = TIER_FEATURES[manifest.tier] || [];
  const shown = (v) => (v === null || v === undefined ? 'unlimited' : String(v));

  const limitRows = Object.entries(LIMIT_LABELS).map(([key, [gate, label]]) => {
    const enforced = gate && enforcement.limitGates.has(gate);
    return `| ${label} | ${shown(limits[key])} | ${enforced ? 'enforced' : '**declared only**'} |`;
  });

  const featureRows = features.map((f) => {
    const enforced = enforcement.featureGates.has(f);
    return `| \`${f}\` | ${enforced ? 'gated in the API' : 'catalogue entry'} |`;
  });

  const envLines = Object.entries(manifest.env).map(([k, v]) => `${k}=${v}`);

  return `# Mertis — ${manifest.label}

${manifest.note}

This folder was generated by \`npm run package\`. Do not edit it: change the
source and rebuild, or this copy drifts away from the code it came from.

## Install

1. Copy \`.env.example\` to \`server/.env\` and fill in the blanks.
2. \`npm run install-all\`
3. \`npm run build && npm start\`, or \`docker compose up\` for the ${manifest.compose} stack.
4. Open the app and paste the licence key you were sent. Activation happens
   server-side; after that the token is verified offline and the licence keeps
   working with the licence server switched off.

No licence key ships in this bundle. Keys are issued per customer and bound to
one machine, so a baked-in key would be transferable and would break that bind.

## Limits at this tier

| Limit | Value | Status |
|---|---|---|
${limitRows.join('\n')}

"Declared only" means the number exists in the catalogue and nothing in the
app enforces it. It must not be sold as a guarantee.

## Features at this tier

| Feature | Status |
|---|---|
${featureRows.join('\n')}

"Catalogue entry" means the flag is set for this tier but no route checks it
yet. Both columns are read out of \`server/config/features.js\` and the route
sources at build time, so this table cannot over-claim on its own.

## Environment presets in this bundle

\`\`\`env
${envLines.join('\n')}
\`\`\`

${manifest.airgap
    ? 'This is an offline bundle: outbound licence traffic is disabled and no AI\nkey is set, so the install makes no network calls. The AI code is present but\ninert — it is not stripped from the payload.'
    : 'These are storage and database defaults only. Entitlement never comes from\nthe environment; it comes from the signed licence token.'}

## What differs between offerings

Only the three generated files: \`.env.example\`, \`QUICKSTART.md\` and
\`OFFERING.json\`. The application payload is byte-identical across all eight
bundles — \`SHA256SUMS\` proves it, and \`VER-PKG-002\` checks it on every run.
`;
};

// The developer's own .env.example runs in development and pre-seeds
// admin/admin123, which is what a developer wants and the opposite of what an
// install wants: copied verbatim it hands every bundle the same password and
// skips the setup wizard, so the first account is never the godmode owner.
// Neutralised here rather than in the source file, which stays convenient.
const NL = String.fromCharCode(10);
const INSTALL_SAFE = [
  [/^NODE_ENV=development\s*$/m, 'NODE_ENV=production'],
  [/^MERTIS_DEV_DEFAULTS=true\s*$/m, [
    '# Never enable on an install you rely on: it pre-seeds admin/admin123 and',
    '# skips the setup wizard, so your first account is not the godmode owner.',
    '# MERTIS_DEV_DEFAULTS=true'
  ].join(NL)]
];

const envExample = (manifest) => {
  let base = fs.existsSync(path.join(root, '.env.example'))
    ? fs.readFileSync(path.join(root, '.env.example'), 'utf8')
    : '';
  for (const [pattern, replacement] of INSTALL_SAFE) base = base.replace(pattern, replacement);
  const preset = Object.entries(manifest.env).map(([k, v]) => `${k}=${v}`).join('\n');
  return `# Mertis — ${manifest.label} preset
#
# Generated by npm run package. Storage and database defaults only: entitlement
# comes from the licence token, never from this file.

${preset}

# ---------------------------------------------------------------------------
# Everything below is the standard example, with the development-only
# NODE_ENV and dev-defaults lines made safe for an install.
# ---------------------------------------------------------------------------

${base}`;
};

const buildOne = (tier, payload, outRoot) => {
  const manifestPath = path.join(MANIFEST_DIR, `${tier}.json`);
  if (!fs.existsSync(manifestPath)) throw new Error(`No manifest for offering '${tier}' at build/offerings/${tier}.json`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Object.values(TIERS).includes(manifest.tier)) {
    throw new Error(`Manifest '${tier}' names a tier that does not exist in features.js: ${manifest.tier}`);
  }

  const dest = path.join(outRoot, tier);
  fs.rmSync(dest, { recursive: true, force: true });

  const hashes = [];
  for (const rel of payload) {
    const buf = fs.readFileSync(path.join(root, rel));
    const target = path.join(dest, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buf);
    hashes.push(`${sha256(buf)}  ${rel}`);
  }

  const payloadHash = sha256(Buffer.from(hashes.join('\n'), 'utf8'));
  const plan = plans.getPlan(manifest.tier) || null;
  const enforcement = readEnforcement();

  fs.writeFileSync(path.join(dest, 'SHA256SUMS'), `${hashes.join('\n')}\n`);
  fs.writeFileSync(path.join(dest, '.env.example'), envExample(manifest));
  fs.writeFileSync(path.join(dest, 'QUICKSTART.md'), quickstart(manifest, plan, enforcement));
  fs.writeFileSync(path.join(dest, 'OFFERING.json'), `${JSON.stringify({
    tier: manifest.tier,
    label: manifest.label,
    builtFrom: require('../package.json').version,
    airgap: manifest.airgap,
    compose: manifest.compose,
    env: manifest.env,
    payloadFiles: payload.length,
    payloadHash
  }, null, 2)}\n`);

  return { tier, dest, payloadHash, files: payload.length };
};

const main = () => {
  const args = process.argv.slice(2);
  const outArg = args.find((a) => a.startsWith('--out='));
  const outRoot = path.join(root, outArg ? outArg.split('=')[1] : 'dist');
  const all = args.includes('--all');
  const one = args.find((a) => a.startsWith('--offering='));

  if (!all && !one) {
    console.error('Usage: npm run package -- --offering=<tier> | --all [--out=dir]');
    console.error(`Offerings: ${Object.values(TIERS).join(', ')}`);
    process.exit(1);
  }

  const tiers = all ? Object.values(TIERS) : [one.split('=')[1]];
  const payload = collectPayload();

  console.log(`Packaging ${tiers.length} offering(s) from ${payload.length} payload files`);
  const results = tiers.map((t) => buildOne(t, payload, outRoot));

  const distinct = new Set(results.map((r) => r.payloadHash));
  for (const r of results) {
    console.log(`  ${r.tier.padEnd(16)} ${path.relative(root, r.dest)}  ${r.payloadHash.slice(0, 12)}`);
  }
  console.log(distinct.size === 1
    ? `\nOne payload, ${results.length} bundles. A fix ships to every offering at once.`
    : `\nWARNING: ${distinct.size} distinct payloads — the bundles have diverged.`);
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Packaging failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  INTERNAL_DOCS, collectPayload, buildOne, readEnforcement, MANIFEST_DIR };
