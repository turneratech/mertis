const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('instance.config [licence waiver]', () => {
  it('defaults keep licensing on (product installs)', () => {
    const cfg = require('../../config/instance.config');
    assert.equal(cfg.skipLicenseChecks, false);
    assert.equal(cfg.skipSetupWizard, false);
    assert.equal(cfg.licenseTier, 'community');
  });
});
