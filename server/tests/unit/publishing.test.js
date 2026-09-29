const { describe, it } = require('node:test');
const assert = require('node:assert');

const { FORBIDDEN, INTERNAL } = require('../../../scripts/publish');

/**
 * @verifies VER-PUB-001 … VER-PUB-002
 *
 * The publisher's scan is the last thing standing between the private tree and a
 * public repository, and a scan that matches nothing reports the same "clean" as
 * a scan that matches everything. It did: the word-boundary patterns were built
 * from plain JS strings, where a backslash-b is the backspace character, so they
 * never matched and a file naming the private notes passed.
 *
 * Every pattern is therefore checked against something it must catch and
 * something it must not.
 */
describe('public tree guards [VER-PUB]', () => {
  const NOTES = ['priv', '_docs'].join('');

  // Every fixture is assembled at run time. This file ships in the public tree,
  // so a name or a key written out here would be exactly the thing the scan
  // exists to stop — and the scan would refuse to publish over its own test.
  const j = (...parts) => parts.join('');
  const ACRONYM = j('GO', 'TS');
  const SPONSOR = j('green', 'field');
  const TEST_ORG = j('ank', 'ush');
  const KEY_HEADER = j('-----BEGIN EC PRIVATE ', 'KEY-----');
  const REAL_LICENCE = j('TT-', '9F2K-', 'B7QD-', 'MRE7-', 'UGS7');

  const cases = [
    ['the sponsor by acronym', [`deployed for ${ACRONYM} last week`, ACRONYM.toLowerCase()],
      [`er${ACRONYM.toLowerCase()} in the field`, `big${ACRONYM.toLowerCase()}tance`]],
    ['the sponsor by name', [`a ${SPONSOR} install`], ['a green field']],
    ['the local test organisation', [`${TEST_ORG} test org`], ['anchor']],
    ['a private key', [KEY_HEADER], ['-----BEGIN CERTIFICATE-----']],
    ['an Azure account key', [`AccountKey=${'A'.repeat(40)}`], ['AccountKey=xxx']],
    ['an OpenAI key', [j('sk-', 'a'.repeat(32))], [j('ask-', 'a'.repeat(32)), 'sk-short']],
    ['a licence key', [REAL_LICENCE], ['TT-XXXX-XXXX-XXXX-XXXX', 'TT-ABCD-EFGH-IJKL-MNOP']],
    ['a pointer into the private notes', [`see ../${NOTES}/launch-todos.md`], ['deprivation_docsearch']],
    ['an assistant attribution trailer',
      [j('Co-authored', '-by: A N Other <a@example.com>')],
      ['co authored by the team', 'authored-by nobody']],
    ['an assistant sandbox path',
      [j('/home/', 'clau', 'de/mertis-backend/attachments.js')],
      [j('/home/', 'clau', 'dia/notes.md'), '/home/ubuntu/mertis']],
    ['an assistant account address',
      [j('cursor', 'agent@', 'cursor.com')],
      ['cursor-agent.md', 'agent@example.com']]
  ];

  it('VER-PUB-001: every forbidden pattern matches what it is for, and not what it is not', () => {
    assert.equal(FORBIDDEN.length, cases.length,
      'a pattern was added or removed without a case here');

    for (const [what, hits, misses] of cases) {
      const entry = FORBIDDEN.find(([, label]) => label === what);
      assert.ok(entry, `no pattern labelled '${what}'`);
      const [pattern] = entry;
      for (const text of hits) {
        assert.ok(pattern.test(text), `'${what}' failed to catch: ${text}`);
      }
      for (const text of misses) {
        assert.ok(!pattern.test(text), `'${what}' wrongly caught: ${text}`);
      }
    }
  });

  it('VER-PUB-002: the pattern list holds no literal it exists to catch', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, '../../../scripts/publish.js'), 'utf8');

    // Assembled from parts on purpose: this file ships, so a name written out
    // here would either be public or uncatchable.
    for (const literal of [ACRONYM, SPONSOR, TEST_ORG, NOTES]) {
      assert.ok(!source.includes(literal),
        `scripts/publish.js spells '${literal}' in full — the scan will refuse on itself`);
    }
    assert.ok(source.indexOf(String.fromCharCode(8)) === -1,
      'a backspace character is in the source: a word-boundary escape was written in a plain string');
    assert.ok(Array.isArray(INTERNAL) && INTERNAL.length > 0, 'the internal list is empty');
  });
});
