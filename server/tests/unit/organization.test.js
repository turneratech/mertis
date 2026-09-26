const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  FALLBACK_DISPLAY,
  resolveOrganizationName,
  normalizeOrganizationName
} = require('../../config/organization');

describe('organization name (white-label)', () => {
  it('prefers saved local name over env and licensee', () => {
    assert.equal(
      resolveOrganizationName({
        localName: '  Acme Energy  ',
        envName: 'Env Co',
        licensee: 'Licensee Co'
      }),
      'Acme Energy'
    );
  });

  it('falls back to env then licensee, never Turnera Tech', () => {
    assert.equal(
      resolveOrganizationName({ envName: 'Northwind Robotics Ltd' }),
      'Northwind Robotics Ltd'
    );
    assert.equal(resolveOrganizationName({ licensee: 'Northwind' }), 'Northwind');
    assert.equal(resolveOrganizationName({}), '');
    assert.doesNotMatch(FALLBACK_DISPLAY, /Turnera Tech/i);
  });

  it('rejects empty names', () => {
    assert.throws(() => normalizeOrganizationName('  '), /required/);
  });
});
