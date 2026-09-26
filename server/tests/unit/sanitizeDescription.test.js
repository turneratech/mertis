/**
 * @verifies VER-DESC-001 … VER-DESC-008
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeDescription, sanitizeHtml, isPlainText } = require('../../utils/sanitizeDescription');
const {
  INLINE_IMAGE_SAVED_HTML,
  DOC_LINK_HTML,
  RICH_DESCRIPTION_HTML,
  XSS_SAMPLES
} = require('../helpers/fixtures');

describe('Description sanitization [VER-DESC]', () => {
  it('VER-DESC-001: plain text passes through unchanged', () => {
    const text = 'Line one\nLine two\nNo HTML here';
    assert.equal(isPlainText(text), true);
    assert.equal(sanitizeDescription(text), text);
  });

  it('VER-DESC-002: strips script tags and event handlers', () => {
    for (const sample of XSS_SAMPLES) {
      const out = sanitizeHtml(sample);
      assert.doesNotMatch(out, /<script/i);
      assert.doesNotMatch(out, /onerror\s*=/i);
      assert.doesNotMatch(out, /onclick\s*=/i);
      assert.doesNotMatch(out, /javascript:/i);
      assert.doesNotMatch(out, /<iframe/i);
    }
  });

  it('VER-DESC-003: preserves inline attachment image refs', () => {
    const out = sanitizeHtml(INLINE_IMAGE_SAVED_HTML);
    assert.match(out, /data-attachment-id="att-001"/);
    assert.match(out, /inline-attachment-image/);
    assert.match(out, /alt="screenshot\.png"/);
  });

  it('VER-DESC-004: preserves document attachment links', () => {
    const out = sanitizeHtml(DOC_LINK_HTML);
    assert.match(out, /data-attachment-id="att-002"/);
    assert.match(out, /spec\.pdf/);
  });

  it('VER-DESC-005: preserves rich formatting tags', () => {
    const out = sanitizeHtml(RICH_DESCRIPTION_HTML);
    assert.match(out, /<strong>/);
    assert.match(out, /<ul>/);
    assert.match(out, /<li>/);
  });

  it('VER-DESC-006: allows blob src during pending image upload', () => {
    const html = '<img src="blob:http://localhost/abc" data-pending-id="p1" alt="x" />';
    const out = sanitizeHtml(html);
    assert.match(out, /data-pending-id="p1"/);
    assert.match(out, /blob:http/);
  });

  it('VER-DESC-007: allows empty img src with data-attachment-id placeholder', () => {
    const html = '<img src="" data-attachment-id="att-99" alt="x" />';
    const out = sanitizeHtml(html);
    assert.match(out, /data-attachment-id="att-99"/);
  });

  it('VER-DESC-008: sanitizeDescription keeps plain text, sanitizes HTML', () => {
    assert.equal(sanitizeDescription('hello'), 'hello');
    const html = '<p>ok</p><script>x</script>';
    assert.equal(sanitizeDescription(html), '<p>ok</p>');
  });
});
