const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { computeQualityTax } = require('../../pulse/qualityTax');

describe('Pulse quality tax §12.3', () => {
  it('mixed Bug and Feature yields a firefighting sentence', () => {
    const tax = computeQualityTax([
      { bugId: 'QT-1', bugType: 'Bug' },
      { bugId: 'QT-2', bugType: 'Feature' },
      { bugId: 'QT-3', bugType: 'Bug' },
      { bugId: 'QT-4', bugType: 'Feature' }
    ]);
    assert.equal(tax.percent, 50);
    assert.equal(tax.sentence, 'This board is 50% firefighting.');
    assert.equal(tax.split.Bug, 2);
    assert.equal(tax.split.Feature, 2);
    assert.equal(tax.degraded, null);
  });

  it('all Features is honest 0%, not a degraded blank', () => {
    const tax = computeQualityTax([
      { bugType: 'Feature' },
      { bugType: 'Task' }
    ]);
    assert.equal(tax.percent, 0);
    assert.equal(tax.sentence, 'This board is 0% firefighting.');
    assert.equal(tax.degraded, null);
  });

  it('missing bugType degrades and never reports 0%', () => {
    const tax = computeQualityTax([
      { bugId: 'QT-csv', bugType: '' },
      { bugId: 'QT-null', bugType: null },
      { bugId: 'QT-gone' }
    ]);
    assert.equal(tax.percent, null);
    assert.equal(tax.sentence, null);
    assert.equal(tax.degraded.metric, 'qualityTax');
    assert.equal(tax.degraded.reason, 'bugType not available');
  });

  it('empty board degrades instead of 0%', () => {
    const tax = computeQualityTax([]);
    assert.equal(tax.percent, null);
    assert.equal(tax.sentence, null);
    assert.equal(tax.degraded.reason, 'no typed work on this board');
  });
});
