const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pulseDir = path.join(__dirname, '../../../client/src/pulse');

const walk = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
};

describe('Pulse packaging VER-PULSE-BRAND', () => {
  it('VER-PULSE-BRAND: Pulse chrome ships its own mark and tab icons', () => {
    const app = fs.readFileSync(path.join(pulseDir, 'PulseApp.js'), 'utf8');
    const brand = fs.readFileSync(path.join(pulseDir, 'usePulseBrand.js'), 'utf8');
    assert.match(app, /\.\/assets\/logo\.svg/);
    assert.match(brand, /\/pulse\/favicon\.svg/);
    assert.ok(fs.existsSync(path.join(__dirname, '../../../client/public/pulse/favicon.svg')));
    assert.ok(fs.existsSync(path.join(pulseDir, 'assets/logo.svg')));
  });
});

describe('Pulse packaging VER-PULSE-KILL', () => {
  it('VER-PULSE-KILL: Pulse routes do not import BugList or Navbar tracker IA', () => {
    const files = walk(pulseDir);
    assert.ok(files.length > 0);
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      assert.equal(src.includes('BugList'), false, file);
      assert.equal(src.includes('components/Navbar'), false, file);
      assert.equal(src.includes('/my-bugs'), false, file);
    }
  });
});
