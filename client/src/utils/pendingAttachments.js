import { uploadAttachment } from './attachmentUpload';

/**
 * In-memory queue for files selected before a bug exists (create flow).
 */
const pendingFiles = [];

export function queuePendingFile(file) {
  pendingFiles.push(file);
  return pendingFiles.length;
}

export function getPendingFiles() {
  return [...pendingFiles];
}

export function clearPendingFiles() {
  pendingFiles.length = 0;
}

export function getPendingFileCount() {
  return pendingFiles.length;
}

/**
 * Upload all queued files once bugId is available.
 * @returns {Promise<object[]>} uploaded attachment records
 */
export async function flushPendingFiles(bugId, provider, maxBytes = 25 * 1024 * 1024) {
  if (!bugId || pendingFiles.length === 0) return [];

  const files = [...pendingFiles];
  clearPendingFiles();

  const uploaded = [];
  for (const file of files) {
    if (file.size > maxBytes) continue;
    try {
      const attachment = await uploadAttachment(bugId, file, provider);
      uploaded.push(attachment);
    } catch (err) {
      console.error('Pending upload failed:', file.name, err.message);
    }
  }
  return uploaded;
}
