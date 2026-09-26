const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { composeAiFridayProse, clearCache } = require('../../pulse/aiFriday');

const clauses = [
  { id: 'mix', text: 'This board is 40% firefighting.' },
  { id: 'bottleneck', text: 'Queue is at QA — median 2.0d × 3 in station.' }
];

describe('Pulse AI Friday prose VER-PULSE-AI', () => {
  // The prose cache is keyed on the clause text, so tests that reuse the same
  // clauses would otherwise hand each other a previous test's answer.
  beforeEach(() => clearCache());

  it('VER-PULSE-AI: missing key hides prose and keeps arithmetic clauses', async () => {
    const out = await composeAiFridayProse({
      clauses,
      hasAiInsights: true,
      apiKey: '',
      generate: async () => 'should not run'
    });
    assert.equal(out.prose, null);
    assert.equal(out.hiddenReason, 'no key');
    assert.equal(out.clauses, clauses);
    assert.equal(out.clauses[0].text, 'This board is 40% firefighting.');
  });

  it('VER-PULSE-AI: Community tier hides prose', async () => {
    const out = await composeAiFridayProse({
      clauses,
      hasAiInsights: false,
      apiKey: 'sk-test',
      generate: async () => 'should not run'
    });
    assert.equal(out.prose, null);
    assert.equal(out.hiddenReason, 'tier');
    assert.deepEqual(out.clauses, clauses);
  });

  it('VER-PULSE-AI: Professional with key adds a paragraph under the numbers', async () => {
    const out = await composeAiFridayProse({
      clauses,
      hasAiInsights: true,
      apiKey: 'sk-test',
      generate: async (input) => `Narrative of ${input[0].text}`
    });
    assert.match(out.prose, /40% firefighting/);
    assert.equal(out.clauses.length, 2);
    assert.equal(out.clauses[0].id, 'mix');
  });

  it('generate failure hides prose, does not rewrite clauses', async () => {
    const out = await composeAiFridayProse({
      clauses,
      hasAiInsights: true,
      apiKey: 'sk-test',
      generate: async () => {
        throw new Error('upstream');
      }
    });
    assert.equal(out.prose, null);
    assert.equal(out.hiddenReason, 'error');
    assert.equal(out.clauses[1].text.includes('QA'), true);
  });

  it('VER-PULSE-AI: a hung upstream times out instead of hanging the brief', async () => {
    // Before M24 there was no timeout at all: a stalled OpenAI call stalled the
    // whole GET /api/pulse/brief.
    const started = Date.now();
    const out = await composeAiFridayProse({
      clauses,
      hasAiInsights: true,
      apiKey: 'sk-test',
      timeoutMs: 60,
      generate: (_c, _k, opts) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    });
    assert.equal(out.prose, null);
    assert.equal(out.hiddenReason, 'timeout');
    assert.ok(Date.now() - started < 2000, 'gave up quickly');
    // The arithmetic always survives.
    assert.equal(out.clauses.length, clauses.length);
  });

  it('VER-PULSE-AI: identical clauses do not call upstream twice', async () => {
    let calls = 0;
    const generate = async () => {
      calls += 1;
      return 'cached narration';
    };
    const first = await composeAiFridayProse({ clauses, hasAiInsights: true, apiKey: 'sk-test', generate });
    const second = await composeAiFridayProse({ clauses, hasAiInsights: true, apiKey: 'sk-test', generate });
    assert.equal(first.prose, 'cached narration');
    assert.equal(second.prose, 'cached narration');
    assert.equal(second.cached, true);
    assert.equal(calls, 1, 'the second request was served from cache');
  });

  it('VER-PULSE-AI: different numbers are a different cache entry', async () => {
    let calls = 0;
    const generate = async (c) => {
      calls += 1;
      return `narrative ${c[0].text}`;
    };
    await composeAiFridayProse({ clauses, hasAiInsights: true, apiKey: 'sk-test', generate });
    const other = await composeAiFridayProse({
      clauses: [{ id: 'mix', text: 'This board is 99% firefighting.' }],
      hasAiInsights: true,
      apiKey: 'sk-test',
      generate
    });
    assert.equal(calls, 2, 'new numbers must not reuse old prose');
    assert.match(other.prose, /99%/);
  });

  it('VER-PULSE-AI: a transport blip is retried once, a refusal is not', async () => {
    let calls = 0;
    const flaky = async () => {
      calls += 1;
      if (calls === 1) {
        const err = new Error('socket hang up');
        throw err;
      }
      return 'recovered';
    };
    const ok = await composeAiFridayProse({ clauses, hasAiInsights: true, apiKey: 'sk-test', generate: flaky });
    assert.equal(ok.prose, 'recovered');
    assert.equal(calls, 2);

    clearCache();
    let refusals = 0;
    const refused = async () => {
      refusals += 1;
      const err = new Error('bad request');
      err.status = 400;
      throw err;
    };
    const out = await composeAiFridayProse({ clauses, hasAiInsights: true, apiKey: 'sk-test', generate: refused });
    assert.equal(out.hiddenReason, 'error');
    assert.equal(refusals, 1, 'retrying a refusal just pays twice for the same answer');
  });
});
