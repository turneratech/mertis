/**
 * StorageManager - Core class managing multiple storage providers
 */

const { v4: uuidv4 } = require('uuid');

class StorageManager {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = null;
  }

  /**
   * Register a storage provider
   */
  registerProvider(name, provider) {
    this.providers.set(name, provider);
    if (!this.defaultProvider) {
      this.defaultProvider = name;
    }
    console.log(`[Storage] Registered provider: ${name}`);
    return this;
  }

  /**
   * Set the default provider
   */
  setDefault(name) {
    if (!this.providers.has(name)) {
      throw new Error(`Provider '${name}' not registered`);
    }
    this.defaultProvider = name;
    return this;
  }

  /**
   * Get a provider by name
   */
  getProvider(name = null) {
    const providerName = name || this.defaultProvider;
    if (!providerName) {
      throw new Error('No storage provider configured');
    }
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider '${providerName}' not found`);
    }
    return provider;
  }

  /**
   * List all registered providers
   */
  listProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Upload a file
   */
  async upload(options) {
    const {
      file,
      fileName,
      mimeType,
      folder = '',
      metadata = {},
      provider: providerName
    } = options;

    const provider = this.getProvider(providerName);
    
    const fileId = uuidv4();
    const timestamp = Date.now();
    const safeFileName = this._sanitizeFileName(fileName);
    const storagePath = folder 
      ? `${folder}/${timestamp}_${safeFileName}` 
      : `${timestamp}_${safeFileName}`;

    const result = await provider.upload({
      fileId,
      file,
      fileName: safeFileName,
      storagePath,
      mimeType,
      metadata: {
        ...metadata,
        originalName: fileName,
        uploadedAt: new Date().toISOString(),
        fileId
      }
    });

    return {
      id: fileId,
      provider: providerName || this.defaultProvider,
      fileName: safeFileName,
      originalName: fileName,
      storagePath,
      mimeType,
      size: file.length || file.size,
      url: result.url,
      metadata: result.metadata,
      uploadedAt: new Date().toISOString()
    };
  }

  /**
   * Download a file
   */
  async download(storagePath, providerName = null) {
    const provider = this.getProvider(providerName);
    return await provider.download(storagePath);
  }

  /**
   * Get a signed URL for temporary access
   */
  async getSignedUrl(storagePath, expiresIn = 3600, providerName = null, originalFileName = null) {
    const provider = this.getProvider(providerName);
    return await provider.getSignedUrl(storagePath, expiresIn, originalFileName);
  }

  /**
   * Delete a file
   */
  async delete(storagePath, providerName = null) {
    const provider = this.getProvider(providerName);
    return await provider.delete(storagePath);
  }

  /**
   * List files in a folder
   */
  async list(folder = '', providerName = null) {
    const provider = this.getProvider(providerName);
    return await provider.list(folder);
  }

  /**
   * Check if file exists
   */
  async exists(storagePath, providerName = null) {
    const provider = this.getProvider(providerName);
    return await provider.exists(storagePath);
  }

  /**
   * Sanitize file name
   */
  _sanitizeFileName(fileName) {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 255);
  }
}

module.exports = StorageManager;
