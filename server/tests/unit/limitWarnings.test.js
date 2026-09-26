/**
 * @verifies VER-CONV-001 … VER-CONV-004
 *
 * Conversion surface. `LIMIT_WARNING_COPY` sat in the client config with zero
 * consumers and a comment saying "Stage 4 will consume" it — so a Community
 * user got no signal before the wall, and bugs had no counter at all until the
 * hard 403 at 250/250. These tests pin the threshold behaviour and the two
 * copy bugs that made the upgrade path misinform everyone who hit a cap.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const clientSrc = path.join(__dirname, '../../../client/src');
const read = (p) => fs.readFileSync(path.join(clientSrc, p), 'utf8');

// Mirrors getLimitWarning in LicenseContext, which cannot be required here
// (it is an ES module inside a React context).
const WARN = 0.8, CRITICAL = 0.95;
const warnLevel = (current, max) => {
  if (max === null || current === null || max <= 0) return null;
  const pct = current / max;
  if (pct < WARN) return null;
  const remaining = Math.max(max - current, 0);
  return remaining === 0 ? 'reached' : (pct >= CRITICAL ? 'critical' : 'warning');
};

describe('Limit warnings [VER-CONV]', () => {
  it('VER-CONV-001: warns approaching a limit, and not before', () => {
    assert.equal(warnLevel(3, 5), null, 'quiet well inside the limit');
    assert.equal(warnLevel(4, 5), 'warning', '80% of the Community user cap');
    assert.equal(warnLevel(5, 5), 'reached');

    // Bugs: the case with no signal at all before this change.
    assert.equal(warnLevel(199, 250), null);
    assert.equal(warnLevel(200, 250), 'warning');
    assert.equal(warnLevel(240, 250), 'critical');
    assert.equal(warnLevel(250, 250), 'reached');
  });

  it('VER-CONV-002: unlimited tiers never warn', () => {
    assert.equal(warnLevel(10000, null), null);
    assert.equal(warnLevel(null, 250), null, 'usage not loaded yet');
  });

  it('VER-CONV-003: the thresholds and copy are actually wired up', () => {
    const tiers = read('config/tiers.js');
    const ctx = read('contexts/LicenseContext.js');

    assert.match(tiers, /LIMIT_WARN_PCT/);
    assert.match(ctx, /LIMIT_WARNING_COPY/,
      'the copy map must be consumed, not just declared');
    assert.match(ctx, /getLimitWarning/);

    for (const f of ['components/BugForm.js', 'components/UserManagement.js', 'components/ProjectList.js']) {
      assert.match(read(f), /getLimitWarning/, `${f} must surface the warning`);
    }
  });

  it('VER-CONV-004: limit buttons describe the limit, not Priority Support', () => {
    // Every count-limit button used to pass 'priority_support', so hitting the
    // user cap produced a modal about Priority Support.
    for (const f of ['components/UserManagement.js', 'components/ProjectList.js',
                     'components/ProjectForm.js', 'components/BugForm.js']) {
      const src = read(f);
      assert.doesNotMatch(src, /promptUpgrade\('priority_support'\)/,
        `${f} must not describe a count limit as a feature`);
      assert.match(src, /promptLimitUpgrade\('(users|projects|bugs)'\)/, f);
    }

    // And the upgrade link must not lead to the free signup form.
    assert.match(read('config/tiers.js'), /portalCheckoutUrl = \(\) => pricingUrl\(\)/);
  });
});
