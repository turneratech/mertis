/**
 * @verifies VER-AUTH-001 … VER-AUTH-003
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { generateToken, authMiddleware, JWT_SECRET } = require('../../middleware/auth');

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

describe('Auth middleware [VER-AUTH]', () => {
  it('VER-AUTH-001: generateToken produces valid JWT with role', () => {
    const user = { id: 'u1', username: 'admin', role: 'admin' };
    const token = generateToken(user);
    const decoded = jwt.verify(token, JWT_SECRET);
    assert.equal(decoded.username, 'admin');
    assert.equal(decoded.role, 'admin');
  });

  it('VER-AUTH-002: authMiddleware rejects missing token', () => {
    const req = { header: () => undefined };
    const res = mockRes();
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  it('VER-AUTH-003: authMiddleware accepts valid Bearer token', () => {
    const token = generateToken({ id: 'u2', username: 'tester', role: 'user' });
    const req = { header: (name) => name === 'Authorization' ? `Bearer ${token}` : undefined };
    const res = mockRes();
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user.username, 'tester');
  });
});
