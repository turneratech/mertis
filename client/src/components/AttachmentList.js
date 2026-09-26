import React, { useState } from 'react';
import axios from 'axios';

/**
 * Simple AttachmentList Component
 * Shows attachments as clickable links
 */
function AttachmentList({ bugId, attachments = [], onDelete, canDelete = false }) {
  const [loading, setLoading] = useState({});

  const handleOpen = async (attachment) => {
    setLoading(prev => ({ ...prev, [attachment.id]: true }));

    try {
      // For local storage, open directly
      if (attachment.provider === 'local' && attachment.url) {
        window.open(attachment.url, '_blank');
        setLoading(prev => ({ ...prev, [attachment.id]: false }));
        return;
      }

      // For cloud storage, get signed URL (pass original filename for proper Content-Disposition)
      const token = localStorage.getItem('token');
      const downloadUrl = `/api/attachments/download/${attachment.provider}/${attachment.storagePath}?filename=${encodeURIComponent(attachment.fileName)}`;
      const res = await axios.get(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Check if this is a proxy URL (requires streaming through backend)
      if (res.data.isProxy && res.data.url) {
        // For proxy URLs, fetch with auth and trigger download with correct filename
        const streamUrl = `${res.data.url}?filename=${encodeURIComponent(attachment.fileName)}`;
        const streamRes = await axios.get(streamUrl, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        });
        
        // Create blob and trigger download with original filename
        const blob = new Blob([streamRes.data], { type: attachment.mimeType || streamRes.data.type });
        const blobUrl = window.URL.createObjectURL(blob);
        
        // Always trigger download with correct filename
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = attachment.fileName; // Original filename
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up blob URL after a delay
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
      } else {
        // Regular signed URL - open directly in browser
        window.open(res.data.url, '_blank');
      }
    } catch (err) {
      alert('Could not open file: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(prev => ({ ...prev, [attachment.id]: false }));
    }
  };

  const handleDelete = async (attachment) => {
    if (!window.confirm(`Delete "${attachment.fileName}"?`)) return;

    setLoading(prev => ({ ...prev, [attachment.id]: true }));

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/attachments/${bugId}/${attachment.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (onDelete) onDelete(attachment);
    } catch (err) {
      alert('Delete failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(prev => ({ ...prev, [attachment.id]: false }));
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `(${bytes} B)`;
    if (bytes < 1024 * 1024) return `(${(bytes / 1024).toFixed(1)} KB)`;
    return `(${(bytes / (1024 * 1024)).toFixed(1)} MB)`;
  };

  // Using simple text labels to avoid encoding issues
  const getIcon = (fileName, mimeType) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '[IMG]';
    if (mimeType?.startsWith('video/') || ['mp4', 'avi', 'mov'].includes(ext)) return '[VID]';
    if (mimeType?.includes('pdf') || ext === 'pdf') return '[PDF]';
    if (['doc', 'docx'].includes(ext)) return '[DOC]';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '[XLS]';
    if (['zip', 'rar', '7z'].includes(ext)) return '[ZIP]';
    return '[FILE]';
  };

  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className="attachment-list">
      {attachments.map((att) => (
        <div key={att.id} className="attachment-row">
          <span 
            className="attachment-link"
            onClick={() => !loading[att.id] && handleOpen(att)}
          >
            {loading[att.id] ? '...' : getIcon(att.fileName, att.mimeType)} {att.fileName} 
            <span className="attachment-size">{formatSize(att.size)}</span>
          </span>
          
          {canDelete && (
            <button
              type="button"
              className="attachment-delete"
              onClick={() => handleDelete(att)}
              disabled={loading[att.id]}
              title="Delete"
            >
              X
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default AttachmentList;
