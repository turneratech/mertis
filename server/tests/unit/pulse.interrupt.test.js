const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { computeInterrupt, DEFAULT_INTERRUPT_BUDGET_PCT } = require('../../pulse/interrupt');

const DAY = 24 * 3600 * 1000;
const NOW = Date.parse('2026-09-16T12:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();

const accepted = (id, daysAgo) => ({
  bugId: id,
  status: 'Open',
  triagedAt: iso(NOW - daysAgo * DAY)
});

const committed = (id) => ({
  bugId: id,
  status: 'In Progress',
  triagedAt: iso(NOW - 10 * DAY)
});

describe('Pulse interrupt ring §12.5 (7-day + optional named window)', () => {
  it('defaults the reserve to 35%', () => {
    assert.equal(DEFAULT_INTERRUPT_BUDGET_PCT, 35);
  });

  it('1 Pit accept vs 9 committed In Progress is under budget, not 0%', () => {
    const ring = computeInterrupt([
      accepted('INT-1', 1),
      ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => committed(`IP-${n}`))
    ], { nowMs: NOW });
    assert.equal(ring.loadPct, 10);
    assert.equal(ring.overflow, false);
    assert.equal(ring.sentence, 'Interrupt took 10% of the last 7 days; 35% is reserved for Pit arrivals.');
    assert.equal(ring.segments.planned + ring.segments.reserved + ring.segments.overflow, 100);
    assert.equal(ring.degraded, null);
    assert.ok(ring.segments.planned <= 100 - ring.budgetPct);
    assert.equal(ring.segments.reserved, DEFAULT_INTERRUPT_BUDGET_PCT);
  });

  it('a flood of Pit accepts vs little committed work overflows in words', () => {
    const ring = computeInterrupt([
      committed('IP-old'),
      committed('IP-old-2'),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => accepted(`PIT-${n}`, 0))
    ], { nowMs: NOW });
    assert.equal(ring.interruptCount, 8);
    assert.equal(ring.committedCount, 2);
    assert.equal(ring.loadPct, 80);
    assert.equal(ring.overflow, true);
    assert.equal(ring.overflowPct, 45);
    assert.match(ring.sentence, /over-committed/);
    assert.equal(ring.segments.planned, 20);
    assert.equal(ring.segments.reserved, 35);
    assert.equal(ring.segments.overflow, 45);
  });

  it('accepts older than 7 days are not interrupt', () => {
    const ring = computeInterrupt([
      accepted('OLD', 8),
      committed('IP-1')
    ], { nowMs: NOW });
    assert.equal(ring.interruptCount, 0);
    assert.equal(ring.committedCount, 1);
    assert.equal(ring.loadPct, 0);
    assert.equal(ring.overflow, false);
  });

  it('empty mix degrades instead of 0%', () => {
    const ring = computeInterrupt([
      { bugId: 'OPEN-1', status: 'Open' }
    ], { nowMs: NOW });
    assert.equal(ring.loadPct, null);
    assert.equal(ring.sentence, null);
    assert.equal(ring.degraded.metric, 'interrupt');
    assert.equal(ring.degraded.reason, 'not enough committed work to measure interrupt');
  });

  it('this-week In Progress counts as interrupt, not committed', () => {
    const ring = computeInterrupt([
      { bugId: 'NEW-IP', status: 'In Progress', triagedAt: iso(NOW - DAY) },
      committed('OLD-IP')
    ], { nowMs: NOW });
    assert.equal(ring.interruptCount, 1);
    assert.equal(ring.committedCount, 1);
    assert.equal(ring.loadPct, 50);
    assert.equal(ring.overflow, true);
  });

  it('VER-PULSE-CYC: planned WIP cannot eat the 35% reserve', () => {
    const ring = computeInterrupt([
      accepted('INT-1', 1),
      committed('IP-1')
    ], { nowMs: NOW });
    assert.equal(ring.loadPct, 50);
    assert.ok(ring.segments.planned <= 100 - DEFAULT_INTERRUPT_BUDGET_PCT);
    assert.equal(ring.segments.reserved, DEFAULT_INTERRUPT_BUDGET_PCT);
  });

  it('VER-PULSE-CYC: named window with zero accepts degrades, overflow still words', () => {
    const empty = computeInterrupt([
      committed('IP-1')
    ], {
      nowMs: NOW,
      windowStart: NOW - 7 * DAY,
      windowEnd: NOW,
      windowName: 'Sep window'
    });
    assert.equal(empty.loadPct, null);
    assert.equal(empty.reason || empty.degraded.reason, 'no Pit accepts in this window');
    assert.equal(empty.windowName, 'Sep window');

    const flood = computeInterrupt([
      committed('IP-old'),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => accepted(`PIT-${n}`, 0))
    ], {
      nowMs: NOW,
      windowStart: NOW - 7 * DAY,
      windowEnd: NOW,
      windowName: 'Sep window'
    });
    assert.equal(flood.overflow, true);
    assert.match(flood.sentence, /Sep window/);
    assert.match(flood.sentence, /over-committed/);
  });
});
