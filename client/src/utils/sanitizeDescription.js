/**
 * Client-side description sanitization for safe HTML rendering.
 */

const ALLOWED_TAGS = [
  'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'code',
  'a', 'img'
];

const ALLOWED_ATTRS = {
  a: ['href', 'title', 'data-attachment-id', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'data-attachment-id', 'data-pending-id', 'class', 'style'],
  '*': ['class']
};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isPlainTextDescription(value) {
  if (!value || typeof value !== 'string') return true;
  return !/<[a-z][\s\S]*>/i.test(value.trim());
}

export function sanitizeDescriptionHtml(html) {
  if (!html || typeof html !== 'string') return '';

  let out = html;
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style[\s\S]*?<\/style>/gi, '');
  out = out.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/javascript:/gi, '');

  out = out.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!ALLOWED_TAGS.includes(t)) return '';

    if (match.startsWith('</')) return `</${t}>`;

    const allowed = new Set([...(ALLOWED_ATTRS['*'] || []), ...(ALLOWED_ATTRS[t] || [])]);
    const attrMatches = [...attrs.matchAll(/([a-z0-9-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)];

    let cleanAttrs = '';
    for (const m of attrMatches) {
      const name = m[1].toLowerCase();
      const value = (m[3] || m[4] || m[5] || '').trim();
      if (!allowed.has(name)) continue;
      if (name === 'href' || name === 'src') {
        if (/^javascript:/i.test(value)) continue;
        if (name === 'src' && value && !/^(https?:|blob:|data:image\/)/i.test(value)) continue;
      }
      if (name === 'style') {
        const safeStyle = value
          .split(';')
          .map(s => s.trim())
          .filter(s => /^(max-width|width|height)\s*:/i.test(s))
          .join('; ');
        if (!safeStyle) continue;
        cleanAttrs += ` style="${escapeHtml(safeStyle)}"`;
        continue;
      }
      cleanAttrs += ` ${name}="${escapeHtml(value)}"`;
    }

    if (t === 'img') return `<img${cleanAttrs} />`;
    if (t === 'br') return '<br />';
    return `<${t}${cleanAttrs}>`;
  });

  return out.trim();
}

export function sanitizeDescription(value) {
  if (value == null) return '';
  const str = String(value);
  if (isPlainTextDescription(str)) return str;
  return sanitizeDescriptionHtml(str);
}
