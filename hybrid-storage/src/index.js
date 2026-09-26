/**
 * Hybrid Cloud Storage Module
 * Supports AWS S3, Microsoft SharePoint, Azure Blob, and Local filesystem
 */

const StorageManager = require('./core/StorageManager');
const LocalProvider = require('./providers/LocalProvider');

// Optional providers - load if available
let S3Provider, SharePointProvider, AzureBlobProvider;

try {
  S3Provider = require('./providers/S3Provider');
} catch (e) {
  console.log('[Storage] S3Provider not available');
}

try {
  SharePointProvider = require('./providers/SharePointProvider');
} catch (e) {
  console.log('[Storage] SharePointProvider not available');
}

try {
  AzureBlobProvider = require('./providers/AzureBlobProvider');
  console.log('[Storage] AzureBlobProvider loaded');
} catch (e) {
  console.log('[Storage] AzureBlobProvider not available:', e.message);
}

module.exports = {
  StorageManager,
  LocalProvider,
  S3Provider,
  SharePointProvider,
  AzureBlobProvider,
  
  /**
   * Quick setup helper - creates a configured StorageManager
   */
  createStorage: (config) => {
    const manager = new StorageManager();
    
    // Always register local
    if (config.local) {
      manager.registerProvider('local', new LocalProvider(config.local));
    }
    
    // Register S3 if configured and available
    if (config.s3 && S3Provider) {
      try {
        manager.registerProvider('s3', new S3Provider(config.s3));
      } catch (e) {
        console.error('[Storage] Failed to register S3:', e.message);
      }
    }
    
    // Register SharePoint if configured and available
    if (config.sharepoint && SharePointProvider) {
      try {
        manager.registerProvider('sharepoint', new SharePointProvider(config.sharepoint));
      } catch (e) {
        console.error('[Storage] Failed to register SharePoint:', e.message);
      }
    }
    
    // Register Azure if configured and available
    if (config.azure && AzureBlobProvider) {
      try {
        manager.registerProvider('azure', new AzureBlobProvider(config.azure));
        console.log('[Storage] Azure Blob provider registered successfully');
      } catch (e) {
        console.error('[Storage] Failed to register Azure:', e.message);
      }
    } else if (config.azure && !AzureBlobProvider) {
      console.error('[Storage] Azure config provided but AzureBlobProvider not loaded');
    }
    
    // Set default provider
    if (config.default) {
      manager.setDefault(config.default);
    }
    
    return manager;
  }
};
