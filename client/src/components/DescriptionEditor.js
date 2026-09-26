import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import { uploadAttachment, isImageFile, fetchDefaultProvider, loadAttachmentObjectUrl } from '../utils/attachmentUpload';
import { sanitizeDescriptionHtml, isPlainTextDescription } from '../utils/sanitizeDescription';
import './DescriptionEditor.css';

let pendingIdCounter = 0;

function createPendingId() {
  pendingIdCounter += 1;
  return `pending-${Date.now()}-${pendingIdCounter}`;
}

function exec(cmd, value = null) {
  document.execCommand(cmd, false, value);
}

/** Legacy plain-text descriptions: preserve newlines when loading into contentEditable */
function valueToEditorHtml(value) {
  if (!value) return '';
  if (isPlainTextDescription(value)) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .split('\n')
      .join('<br>');
  }
  return value;
}

/**
 * Rich-text description editor with clipboard image paste (Azure DevOps style).
 * Images upload as attachments and appear inline + in the attachment list.
 */
const DescriptionEditor = forwardRef(function DescriptionEditor(
  {
    value,
    onChange,
    bugId,
    onAttachmentUploaded,
    placeholder,
    disabled = false,
    maxImageBytes = 25 * 1024 * 1024,
    maxImageLabel = '25MB'
  },
  ref
) {
  const editorRef = useRef(null);
  const [provider, setProvider] = useState('local');
  const [uploading, setUploading] = useState(false);
  const pendingImagesRef = useRef(new Map());
  const isInternalChange = useRef(false);

  useEffect(() => {
    fetchDefaultProvider().then(setProvider);
  }, []);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || isInternalChange.current) return;
    const current = el.innerHTML;
    const incoming = valueToEditorHtml(value || '');
    if (current !== incoming && (incoming || !current)) {
      el.innerHTML = incoming;
      if (bugId) hydrateInlineImages(el, bugId);
    }
  }, [value, bugId]);

  const hydrateInlineImages = async (el, id) => {
    const imgs = el.querySelectorAll('img[data-attachment-id]');
    for (const img of imgs) {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('blob:')) continue;
      const attachmentId = img.getAttribute('data-attachment-id');
      if (!attachmentId) continue;
      try {
        const url = await loadAttachmentObjectUrl(id, attachmentId);
        if (url) img.src = url;
      } catch {
        // keep placeholder
      }
    }
  };

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el || !onChange) return;
    isInternalChange.current = true;
    onChange(sanitizeDescriptionHtml(el.innerHTML));
    requestAnimationFrame(() => {
      isInternalChange.current = false;
    });
  }, [onChange]);

  const insertHtmlAtCursor = (html) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const frag = document.createDocumentFragment();
      while (temp.firstChild) frag.appendChild(temp.firstChild);
      range.insertNode(frag);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      el.insertAdjacentHTML('beforeend', html);
    }
    emitChange();
  };

  const insertImageAttachment = (attachment, previewSrc) => {
    const alt = attachment.fileName || 'image';
    const src = previewSrc || '';
    const html = `<p><img src="${src}" alt="${escapeAttr(alt)}" data-attachment-id="${attachment.id}" class="inline-attachment-image" style="max-width:100%;height:auto;" /></p>`;
    insertHtmlAtCursor(html);
    if (onAttachmentUploaded) onAttachmentUploaded(attachment);
  };

  const insertPendingImage = (file, pendingId, blobUrl) => {
    const alt = file.name || 'pasted-image.png';
    const html = `<p><img src="${blobUrl}" alt="${escapeAttr(alt)}" data-pending-id="${pendingId}" class="inline-attachment-image" style="max-width:100%;height:auto;" /></p>`;
    insertHtmlAtCursor(html);
  };

  const handleImageFile = async (file) => {
    if (!file || !isImageFile(file)) return;
    if (file.size > maxImageBytes) {
      alert(`Image exceeds ${maxImageLabel} limit`);
      return;
    }

    setUploading(true);
    try {
      if (bugId) {
        const attachment = await uploadAttachment(bugId, file, provider);
        insertImageAttachment(attachment, URL.createObjectURL(file));
      } else {
        const pendingId = createPendingId();
        const blobUrl = URL.createObjectURL(file);
        pendingImagesRef.current.set(pendingId, file);
        insertPendingImage(file, pendingId, blobUrl);
      }
    } catch (err) {
      alert('Failed to upload image: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await handleImageFile(file);
        return;
      }
    }
  };

  const handleDrop = async (e) => {
    const files = Array.from(e.dataTransfer?.files || []);
    const image = files.find(isImageFile);
    if (image) {
      e.preventDefault();
      await handleImageFile(image);
    }
  };

  const insertAttachmentLink = (attachment) => {
    const label = attachment.fileName || 'Attachment';
    const html = `<a href="#" data-attachment-id="${attachment.id}" title="${escapeAttr(label)}">${escapeAttr(label)}</a>&nbsp;`;
    insertHtmlAtCursor(html);
  };

  const flushPendingImages = async (newBugId) => {
    const el = editorRef.current;
    if (!el || pendingImagesRef.current.size === 0) {
      return sanitizeDescriptionHtml(el?.innerHTML || value || '');
    }

    let html = el.innerHTML;
    const entries = [...pendingImagesRef.current.entries()];

    for (const [pendingId, file] of entries) {
      try {
        const attachment = await uploadAttachment(newBugId, file, provider);
        const regex = new RegExp(
          `<img([^>]*?)data-pending-id="${pendingId}"([^>]*?)\\/?>`,
          'gi'
        );
        html = html.replace(regex, (match) => {
          return match
            .replace(/\ssrc="[^"]*"/i, ' src=""')
            .replace(/data-pending-id="[^"]*"/i, `data-attachment-id="${attachment.id}"`);
        });
        if (onAttachmentUploaded) onAttachmentUploaded(attachment);
        pendingImagesRef.current.delete(pendingId);
      } catch (err) {
        console.error('Failed to flush pending image:', err.message);
      }
    }

    el.innerHTML = html;
    const sanitized = sanitizeDescriptionHtml(html);
    if (onChange) onChange(sanitized);
    return sanitized;
  };

  useImperativeHandle(ref, () => ({
    insertAttachmentLink,
    flushPendingImages,
    hasPendingImages: () => pendingImagesRef.current.size > 0,
    getDescription: () => sanitizeDescriptionHtml(editorRef.current?.innerHTML || ''),
    focus: () => editorRef.current?.focus()
  }));

  return (
    <div className={`description-editor ${disabled ? 'disabled' : ''}`}>
      <div className="description-editor-toolbar">
        <button type="button" title="Bold" onClick={() => { exec('bold'); emitChange(); }} disabled={disabled}>
          <strong>B</strong>
        </button>
        <button type="button" title="Italic" onClick={() => { exec('italic'); emitChange(); }} disabled={disabled}>
          <em>I</em>
        </button>
        <button type="button" title="Underline" onClick={() => { exec('underline'); emitChange(); }} disabled={disabled}>
          <u>U</u>
        </button>
        <span className="toolbar-sep" />
        <button type="button" title="Bullet list" onClick={() => { exec('insertUnorderedList'); emitChange(); }} disabled={disabled}>
          • List
        </button>
        <button type="button" title="Numbered list" onClick={() => { exec('insertOrderedList'); emitChange(); }} disabled={disabled}>
          1. List
        </button>
        <span className="toolbar-sep" />
        <button
          type="button"
          title="Insert link"
          disabled={disabled}
          onClick={() => {
            const url = window.prompt('Enter URL:');
            if (url) {
              exec('createLink', url);
              emitChange();
            }
          }}
        >
          Link
        </button>
        {uploading && <span className="editor-upload-status">Uploading image…</span>}
      </div>
      <div
        ref={editorRef}
        className="description-editor-body form-control"
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emitChange}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        role="textbox"
        aria-multiline="true"
      />
    </div>
  );
});

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export default DescriptionEditor;
