const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pulseDir = path.join(__dirname, '../../../client/src/pulse');
const read = (rel) => fs.readFileSync(path.join(pulseDir, rel), 'utf8');

const walk = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
};

describe('Pulse interaction [VER-PULSE-KEYS]', () => {
  it('VER-PULSE-KEYS: a modifier keystroke is never a Pulse command', () => {
    // Regression guard. The old Pit handler matched a bare `e.key === 'a'` with
    // no modifier check, so Ctrl+A / Cmd+A fired POST /api/pulse/triage.
    const hook = read('useKeyboard.js');
    assert.match(hook, /event\.ctrlKey/);
    assert.match(hook, /event\.metaKey/);
    assert.match(hook, /event\.altKey/);
    assert.match(hook, /isContentEditable/, 'the rich description editor must not swallow commands');
  });

  it('VER-PULSE-KEYS: only Escape may bypass the shared key guard', () => {
    // The rule protects COMMANDS: a bare letter must never reach a mutation
    // without the modifier/typing checks in usePulseKeys. Dismissing a transient
    // thing with Escape is not a command, and routing it through the shared hook
    // would preventDefault Escape module-wide. So: a direct keydown binding is
    // allowed if and only if it handles nothing but Escape.
    for (const file of walk(pulseDir)) {
      const src = fs.readFileSync(file, 'utf8');
      const name = path.basename(file);
      if (name === 'useKeyboard.js') continue;
      if (!src.includes("addEventListener('keydown'")) continue;

      const keys = [...src.matchAll(/\.key === '([^']+)'/g)].map((m) => m[1]);
      assert.ok(keys.length > 0, name + ' binds keydown but matches no key');
      for (const key of keys) {
        assert.equal(
          key,
          'Escape',
          name + " binds keydown for '" + key + "' — route commands through usePulseKeys"
        );
      }
    }
  });
});

describe('Pulse touch and pointer [VER-PULSE-TOUCH]', () => {
  it('VER-PULSE-TOUCH: the board uses pointer sensors, not native HTML5 drag', () => {
    // Native drag-and-drop never fires on touch, so the Strike Board was
    // read-only on every phone and tablet.
    const board = read('StrikeBoard.js');
    assert.match(board, /TouchSensor/);
    assert.match(board, /PointerSensor/);
    assert.match(board, /KeyboardSensor/, 'dragging must have a keyboard path');
    assert.equal(board.includes('dataTransfer'), false, 'no HTML5 dataTransfer left');
    assert.equal(board.includes('onDragOver'), false, 'no HTML5 drag handlers left');
  });

  it('VER-PULSE-TOUCH: Pulse no longer forces a fixed-width board on small screens', () => {
    const css = read('pulse.css');
    // The single old media query pinned 5 columns at 220px each below 1100px,
    // which is 1100px of horizontal scroll on a 390px phone.
    assert.equal(css.includes('repeat(5, 220px)'), false, 'fixed 5-column mobile board removed');
    assert.match(css, /@media \(max-width: 720px\)/, 'a phone breakpoint exists');
    // The motion switch lives with the tokens, not the component styles.
    assert.match(read('tokens.css'), /prefers-reduced-motion/, 'motion can be turned off');
    assert.match(read('tokens.css'), /focus-visible/, 'focus is visible');
  });
});

describe('Pulse tooltips [VER-PULSE-TIPS]', () => {
  it('VER-PULSE-TIPS: the tooltip layer is mounted once, inside the Pulse scope', () => {
    const app = read('PulseApp.js');
    // Delegation means one layer for the whole module; two would double-fire.
    assert.equal((app.match(/<Tooltip \/>/g) || []).length, 1);
  });

  it('VER-PULSE-TIPS: tips answer to the keyboard, not only the mouse', () => {
    const tip = read('components/Tooltip.js');
    assert.match(tip, /focusin/, 'keyboard users get the same help');
    assert.match(tip, /aria-describedby/, 'screen readers are told about the tip');
    assert.match(tip, /Escape/, 'Escape dismisses it');
    // A tip that swallows pointer events would block the control it describes.
    assert.match(read('pulse.css'), /pointer-events: none/);
  });

  it('VER-PULSE-TIPS: a tip retires on its own instead of sitting there', () => {
    const tip = read('components/Tooltip.js');
    assert.match(tip, /HIDE_AFTER/);
    assert.match(tip, /setTimeout\(hide, HIDE_AFTER\)/);
  });

  it('VER-PULSE-TIPS: the interactive surfaces carry tips', () => {
    // Not exhaustive by design: this catches a whole surface shipping with none.
    const surfaces = [
      'components/LensBar.js',
      'components/ReplayBar.js',
      'components/BugChips.js',
      'ThePit.js',
      'MissionMap.js',
      'PulseBrief.js',
      'PulseApp.js'
    ];
    for (const file of surfaces) {
      assert.match(read(file), /data-tip=/, file + ' has no tooltips');
    }
  });
});

describe('Pulse honesty in the UI [VER-PULSE-HONEST]', () => {
  it('VER-PULSE-HONEST: a card filtered out by the active lens says so', () => {
    // Found by hand, 20 Sep: dragging a card to Closed under ?lens=stale made it
    // vanish. Closing a bug resets its truth clock, so it stops being stale and
    // the lens correctly drops it — but a card that disappears in silence reads
    // as data loss. Neither M18 nor M19 caught it: it only exists where the two
    // features meet.
    const board = read('StrikeBoard.js');
    assert.match(board, /no longer matches the lens/);
    assert.match(board, /pulse-toast-\$\{toast\.tone\}|toast\.tone/, 'an explanation must not be styled as an error');
  });


  it('VER-PULSE-HONEST: Horizon does not call the longest bar a critical path', () => {
    // There are no dependency edges in the schema, so "critical path" would be
    // a claim the data cannot support.
    const horizon = read('Horizon.js');
    assert.match(horizon, /Longest open mission/);
    assert.match(horizon, /Manager question: which outcomes occupy the calendar/);
    assert.equal(/critical path/i.test(horizon.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')), false);
  });

  it('VER-PULSE-HONEST: per-project Pulse header shows the full name beside the key', () => {
    const app = read('PulseApp.js');
    assert.match(app, /PulseProjectTitle/);
    assert.match(app, /pulse-project-aka/);
    assert.match(read('pulseApi.js'), /fetchProjectName/);
  });

  it('VER-PULSE-HONEST: What is this? is on Command Deck as well as Strike', () => {
    const app = read('PulseApp.js');
    const deckIdx = app.indexOf('Command Deck');
    const helpIdx = app.indexOf('What is this?', deckIdx);
    assert.ok(helpIdx > deckIdx, 'Command Deck header must offer What is this?');
  });

  it('VER-PULSE-HONEST: What is this? defines Interrupt, Reopen gravity, and Resolved vs Closed', () => {
    const explainer = fs.readFileSync(
      path.join(__dirname, '../../../client/src/components/PulseHelpExplainer.js'),
      'utf8'
    );
    assert.match(explainer, /Words on the board/);
    assert.match(explainer, /Unplanned work that arrived this week/);
    assert.match(explainer, /bounces back after it was thought done/);
    assert.match(explainer, /Why a manager opens each view/);
    assert.match(explainer, /calendar of outcomes/);
  });

  it('VER-PULSE-HONEST: help ships Pulse activity workflows', () => {
    const flows = fs.readFileSync(
      path.join(__dirname, '../../../client/src/components/PulseHelpWorkflows.js'),
      'utf8'
    );
    assert.match(flows, /How you actually work in Pulse/);
    assert.match(flows, /A new bug arrives/);
    assert.match(flows, /Morning standup/);
    assert.match(flows, /Developer on a card/);
    assert.match(flows, /QA on a card/);
    const panel = fs.readFileSync(
      path.join(__dirname, '../../../client/src/pulse/components/PulseHelpPanel.js'),
      'utf8'
    );
    assert.match(panel, /PulseHelpWorkflows/);
  });

  it('VER-PULSE-HONEST: server config is not leaked to end users', () => {
    for (const file of walk(pulseDir)) {
      const src = fs.readFileSync(file, 'utf8');
      assert.equal(src.includes('PULSE_ENABLED'), false, `${path.basename(file)} leaks server config`);
    }
  });
});
