/**
 * The names the white-label guard sweeps for, kept out of the source.
 *
 * The guard used to carry its customers' names as literals, which meant the
 * test protecting us from publishing them was itself publishing them. They now
 * come from outside the repository:
 *
 *   MERTIS_WHITELABEL_NAMES=acme,acme industries   (comma separated)
 *   or server/tests/fixtures/customer-names.local.json  (gitignored)
 *
 * With neither present the sweep still runs against the built-in patterns
 * below, which catch the shapes a customer name takes in this codebase without
 * naming anyone: a licensee fallback, a hard-coded organisation, a company
 * constant. A missing fixture weakens the sweep; it must never silently pass.
 */
const fs = require('fs');
const path = require('path');

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'customer-names.local.json');

/** Shapes that are wrong whoever the customer is. */
const STRUCTURAL = [
  /licensee\s*[:=]\s*['"][A-Z][\w .&-]{2,}['"]/,
  /company(?:Name)?\s*[:=]\s*['"][A-Z][\w .&-]{2,}['"]/,
  /organi[sz]ationName\s*[:=]\s*['"][A-Z][\w .&-]{2,}['"]/
];

const fromEnv = () =>
  (process.env.MERTIS_WHITELABEL_NAMES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const fromFixture = () => {
  try {
    const raw = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    return Array.isArray(raw) ? raw.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @returns {{patterns: RegExp[], named: number, source: string}}
 */
const customerPatterns = () => {
  const names = [...new Set([...fromEnv(), ...fromFixture()])];
  const patterns = names.map((n) => new RegExp(escape(n), 'i')).concat(STRUCTURAL);
  const source = names.length
    ? (fromEnv().length ? 'MERTIS_WHITELABEL_NAMES' : 'fixtures/customer-names.local.json')
    : 'structural patterns only';
  return { patterns, named: names.length, source };
};

module.exports = { customerPatterns, STRUCTURAL, FIXTURE };
