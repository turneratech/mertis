/**
 * BaseProvider - Abstract base class for all storage providers
 * 
 * All storage providers must implement these methods.
 */

class BaseProvider {
  constructor(config) {
    this.config = config;
    this.name = 'base';
    
    if (this.constructor === BaseProvider) {
      throw new Error('BaseProvider is abstract and cannot be instantiated directly');
    }
  }

  /**
   * Upload a file to storage
   * @param {Object} options
   * @param {Buffer|Stream} options.file - File content
   * @param {string} options.storagePath - Path in storage
   * @param {string} options.mimeType - MIME type
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} Upload result
   */
  async upload(options) {
    throw new Error('Method upload() must be implemented');
  }

  /**
   * Download a file from storage
   * @param {string} storagePath - Path in storage
   * @returns {Promise<Object>} { file: Buffer, mimeType: string }
   */
  async download(storagePath) {
    throw new Error('Method download() must be implemented');
  }

  /**
   * Get a signed/temporary URL for file access
   * @param {string} storagePath - Path in storage
   * @param {number} expiresIn - Expiration in seconds
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(storagePath, expiresIn) {
    throw new Error('Method getSignedUrl() must be implemented');
  }

  /**
   * Delete a file from storage
   * @param {string} storagePath - Path in storage
   * @returns {Promise<boolean>}
   */
  async delete(storagePath) {
    throw new Error('Method delete() must be implemented');
  }

  /**
   * List files in a folder
   * @param {string} folder - Folder path
   * @returns {Promise<Array>}
   */
  async list(folder) {
    throw new Error('Method list() must be implemented');
  }

  /**
   * Check if a file exists
   * @param {string} storagePath - Path in storage
   * @returns {Promise<boolean>}
   */
  async exists(storagePath) {
    throw new Error('Method exists() must be implemented');
  }

  /**
   * Get file metadata
   * @param {string} storagePath - Path in storage
   * @returns {Promise<Object>}
   */
  async getMetadata(storagePath) {
    throw new Error('Method getMetadata() must be implemented');
  }

  /**
   * Initialize the provider (optional)
   * @returns {Promise<void>}
   */
  async initialize() {
    // Override if needed
  }

  /**
   * Test connection to provider
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    throw new Error('Method testConnection() must be implemented');
  }
}

module.exports = BaseProvider;
