const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { shouldRefuseCsvFallback, mysqlFailureBanner } = require('../../storage/mysqlBootGuard');

describe('MySQL boot guard', () => {
  it('CSV provider never requires MySQL (test/dev fallback)', () => {
    assert.equal(
      shouldRefuseCsvFallback({ DATABASE_PROVIDER: 'csv', DB_NAME: 'bugtracker' }, 'csv'),
      false
    );
  });

  it('DATABASE_PROVIDER=mysql always requires MySQL', () => {
    assert.equal(shouldRefuseCsvFallback({}, 'mysql'), true);
  });

  it('auto + DB_* in env refuses silent CSV fallback', () => {
    assert.equal(
      shouldRefuseCsvFallback({ DATABASE_PROVIDER: 'auto', DB_NAME: 'bugtracker' }, 'auto'),
      true
    );
  });

  it('auto with no DB_* still allows CSV fallback', () => {
    assert.equal(shouldRefuseCsvFallback({ DATABASE_PROVIDER: 'auto' }, 'auto'), false);
  });

  it('banner is red and names ERROR ACCESSING MYSQL', () => {
    const text = mysqlFailureBanner({
      host: 'localhost',
      port: 3306,
      user: 'bugtracker',
      database: 'mertis',
      reason: 'unknown database'
    });
    assert.match(text, /\x1b\[1;31m/);
    assert.match(text, /ERROR ACCESSING MYSQL/);
    assert.match(text, /database=mertis/);
    assert.match(text, /unknown database/);
  });
});
