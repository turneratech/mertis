const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  computeLanding,
  forecastMission,
  collectSamples,
  reopenRates,
  stationsAhead,
  mulberry32,
  MIN_SAMPLES
} = require('../../pulse/forecast');

const HOUR = 3600000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 8, 20); // 2026-09-20

// A healthy history: plenty of samples at every station on the path.
const samplesOf = (perStationHours, n = 12) => {
  const out = { dev_queue: [], dev: [], qa: [], qa_testing: [] };
  for (const [station, hours] of Object.entries(perStationHours)) {
    for (let i = 0; i < n; i += 1) {
      // A little spread so percentiles are meaningful, but deterministic.
      out[station].push((hours + (i % 4)) * HOUR);
    }
  }
  return out;
};

const SAMPLES = samplesOf({ dev_queue: 24, dev: 48, qa: 24 });

const bug = (over = {}) => ({
  bugId: 'RM-1',
  status: 'Open',
  module: 'payments',
  currentStation: 'dev_queue',
  ...over
});

const mission = (over = {}) => ({
  id: 'm-1',
  title: 'Stabilise payments',
  bugs: [bug()],
  ...over
});

describe('Pulse Landing [VER-PULSE-LAND]', () => {
  it('VER-PULSE-LAND: the same mission forecasts the same date every time', () => {
    // A forecast that jitters between refreshes will never be trusted.
    const opts = { nowMs: NOW, samples: SAMPLES, reopenRates: { payments: 0.3 } };
    const a = forecastMission(mission(), opts);
    const b = forecastMission(mission(), opts);
    assert.equal(a.p50, b.p50);
    assert.equal(a.p85, b.p85);
    assert.equal(a.sentence, b.sentence);
    assert.match(a.p50, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('VER-PULSE-LAND: a different mission gets its own draw, not the same one', () => {
    const opts = { nowMs: NOW, samples: SAMPLES, reopenRates: { payments: 0.3 } };
    const a = forecastMission(mission({ id: 'm-1' }), opts);
    const b = forecastMission(mission({ id: 'm-2' }), opts);
    assert.equal(typeof a.p50Ms, 'number');
    assert.equal(typeof b.p50Ms, 'number');
  });

  it('VER-PULSE-LAND: P85 is never earlier than P50', () => {
    const out = forecastMission(mission(), {
      nowMs: NOW,
      samples: SAMPLES,
      reopenRates: { payments: 0.4 }
    });
    assert.ok(out.p85Ms >= out.p50Ms, `${out.p85} must not precede ${out.p50}`);
  });

  it('VER-PULSE-LAND: more rework widens the band and pushes P85 later', () => {
    // This is the moat: the forecast responds to measured QA bounce, which is
    // why it is not velocity in a new hat.
    const base = { nowMs: NOW, samples: SAMPLES };
    const calm = forecastMission(mission(), { ...base, reopenRates: { payments: 0 } });
    const bouncy = forecastMission(mission(), { ...base, reopenRates: { payments: 0.8 } });

    assert.ok(bouncy.p85Ms > calm.p85Ms, 'a module that bounces lands later');
    const calmSpread = calm.p85Ms - calm.p50Ms;
    const bouncySpread = bouncy.p85Ms - bouncy.p50Ms;
    assert.ok(bouncySpread > calmSpread, 'and the band is wider, not just shifted');
  });

  it('VER-PULSE-LAND: the spread is attributed to the module that actually bounces', () => {
    const out = forecastMission(
      mission({ bugs: [bug({ module: 'payments' }), bug({ bugId: 'RM-2', module: 'ui' })] }),
      { nowMs: NOW, samples: SAMPLES, reopenRates: { payments: 0.7, ui: 0.05 } }
    );
    assert.equal(out.drivers[0].kind, 'rework');
    assert.equal(out.drivers[0].module, 'payments');
    assert.ok(out.drivers[0].daysOfSpread >= 1);
    assert.match(out.sentence, /QA bounce in payments/);
  });

  it('VER-PULSE-LAND: below the sample floor it refuses and says what it needs', () => {
    // A confident wrong date destroys the premise of the product.
    const thin = { dev_queue: [DAY, DAY], dev: [DAY], qa: [] };
    const out = forecastMission(mission(), { nowMs: NOW, samples: thin });
    assert.equal(out.p50, null);
    assert.equal(out.p85, null);
    assert.ok(out.degraded);
    assert.equal(out.degraded.metric, 'landing');
    assert.match(out.degraded.reason, /not enough history to forecast/);
    assert.match(out.degraded.reason, new RegExp(`${MIN_SAMPLES} more completed bug`));
  });

  it('VER-PULSE-LAND: only the stations still ahead need history', () => {
    // A mission whose bugs are all in QA must not be blocked by a thin dev_queue.
    const qaOnly = { dev_queue: [], dev: [], qa: new Array(12).fill(12 * HOUR) };
    const out = forecastMission(mission({ bugs: [bug({ currentStation: 'qa' })] }), {
      nowMs: NOW,
      samples: qaOnly,
      reopenRates: {}
    });
    assert.equal(out.degraded, null, 'dev_queue history is irrelevant here');
    assert.ok(out.p50);
  });

  it('VER-PULSE-LAND: a finished mission has already landed, it does not get a date', () => {
    const out = forecastMission(
      mission({ bugs: [bug({ status: 'Closed' }), bug({ bugId: 'RM-2', status: 'Closed' })] }),
      { nowMs: NOW, samples: SAMPLES }
    );
    assert.equal(out.landed, true);
    assert.equal(out.p50, null);
    assert.match(out.sentence, /already landed/);
  });

  it('VER-PULSE-LAND: the mission lands when its LAST bug lands', () => {
    const one = forecastMission(mission({ bugs: [bug()] }), {
      nowMs: NOW,
      samples: SAMPLES,
      reopenRates: {}
    });
    const many = forecastMission(
      mission({
        bugs: [bug(), bug({ bugId: 'RM-2' }), bug({ bugId: 'RM-3' }), bug({ bugId: 'RM-4' })]
      }),
      { nowMs: NOW, samples: SAMPLES, reopenRates: {} }
    );
    assert.ok(many.p50Ms >= one.p50Ms, 'more parallel work cannot finish sooner');
  });

  it('VER-PULSE-LAND: helpers behave', () => {
    assert.deepEqual(stationsAhead('dev_queue'), ['dev_queue', 'dev', 'qa']);
    assert.deepEqual(stationsAhead('qa'), ['qa']);
    assert.deepEqual(stationsAhead('closed'), ['dev_queue', 'dev', 'qa'], 'unknown owes the path');

    const rnd = mulberry32(42);
    const first = [rnd(), rnd(), rnd()];
    const again = mulberry32(42);
    assert.deepEqual([again(), again(), again()], first, 'the PRNG is seeded, not random');

    const samples = collectSamples([
      { included: true, dwellMs: { dev: 2 * HOUR, qa: 0 } },
      { included: false, dwellMs: { dev: 99 * HOUR } }
    ]);
    assert.deepEqual(samples.dev, [2 * HOUR], 'excluded bugs contribute nothing');

    const rates = reopenRates(
      [{ bugId: 'a', module: 'payments' }, { bugId: 'b', module: 'payments' }],
      { a: 1, b: 0 }
    );
    assert.equal(rates.payments, 0.5);
  });

  it('VER-PULSE-LAND: interrupt is context, never a second multiplier', () => {
    // Dwell was measured while the team was being interrupted, so that drag is
    // already inside the samples. Multiplying again would double-count it.
    const withLoad = computeLanding([mission()], {
      nowMs: NOW,
      samples: SAMPLES,
      reopenRates: { payments: 0.2 },
      interruptPct: 80
    });
    const withoutLoad = computeLanding([mission()], {
      nowMs: NOW,
      samples: SAMPLES,
      reopenRates: { payments: 0.2 }
    });
    assert.equal(
      withLoad.missions[0].p85,
      withoutLoad.missions[0].p85,
      'interrupt load must not move the date'
    );
    assert.match(withLoad.assumes, /80% of capacity/);
    assert.equal(withoutLoad.assumes, null);
  });
});
