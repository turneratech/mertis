const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { customerPatterns } = require('../helpers/customerNames');

const clientSrc = path.join(__dirname, '../../../client/src');
// The names live outside the repository: a test that protects us from
// publishing a customer's name must not publish it itself.
const { patterns: CUSTOMER_PATTERNS } = customerPatterns();
const containsCustomer = (text) => CUSTOMER_PATTERNS.some((re) => re.test(text));

describe('white-label confidentiality copy', () => {
  it('uses the customer organization name, not a vendor default', () => {
    const branding = fs.readFileSync(path.join(clientSrc, 'config/branding.js'), 'utf8');
    const footer = fs.readFileSync(path.join(clientSrc, 'components/Footer.js'), 'utf8');
    const login = fs.readFileSync(path.join(clientSrc, 'components/Login.js'), 'utf8');

    assert.doesNotMatch(branding, /Turnera Tech Private Limited/);
    assert.ok(!containsCustomer(branding), 'branding names a customer');
    assert.match(footer, /organizationName/);
    assert.match(login, /organizationName/);
    assert.doesNotMatch(footer, /Turnera Tech Private Limited/);
    assert.doesNotMatch(login, /Turnera Tech Private Limited/);
    assert.ok(!containsCustomer(footer), 'footer names a customer');
    assert.ok(!containsCustomer(login), 'login names a customer');
  });
});

describe('confidentiality notice is white-label', () => {
  it('omits the clause when no organization is configured', () => {
    const previous = process.env.MERTIS_ORGANIZATION_NAME;
    delete process.env.MERTIS_ORGANIZATION_NAME;
    try {
      const { getConfidentialityNotice } = require('../../config/organization');
      const notice = getConfidentialityNotice();
      // "proprietary information of this organization" reads like an unfilled
      // template on a document the customer sends to their own client.
      assert.doesNotMatch(notice, /this organization/i);
      assert.doesNotMatch(notice, /of\s*$/);
      assert.match(notice, /CONFIDENTIAL/);
    } finally {
      if (previous === undefined) delete process.env.MERTIS_ORGANIZATION_NAME;
      else process.env.MERTIS_ORGANIZATION_NAME = previous;
    }
  });

  it('names the organization when one is configured', () => {
    // Pass the name in rather than relying on whatever this machine has in
    // deployment.local.json -- the previous version of this test failed once a
    // real install wrote an organisation name to disk.
    const { getConfidentialityNotice } = require('../../config/organization');
    assert.match(getConfidentialityNotice('Acme Corporation'), /of Acme Corporation$/);
    assert.match(getConfidentialityNotice(''), /CONFIDENTIAL/);
    assert.doesNotMatch(getConfidentialityNotice(''), /this organization/i);
  });

  it('no customer name is hard-coded in the footer copy', () => {
    const footer = fs.readFileSync(path.join(clientSrc, 'components/Footer.js'), 'utf8');
    assert.ok(!containsCustomer(footer), 'footer names a customer');
    assert.match(footer, /configured/, 'footer must branch on whether a name is set');
  });
});

/**
 * @verifies VER-WL-001 … VER-WL-002
 *
 * `getBypassStatus()` fell back to a literal customer name for both licensee
 * and company, and the startup banner named that customer too. The repo is
 * going public under BSL and the product is sold white-label, so no customer
 * identifier may survive in shipped code — these assertions sweep the whole
 * server tree rather than the two files we happened to notice.
 */
describe('no customer identifier ships in server code [VER-WL]', () => {
  const serverRoot = path.join(__dirname, '../..');
  // Live customer config and the delta docs are excluded from git and the
  // image already; tests keep their fixtures.
  const SKIP = /node_modules|\/tests\/|\.min\.js$|\/data\/|\.env/;
  const CUSTOMER = { test: (text) => containsCustomer(text) };

  const walk = (dir, out = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (SKIP.test(full.split(path.sep).join('/') + (entry.isDirectory() ? '/' : ''))) continue;
      if (entry.isDirectory()) walk(full, out);
      else if (/\.(js|sql|json)$/.test(entry.name)) out.push(full);
    }
    return out;
  };

  it('VER-WL-001: no customer name anywhere in shipped server code', () => {
    const offenders = walk(serverRoot)
      .filter((f) => CUSTOMER.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(serverRoot, f));
    assert.deepEqual(offenders, [], `customer identifier found in: ${offenders.join(', ')}`);
  });

  it('VER-WL-002: a waived instance names no one unless its operator does', () => {
    const previous = process.env.MERTIS_ORGANIZATION_NAME;
    delete process.env.MERTIS_ORGANIZATION_NAME;
    try {
      delete require.cache[require.resolve('../../config/instance.config')];
      const instanceConfig = require('../../config/instance.config');
      assert.equal(instanceConfig.licensee, null, 'no default licensee');
      assert.equal(instanceConfig.company, null, 'no default company');
    } finally {
      if (previous === undefined) delete process.env.MERTIS_ORGANIZATION_NAME;
      else process.env.MERTIS_ORGANIZATION_NAME = previous;
      delete require.cache[require.resolve('../../config/instance.config')];
    }
  });
});
