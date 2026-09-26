const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isPulseEnabled } = require('../../config/pulse.config');

describe('Pulse kill switch VER-PULSE-KILL', () => {
  it('PULSE_ENABLED=false is Mertis-only', () => {
    const prev = process.env.PULSE_ENABLED;
    process.env.PULSE_ENABLED = 'false';
    try {
      assert.equal(isPulseEnabled(), false);
    } finally {
      if (prev === undefined) delete process.env.PULSE_ENABLED;
      else process.env.PULSE_ENABLED = prev;
    }
  });

  it('unset PULSE_ENABLED leaves Pulse on', () => {
    const prev = process.env.PULSE_ENABLED;
    delete process.env.PULSE_ENABLED;
    try {
      assert.equal(isPulseEnabled(), true);
    } finally {
      if (prev === undefined) delete process.env.PULSE_ENABLED;
      else process.env.PULSE_ENABLED = prev;
    }
  });
});
