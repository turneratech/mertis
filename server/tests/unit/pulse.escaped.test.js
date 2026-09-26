const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { computeEscaped } = require('../../pulse/escaped');

const iso = (n) => new Date(n).toISOString();
const sc = (from, to, at) => ({
  action: 'status_change',
  from,
  to,
  station: to === 'Closed' ? 'closed' : 'dev',
  timestamp: iso(at)
});

const closed = (id, at) => ({
  bugId: id,
  status: 'Closed',
  environment: 'Development',
  bugType: 'Bug',
  created: iso(0),
  closedDate: iso(at),
  activityLog: [sc('Open', 'Closed', at)]
});

describe('Pulse escaped Production VER-PULSE-ESC §12.8', () => {
  it('VER-PULSE-ESC: Production Bug after last close is escaped', () => {
    const escaped = computeEscaped([
      closed('ES-CLOSE', 1000),
      {
        bugId: 'ES-PROD',
        status: 'Open',
        environment: 'Production',
        bugType: 'Bug',
        severity: 'Critical',
        created: iso(2000),
        activityLog: []
      }
    ]);
    assert.equal(escaped.count, 1);
    assert.equal(escaped.criticalCount, 1);
    assert.deepEqual(escaped.evidence, ['ES-PROD']);
    assert.equal(escaped.sentence, '1 escaped since last close (1 Critical).');
    assert.equal(escaped.reason, null);
    assert.equal(escaped.degraded, null);
  });

  it('VER-PULSE-ESC: Testing environment is not escaped', () => {
    const escaped = computeEscaped([
      closed('ES-CLOSE', 1000),
      {
        bugId: 'ES-TEST',
        status: 'Open',
        environment: 'Testing',
        bugType: 'Bug',
        severity: 'High',
        created: iso(2000),
        activityLog: []
      }
    ]);
    assert.equal(escaped.count, 0);
    assert.equal(escaped.reason, null);
    assert.equal(escaped.sentence, 'No escaped Production bugs since last close.');
    assert.equal(escaped.evidence.includes('ES-TEST'), false);
  });

  it('VER-PULSE-ESC: untyped environment degrades, never 0', () => {
    const escaped = computeEscaped([
      closed('ES-CLOSE', 1000),
      {
        bugId: 'ES-BLANK',
        status: 'Open',
        environment: '',
        bugType: 'Bug',
        created: iso(2000),
        activityLog: []
      }
    ]);
    assert.equal(escaped.count, null);
    assert.equal(escaped.reason, 'untyped environment');
    assert.equal(escaped.degraded.metric, 'escaped');
    assert.equal(escaped.sentence, null);
  });

  it('VER-PULSE-ESC: no close recorded degrades, never 0', () => {
    const escaped = computeEscaped([{
      bugId: 'ES-OPEN',
      status: 'Open',
      environment: 'Production',
      bugType: 'Bug',
      created: iso(1000),
      activityLog: [{ action: 'comment', timestamp: iso(1500), message: 'Closed in prod' }]
    }]);
    assert.equal(escaped.count, null);
    assert.equal(escaped.reason, 'no close recorded');
    assert.equal(escaped.degraded.metric, 'escaped');
  });

  it('Production before the last close is not escaped', () => {
    const escaped = computeEscaped([
      {
        bugId: 'ES-OLD',
        status: 'Open',
        environment: 'Production',
        bugType: 'Bug',
        created: iso(500),
        activityLog: []
      },
      closed('ES-CLOSE', 1000)
    ]);
    assert.equal(escaped.count, 0);
    assert.equal(escaped.evidence.includes('ES-OLD'), false);
  });
});
