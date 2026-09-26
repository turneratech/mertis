/**
 * @verifies VER-ROLE-001 … VER-ROLE-004
 *
 * godmode > admin > user. The hierarchy was enforced on delete and on promote,
 * but not on create — so an admin could mint a godmode account and log into it.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const authSrc = fs.readFileSync(path.join(__dirname, '../../routes/auth.js'), 'utf8');
const setupSrc = fs.readFileSync(path.join(__dirname, '../../services/setupService.js'), 'utf8');

const ROLE_RANK = { godmode: 3, admin: 2, user: 1 };
const mayCreate = (actor, requested) =>
  !!ROLE_RANK[requested] && ROLE_RANK[requested] <= (ROLE_RANK[actor] || 0);

describe('Role hierarchy [VER-ROLE]', () => {
  it('VER-ROLE-001: nobody may create a role above their own', () => {
    assert.equal(mayCreate('admin', 'godmode'), false, 'the escalation this guards against');
    assert.equal(mayCreate('user', 'admin'), false);
    assert.equal(mayCreate('user', 'godmode'), false);
  });

  it('VER-ROLE-002: creating a peer or below is allowed', () => {
    // Admins routinely need to appoint other admins; that is lateral, not escalation.
    assert.equal(mayCreate('admin', 'admin'), true);
    assert.equal(mayCreate('admin', 'user'), true);
    assert.equal(mayCreate('godmode', 'godmode'), true);
  });

  it('VER-ROLE-003: unknown roles are rejected outright', () => {
    // role came straight from the request body, so any string could be stored.
    assert.equal(mayCreate('godmode', 'superuser'), false);
    assert.equal(mayCreate('godmode', ''), false);
  });

  it('VER-ROLE-005: God Mode cannot be minted through user creation', () => {
    // Even a godmode may not create a second one. An instance has one owner, so
    // "who owns this install" always has a single answer.
    assert.match(authSrc, /requestedRole === 'godmode'/,
      'POST /register must refuse godmode outright');
    assert.match(authSrc, /Transfer ownership from User Management/,
      'and must point the caller at the transfer path');
  });

  it('VER-ROLE-006: promoting to God Mode transfers, it does not duplicate', () => {
    // Nobody can change their own role, so a straight promote would strand two
    // owners with no way back to one. The outgoing owner steps down atomically.
    assert.match(authSrc, /updateUserRole\(req\.user\.id, 'admin'\)/,
      'the current owner must be demoted in the same operation');
    assert.match(authSrc, /ownershipTransferred/,
      'the response must say ownership moved, since the caller loses God Mode');
  });

  it('VER-ROLE-007: a recovery path exists outside HTTP', () => {
    // Without this, losing the single owner leaves an install that can never
    // reset a password or change a role again.
    const cli = fs.readFileSync(path.join(__dirname, '../../../scripts/grant-godmode.js'), 'utf8');
    assert.match(cli, /updateUserRole\(target\.id, 'godmode'\)/);
    assert.match(cli, /'admin'/, 'must demote the previous owner to keep exactly one');
  });

  it('VER-ROLE-004: register enforces the rank check, and setup creates a godmode owner', () => {
    assert.match(authSrc, /ROLE_RANK\[requestedRole\] > \(ROLE_RANK\[req\.user\.role\]/,
      'POST /register must compare the requested role against the caller');
    assert.doesNotMatch(authSrc, /role: role \|\| 'user'/,
      'the unchecked passthrough must be gone');
    assert.match(setupSrc, /role: 'godmode'/,
      'first-run setup must create the instance owner as godmode, or godmode is unreachable');
  });
});
