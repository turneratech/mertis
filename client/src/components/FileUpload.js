import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useLicense } from '../hooks/useLicense';
import {
  uploadAttachment,
  isImageFile,
  fetchDefaultProvider
} from '../utils/attachmentUpload';
import {
  queuePendingFile,
  getPendingFiles,
  flushPendingFiles,
  getPendingFileCount
} from '../utils/pendingAttachments';

/**
 * File upload with pending queue for new bugs (before bugId exists).
 * Non-image files can optionally insert a reference link in the description.
 */
const FileUpload = forwardRef(function FileUpload(
  {
    bugId,
    onUploadComplete,
    onInsertDescriptionLink,
    disabled = false
  },
  ref
) {
  const { license } = useLicense();
  const maxMB = license.limits?.maxAttachmentSizeMB;
  const maxBytes = maxMB != null ? maxMB * 1024 * 1024 : 25 * 1024 * 1024;
  const maxLabel = maxMB != null ? `${maxMB}MB` : '25MB';

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('local');
  const [pendingList, setPendingList] = useState([]);
  const [addLinkInDescription, setAddLinkInDescription] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchDefaultProvider().then(setProvider);
  }, []);

  const refreshPendingList = () => {
    setPendingList(getPendingFiles().map(f => f.name));
  };

  useImperativeHandle(ref, () => ({
    flushPending: async (newBugId) => {
      const uploaded = await flushPendingFiles(newBugId, provider, maxBytes);
      refreshPendingList();
      for (const att of uploaded) {
        if (
          addLinkInDescription &&
          onInsertDescriptionLink &&
          !att.mimeType?.startsWith('image/')
        ) {
          onInsertDescriptionLink(att);
        }
      }
      if (onUploadComplete && uploaded.length > 0) {
        onUploadComplete(uploaded);
      }
      return uploaded;
    },
    getPendingCount: () => getPendingFileCount()
  }), [provider, addLinkInDescription, onInsertDescriptionLink, onUploadComplete, maxBytes]);

  const handleClick = () => {
    if (!disabled && !uploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const processUploadedFile = (attachment, file) => {
    if (
      addLinkInDescription &&
      onInsertDescriptionLink &&
      file &&
      !isImageFile(file)
    ) {
      onInsertDescriptionLink(attachment);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    e.target.value = '';
    setError('');
    setUploading(true);

    const uploadedFiles = [];

    for (const file of files) {
      if (file.size > maxBytes) {
        setError(`${file.name} exceeds ${maxLabel} limit`);
        continue;
      }

      try {
        if (bugId) {
          const attachment = await uploadAttachment(bugId, file, provider);
          uploadedFiles.push(attachment);
          processUploadedFile(attachment, file);
        } else {
          queuePendingFile(file);
          refreshPendingList();
        }
      } catch (err) {
        setError(`Failed to upload ${file.name}: ${err.response?.data?.error || err.message}`);
      }
    }

    setUploading(false);

    if (onUploadComplete && uploadedFiles.length > 0) {
      onUploadComplete(uploadedFiles);
    }
  };

  const pendingCount = pendingList.length;

  return (
    <div className="simple-upload">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled || uploading}
      />

      <button
        type="button"
        className="btn btn-attachment"
        onClick={handleClick}
        disabled={disabled || uploading}
      >
        {uploading ? '⏳ Uploading...' : '📎 Add Attachment'}
      </button>

      {!bugId && pendingCount === 0 && (
        <span className="upload-hint pending-attachments-hint">
          Files will upload when you save the bug
        </span>
      )}

      {onInsertDescriptionLink && (
        <div className="file-upload-options">
          <label>
            <input
              type="checkbox"
              checked={addLinkInDescription}
              onChange={(e) => setAddLinkInDescription(e.target.checked)}
            />
            Add link in description for documents
          </label>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="pending-attachments-list">
          <strong>{pendingCount} file(s) queued</strong> — will upload on save
          <ul>
            {pendingList.map((name, i) => (
              <li key={`${name}-${i}`}>{name}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <span className="upload-error">{error}</span>}
    </div>
  );
});

export default FileUpload;
