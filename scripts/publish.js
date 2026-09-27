#!/usr/bin/env node
/**
 * Build the public source tree.
 *
 * The private repository keeps the whole engineering record: internal caches,
 * ops notes, the lawyer brief, and 88 commits that mention the sponsor by name
 * in ten of them. None of that can be published, and rewriting history to
 * remove it would break every hash. So the public repository is generated
 * rather than forked, one squashed commit per release, with nothing behind it.
 *
 *   node scripts/publish.js --out ../mertis-public
 *   node scripts/publish.js --out ../mertis-public --dry
 *
 * What ships is the packager's payload - the same file list every customer
 * bundle already contains, built from `git ls-files` so nothing untracked can
 * ride along - minus the internal documents listed below, plus the tests.
 *
 * The scan at the end is not decoration. It refuses to write a tree that
 * contains a customer name or anything shaped like a credential.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { collectPayload, INTERNAL_DOCS } = require('./package');

const root = path.join(__dirname, '..');

/**
 * Internal by nature: agent caches, planning, counsel papers. The list lives in
 * the packager, so a customer bundle and the public tree cannot disagree about
 * which documents are ours - they did, until SM-0067.
 */
const INTERNAL = INTERNAL_DOCS;

/** Tests are excluded from customer bundles but belong in a public repo: they
 *  are the most persuasive thing a sceptical self-hoster can read. */
const EXTRA = ['server/tests', '.github'];

const isInternal = (rel) => INTERNAL.some((rule) => rule.test(rel));

const tracked = () =>
  execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);

const collect = () => {
  const payload = collectPayload().filter((rel) => !isInternal(rel));
  const extras = tracked().filter(
    (rel) => EXTRA.some((dir) => rel === dir || rel.startsWith(`${dir}/`)) && !isInternal(rel)
  );
  return [...new Set([...payload, ...extras])].sort();
};

/**
 * Anything that must never reach a public tree. Each pattern has cost someone
 * a bad afternoon somewhere, which is why they are checked rather than assumed.
 */
// Assembled from pieces on purpose. Written out in full, each literal would sit
// in this file, and this file ships - so the scan below would refuse to publish
// over the very names it exists to catch, and a name it did not catch would be
// public. `join` keeps the pattern without keeping the string.
// String.raw, not a plain string: a \\b written in a plain JS string literal is
// the backspace character, so the pattern would never match a word boundary. That
// exact mistake shipped a scan that reported clean over a file naming the private
// notes. VER-PUB-001 now checks each pattern against the thing it is for.
const name = (...parts) => new RegExp(parts.join(''), 'i');

const FORBIDDEN = [
  [name(String.raw`\bGO`, String.raw`TS\b`), 'the sponsor by acronym'],
  [name('green', 'field'), 'the sponsor by name'],
  [name('ank', 'ush'), 'the local test organisation'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/AccountKey=(?!xxx)[A-Za-z0-9+/=]{20,}/, 'an Azure account key'],
  [/\bsk-[A-Za-z0-9]{20,}/, 'an OpenAI key'],
  // A real key, not the documented placeholders TT-XXXX-... or TT-ABCD-EFGH-...
  [/TT-(?!XXXX|ABCD)[A-Z0-9]{4}-(?!XXXX|EFGH)[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/, 'a licence key'],
  [name(String.raw`\bpriv`, String.raw`_docs\b`), 'a pointer into the private notes']
];

const TEXT = /\.(js|jsx|ts|tsx|json|md|yml|yaml|sql|sh|css|html|txt|example|env)$/i;

const scan = (files) => {
  const found = [];
  for (const rel of files) {
    if (!TEXT.test(rel)) continue;
    const body = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const [pattern, what] of FORBIDDEN) {
      const hit = body.match(pattern);
      if (hit) found.push({ rel, what, sample: hit[0].slice(0, 40) });
    }
  }
  return found;
};

const main = () => {
  const args = process.argv.slice(2);
  const outArg = args.find((a) => a.startsWith('--out'));
  const dry = args.includes('--dry');
  const out = outArg
    ? path.resolve(root, outArg.includes('=') ? outArg.split('=')[1] : args[args.indexOf(outArg) + 1])
    : path.join(root, '..', 'mertis-public');

  const files = collect();
  const problems = scan(files);

  console.log(`${files.length} files for the public tree`);
  const byTop = files.reduce((acc, rel) => {
    const top = rel.includes('/') ? rel.split('/')[0] : '(root)';
    acc[top] = (acc[top] || 0) + 1;
    return acc;
  }, {});
  for (const [top, n] of Object.entries(byTop).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${top}`);
  }

  if (problems.length) {
    console.error(`\nREFUSING TO WRITE. ${problems.length} problem(s):`);
    for (const p of problems.slice(0, 20)) {
      console.error(`  ${p.rel}: ${p.what} (${p.sample})`);
    }
    process.exit(1);
  }
  console.log('\nScan clean: no customer name, key or private-note pointer.');

  if (dry) {
    console.log('Dry run, nothing written.');
    return;
  }

  fs.rmSync(out, { recursive: true, force: true });
  for (const rel of files) {
    const dest = path.join(out, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, rel), dest);
  }

  // The private README points at the agent caches, which the public tree does
  // not carry. A link to a file that is not there reads as a missing file
  // rather than a deliberate omission, so the line goes.
  const readme = path.join(out, 'README.md');
  if (fs.existsSync(readme)) {
    const cleaned = fs.readFileSync(readme, 'utf8')
      .split('\n')
      .filter((line) => !/^Agent \/ ops notes:/.test(line))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(readme, cleaned);
  }
  console.log(`\nWritten to ${out}`);
  console.log('It is a plain directory. Commit it in one squashed commit, tag the release, push.');
};

if (require.main === module) main();

module.exports = { collect, scan, INTERNAL, FORBIDDEN };
