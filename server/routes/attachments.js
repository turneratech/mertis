/**
 * Attachments Route - File upload/download API
 * Supports Local and Azure Blob Storage
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// ============================================
// AUTH MIDDLEWARE
// ============================================
// ============================================
// AUTH MIDDLEWARE
// ============================================
const { authMiddleware } = require('../middleware/auth');
const { enforceAttachmentSize } = require('../middleware/licenseValidator');
const deploymentConfig = require('../config/deployment.config');
const { getFileStorage, getFileStorageError } = require('../services/fileStorageService');


// ============================================
// DIRECT MYSQL UPDATE (bypasses storage module issues)
// ============================================
// Cache the bug ID column name
let bugIdColumn = null;

const detectBugIdColumn = async () => {
  if (bugIdColumn) return bugIdColumn;

  try {
    const storageMod = require('../storage');
    const getSqlDb = require('../storage/sqlDb');
    const { query } = getSqlDb();
    const isPostgres = storageMod.getStorageType() === 'postgres';

    if (isPostgres) {
      const rows = await query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'bugs' AND column_name IN ('bug_id', 'bugid', 'id')`
      );
      const names = rows.map(c => (c.column_name || '').toLowerCase());
      if (names.includes('bug_id')) bugIdColumn = 'bug_id';
      else if (names.includes('bugid')) bugIdColumn = 'bugId';
      else bugIdColumn = 'id';
      return bugIdColumn;
    }

    const dbName = deploymentConfig.getDatabaseConfig().mysql.database;
    const columns = await query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bugs'",
      [dbName]
    );

    const columnNames = columns.map(c => c.COLUMN_NAME.toLowerCase());
    if (columnNames.includes('bug_id')) bugIdColumn = 'bug_id';
    else if (columnNames.includes('bugid')) bugIdColumn = 'bugId';
    else if (columnNames.includes('id')) bugIdColumn = 'id';
    else bugIdColumn = 'bug_id';

    return bugIdColumn;
  } catch {
    return 'bug_id';
  }
};

const getBugById = async (bugId) => {
  try {
    const storage = require('../storage');
    return await storage.getBugById(bugId);
  } catch (err) {
    console.error('[Attachments] getBugById failed:', err.message);
    return null;
  }
};

const updateBugAttachments = async (bugId, attachmentsJson) => {
  try {
    const storage = require('../storage');
    if (storage.getStorageType() === 'csv') {
      console.warn('[Attachments] Attachment metadata requires MySQL or PostgreSQL storage backend');
      return false;
    }
    const getSqlDb = require('../storage/sqlDb');
    const { query } = getSqlDb();
    const column = await detectBugIdColumn();
    await query(
      `UPDATE bugs SET attachments = ?, updated_at = NOW() WHERE ${column} = ?`,
      [attachmentsJson, bugId]
    );
    console.log('[Attachments] Database updated for bug:', bugId);
    return true;
  } catch (err) {
    console.error('[Attachments] Update failed:', err.message);
    return false;
  }
};

// ============================================
// STORAGE (via centralized fileStorageService)
// ============================================

const initStorage = () => getFileStorage();
const storageError = () => getFileStorageError();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('[Attachments] Created uploads directory:', uploadsDir);
  } catch (err) {
    console.error('[Attachments] Could not create uploads directory:', err.message);
  }
}

// ============================================
// MULTER CONFIG
// ============================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const blocked = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.msi'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (blocked.includes(ext)) {
      return cb(new Error(`File type ${ext} not allowed`), false);
    }
    cb(null, true);
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

const parseAttachments = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try { return JSON.parse(data); } 
    catch { return []; }
  }
  return [];
};

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

// ============================================
// API ROUTES
// ============================================

/**
 * GET /api/attachments/providers
 * List available storage providers
 */
router.get('/providers', authMiddleware, (req, res) => {
  const storageInstance = initStorage();
  
  if (!storageInstance) {
    return res.json({ 
      providers: ['local'], 
      default: 'local',
      error: storageError() 
    });
  }
  
  res.json({
    providers: storageInstance.listProviders(),
    default: storageInstance.defaultProvider
  });
});

/**
 * POST /api/attachments/:bugId
 * Upload a file to a bug
 */
router.post('/:bugId', authMiddleware, upload.single('file'), enforceAttachmentSize, async (req, res) => {
  try {
    const storageInstance = initStorage();
    if (!storageInstance) {
      return res.status(500).json({ error: 'Storage not available: ' + storageError() });
    }

    const { bugId } = req.params;
    let provider = req.body.provider || storageInstance.defaultProvider;
    
    // Verify provider is registered
    const availableProviders = storageInstance.listProviders();
    if (!availableProviders.includes(provider)) {
      console.warn(`[Attachments] Provider '${provider}' not available, falling back to '${availableProviders[0]}'`);
      provider = availableProviders[0];
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    console.log(`[Attachments] Uploading ${req.file.originalname} to ${provider} for bug ${bugId}`);

    // Upload to storage
    const username = req.user?.username || 'system';
    const result = await storageInstance.upload({
      file: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      folder: `bugs/${bugId}`,
      metadata: { bugId, uploadedBy: username },
      provider
    });

    // Create attachment record
    const attachment = {
      id: result.id || uuidv4(),
      bugId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storagePath: result.storagePath,
      provider: result.provider || provider,
      url: result.url,
      uploadedBy: username,
      uploadedAt: new Date().toISOString()
    };

    console.log('[Attachments] File uploaded:', attachment.fileName, 'to', attachment.provider);

    // Update bug record with attachment metadata (direct MySQL)
    try {
      const bug = await getBugById(bugId);
      if (bug) {
        const existingAttachments = parseAttachments(bug.attachments);
        existingAttachments.push(attachment);
        const newAttachmentsJson = JSON.stringify(existingAttachments);
        
        const updated = await updateBugAttachments(bugId, newAttachmentsJson);
        if (!updated) {
          console.warn('[Attachments] Database update failed, but file uploaded successfully');
        }
      } else {
        console.warn('[Attachments] Bug not found:', bugId);
      }
    } catch (err) {
      console.error('[Attachments] Could not update bug record:', err.message);
    }

    res.status(201).json(attachment);
    
  } catch (error) {
    console.error('[Attachments] Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/attachments/:bugId
 * List attachments for a bug
 */
router.get('/:bugId', authMiddleware, async (req, res) => {
  try {
    const { bugId } = req.params;
    const bug = await getBugById(bugId);
    
    if (!bug) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    res.json({ attachments: parseAttachments(bug.attachments) });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/attachments/download/:provider/*
 * Get URL to open/view attachment (tries signed URL first, falls back to proxy)
 * Query params: ?filename=original.pdf (optional, for proper Content-Disposition)
 */
router.get('/download/:provider/*', authMiddleware, async (req, res) => {
  try {
    const storageInstance = initStorage();
    if (!storageInstance) {
      return res.status(500).json({ error: 'Storage not available' });
    }

    const provider = req.params.provider;
    const storagePath = req.params[0];
    const originalFileName = req.query.filename || null;

    if (!storagePath) {
      return res.status(400).json({ error: 'Path required' });
    }

    // Get signed URL (valid for 1 hour), pass original filename for Content-Disposition
    const url = await storageInstance.getSignedUrl(storagePath, 3600, provider, originalFileName);
    
    // Check if URL has proper authentication (SAS token for Azure)
    // If it's just a base URL without auth, use proxy endpoint instead
    if (provider === 'azure' && !url.includes('?')) {
      // No SAS token in URL, use proxy streaming instead
      const proxyUrl = `/api/attachments/stream/${provider}/${storagePath}`;
      return res.json({ 
        url: proxyUrl, 
        expiresIn: null,
        openInBrowser: true,
        isProxy: true
      });
    }
    
    res.json({ 
      url, 
      expiresIn: 3600,
      openInBrowser: true
    });
    
  } catch (error) {
    console.error('[Attachments] Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/attachments/stream/:provider/*
 * Stream file directly through server (for private storage without public URLs)
 */
router.get('/stream/:provider/*', authMiddleware, async (req, res) => {
  try {
    const storageInstance = initStorage();
    if (!storageInstance) {
      return res.status(500).json({ error: 'Storage not available' });
    }

    const provider = req.params.provider;
    const storagePath = req.params[0];
    // Get original filename from query param, fallback to path
    const originalFileName = req.query.filename || storagePath.split('/').pop();

    if (!storagePath) {
      return res.status(400).json({ error: 'Path required' });
    }

    console.log(`[Attachments] Streaming file: ${storagePath} from ${provider}`);

    // Download file from storage
    const result = await storageInstance.download(storagePath, provider);
    
    if (!result || !result.file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Encode filename for Content-Disposition header (handle special characters)
    const encodedFileName = encodeURIComponent(originalFileName).replace(/['()]/g, escape);
    
    // Set appropriate headers
    res.set({
      'Content-Type': result.mimeType || 'application/octet-stream',
      'Content-Length': result.size || result.file.length,
      'Content-Disposition': `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
      'Cache-Control': 'private, max-age=3600'
    });

    // Stream the file
    res.send(result.file);
    
  } catch (error) {
    console.error('[Attachments] Stream error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/attachments/:bugId/:attachmentId
 * Delete an attachment
 */
router.delete('/:bugId/:attachmentId', authMiddleware, async (req, res) => {
  try {
    const storageInstance = initStorage();
    if (!storageInstance) {
      return res.status(500).json({ error: 'Storage not available' });
    }

    const { bugId, attachmentId } = req.params;
    
    const bug = await getBugById(bugId);
    if (!bug) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    const attachments = parseAttachments(bug.attachments);
    const index = attachments.findIndex(a => a.id === attachmentId);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = attachments[index];

    // Delete from storage
    try {
      await storageInstance.delete(attachment.storagePath, attachment.provider);
      console.log('[Attachments] Deleted from storage:', attachment.fileName);
    } catch (err) {
      console.error('[Attachments] Storage delete failed:', err.message);
    }

    // Update bug record
    attachments.splice(index, 1);
    const newAttachmentsJson = JSON.stringify(attachments);
    await updateBugAttachments(bugId, newAttachmentsJson);

    res.json({ message: 'Deleted' });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Multer error handler
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 25MB)' });
    }
    return res.status(400).json({ error: error.message });
  }
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  next();
});

module.exports = router;

