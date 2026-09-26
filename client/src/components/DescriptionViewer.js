import React, { useEffect, useState, useCallback } from 'react';
import { sanitizeDescriptionHtml, isPlainTextDescription } from '../utils/sanitizeDescription';
import { loadAttachmentObjectUrl, openAttachmentById } from '../utils/attachmentUpload';

function InlineAttachmentImage({ bugId, attachmentId, alt }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let blobUrl = null;
    let cancelled = false;

    loadAttachmentObjectUrl(bugId, attachmentId)
      .then((url) => {
        if (cancelled) return;
        if (url) {
          blobUrl = url.startsWith('blob:') ? url : null;
          setSrc(url);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (blobUrl) window.URL.revokeObjectURL(blobUrl);
    };
  }, [bugId, attachmentId]);

  if (failed) {
    return <span className="inline-attachment-missing">[Image: {alt || attachmentId}]</span>;
  }
  if (!src) {
    return <span className="inline-attachment-loading">Loading image…</span>;
  }
  return (
    <img
      src={src}
      alt={alt || 'Attachment'}
      className="inline-attachment-image"
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
}

async function openAttachment(bugId, attachmentId) {
  await openAttachmentById(bugId, attachmentId);
}

function DescriptionViewer({ description, bugId }) {
  const handleAttachmentLinkClick = useCallback(async (e) => {
    const link = e.target.closest('a[data-attachment-id]');
    if (!link || !bugId) return;
    e.preventDefault();
    const attachmentId = link.getAttribute('data-attachment-id');
    try {
      await openAttachment(bugId, attachmentId);
    } catch (err) {
      alert('Could not open attachment: ' + (err.response?.data?.error || err.message));
    }
  }, [bugId]);

  if (!description) {
    return <span className="description-empty">No description provided.</span>;
  }

  if (isPlainTextDescription(description)) {
    return <span style={{ whiteSpace: 'pre-wrap' }}>{description}</span>;
  }

  const safeHtml = sanitizeDescriptionHtml(description);
  const parts = parseDescriptionParts(safeHtml);

  return (
    <div className="description-html" onClick={handleAttachmentLinkClick} role="presentation">
      {parts.map((part, idx) => {
        if (part.type === 'html') {
          return <span key={idx} dangerouslySetInnerHTML={{ __html: part.content }} />;
        }
        if (part.type === 'image' && bugId) {
          return (
            <InlineAttachmentImage
              key={idx}
              bugId={bugId}
              attachmentId={part.attachmentId}
              alt={part.alt}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

function parseDescriptionParts(html) {
  const parts = [];
  const regex = /<img([^>]*data-attachment-id="([^"]+)"[^>]*)\/?>/gi;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'html', content: html.slice(lastIndex, match.index) });
    }
    const altMatch = match[1].match(/alt="([^"]*)"/i);
    parts.push({
      type: 'image',
      attachmentId: match[2],
      alt: altMatch ? altMatch[1] : ''
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < html.length) {
    parts.push({ type: 'html', content: html.slice(lastIndex) });
  }

  if (parts.length === 0) {
    parts.push({ type: 'html', content: html });
  }

  return parts;
}

export default DescriptionViewer;
