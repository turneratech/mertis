/**
 * LocalProvider - Local filesystem storage provider
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class LocalProvider {
  constructor(config) {
    this.name = 'local';
    this.basePath = config.basePath || './uploads';
    this.baseUrl = config.baseUrl || '/uploads';
    
    this._ensureDirectory(this.basePath);
  }

  _ensureDirectory(dirPath) {
    if (!fsSync.existsSync(dirPath)) {
      fsSync.mkdirSync(dirPath, { recursive: true });
    }
  }

  _getFullPath(storagePath) {
    return path.join(this.basePath, storagePath);
  }

  _getUrl(storagePath) {
    return `${this.baseUrl}/${storagePath}`.replace(/\/+/g, '/');
  }

  async upload(options) {
    const { file, storagePath, mimeType, metadata = {} } = options;
    const fullPath = this._getFullPath(storagePath);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    this._ensureDirectory(dir);

    // Write file
    await fs.writeFile(fullPath, file);

    // Write metadata
    const metadataPath = `${fullPath}.meta.json`;
    await fs.writeFile(metadataPath, JSON.stringify({
      mimeType,
      size: file.length,
      uploadedAt: new Date().toISOString(),
      ...metadata
    }, null, 2));

    return {
      url: this._getUrl(storagePath),
      storagePath,
      metadata
    };
  }

  async download(storagePath) {
    const fullPath = this._getFullPath(storagePath);
    const metadataPath = `${fullPath}.meta.json`;

    const file = await fs.readFile(fullPath);
    
    let metadata = {};
    let mimeType = 'application/octet-stream';
    
    try {
      const metaContent = await fs.readFile(metadataPath, 'utf8');
      metadata = JSON.parse(metaContent);
      mimeType = metadata.mimeType || mimeType;
    } catch (e) {
      // Metadata file may not exist
    }

    return { file, mimeType, size: file.length, metadata };
  }

  async getSignedUrl(storagePath, expiresIn = 3600, originalFileName = null) {
    // For local storage, return regular URL (filename handled by web server)
    return this._getUrl(storagePath);
  }

  async delete(storagePath) {
    const fullPath = this._getFullPath(storagePath);
    const metadataPath = `${fullPath}.meta.json`;

    try {
      await fs.unlink(fullPath);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }

    try {
      await fs.unlink(metadataPath);
    } catch (e) {
      // Metadata file may not exist
    }

    return true;
  }

  async list(folder = '') {
    const fullPath = this._getFullPath(folder);

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const items = [];
      
      for (const entry of entries) {
        if (entry.name.endsWith('.meta.json')) continue;

        const itemPath = folder ? `${folder}/${entry.name}` : entry.name;
        const fullItemPath = this._getFullPath(itemPath);

        if (entry.isDirectory()) {
          items.push({ name: entry.name, path: itemPath, isFolder: true });
        } else {
          const stats = await fs.stat(fullItemPath);
          let metadata = {};
          try {
            const metaContent = await fs.readFile(`${fullItemPath}.meta.json`, 'utf8');
            metadata = JSON.parse(metaContent);
          } catch (e) {}

          items.push({
            name: entry.name,
            path: itemPath,
            size: stats.size,
            lastModified: stats.mtime,
            isFolder: false,
            mimeType: metadata.mimeType
          });
        }
      }

      return items;
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  }

  async exists(storagePath) {
    const fullPath = this._getFullPath(storagePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = LocalProvider;
