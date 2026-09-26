import axios from 'axios';

/**
 * Upload a file to a bug via the attachments API.
 */
export async function uploadAttachment(bugId, file, provider = 'local') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('provider', provider);

  const token = localStorage.getItem('token');
  const res = await axios.post(`/api/attachments/${bugId}`, formData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

export function isImageFile(file) {
  return file.type?.startsWith('image/');
}

export async function fetchDefaultProvider() {
  try {
    const token = localStorage.getItem('token');
    const res = await axios.get('/api/attachments/providers', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const providers = res.data.providers || [];
    const configured = res.data.default || 'local';
    if (providers.includes(configured)) return configured;
    if (providers.includes('azure')) return 'azure';
    if (providers.includes('s3')) return 's3';
    if (providers.includes('sharepoint')) return 'sharepoint';
    return providers[0] || 'local';
  } catch {
    return 'local';
  }
}

/**
 * Load attachment bytes as an object URL (for inline img in editor/viewer).
 */
export async function loadAttachmentObjectUrl(bugId, attachmentId) {
  const token = localStorage.getItem('token');
  const listRes = await axios.get(`/api/attachments/${bugId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const attachment = (listRes.data.attachments || []).find(a => a.id === attachmentId);
  if (!attachment) return null;

  if (attachment.provider === 'local' && attachment.url) {
    return attachment.url;
  }

  const downloadUrl = `/api/attachments/download/${attachment.provider}/${attachment.storagePath}?filename=${encodeURIComponent(attachment.fileName)}`;
  const res = await axios.get(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.data.isProxy && res.data.url) {
    const streamUrl = `${res.data.url}?filename=${encodeURIComponent(attachment.fileName)}`;
    const streamRes = await axios.get(streamUrl, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob'
    });
    return window.URL.createObjectURL(streamRes.data);
  }
  if (res.data.url) return res.data.url;
  return null;
}

export async function openAttachmentById(bugId, attachmentId) {
  const token = localStorage.getItem('token');
  const listRes = await axios.get(`/api/attachments/${bugId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const attachment = (listRes.data.attachments || []).find(a => a.id === attachmentId);
  if (!attachment) throw new Error('Attachment not found');

  if (attachment.provider === 'local' && attachment.url) {
    window.open(attachment.url, '_blank');
    return;
  }

  const downloadUrl = `/api/attachments/download/${attachment.provider}/${attachment.storagePath}?filename=${encodeURIComponent(attachment.fileName)}`;
  const res = await axios.get(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.data.isProxy && res.data.url) {
    const streamUrl = `${res.data.url}?filename=${encodeURIComponent(attachment.fileName)}`;
    const streamRes = await axios.get(streamUrl, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob'
    });
    const blobUrl = window.URL.createObjectURL(streamRes.data);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = attachment.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
  } else if (res.data.url) {
    window.open(res.data.url, '_blank');
  }
}
