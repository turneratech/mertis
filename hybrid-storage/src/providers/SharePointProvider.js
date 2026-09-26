/**
 * SharePointProvider - Microsoft SharePoint storage provider
 */

const { Client } = require('@microsoft/microsoft-graph-client');
const { ConfidentialClientApplication } = require('@azure/msal-node');

class SharePointProvider {
  constructor(config) {
    this.name = 'sharepoint';
    
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tenantId = config.tenantId;
    this.siteId = config.siteId;
    this.siteName = config.siteName;
    this.domain = config.domain;
    this.driveId = config.driveId;
    this.baseFolder = config.baseFolder || '';

    this.msalConfig = {
      auth: {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        authority: `https://login.microsoftonline.com/${this.tenantId}`
      }
    };

    this.msalClient = new ConfidentialClientApplication(this.msalConfig);
    this.graphClient = null;
    this.resolvedSiteId = null;
    this.resolvedDriveId = null;
  }

  async _getAccessToken() {
    const result = await this.msalClient.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default']
    });
    return result.accessToken;
  }

  async _getClient() {
    if (!this.graphClient) {
      const token = await this._getAccessToken();
      this.graphClient = Client.init({
        authProvider: (done) => done(null, token)
      });
    }
    return this.graphClient;
  }

  async _resolveSiteId() {
    if (this.resolvedSiteId) return this.resolvedSiteId;
    if (this.siteId) {
      this.resolvedSiteId = this.siteId;
      return this.resolvedSiteId;
    }

    const client = await this._getClient();
    const site = await client
      .api(`/sites/${this.domain}:/sites/${this.siteName}`)
      .get();
    
    this.resolvedSiteId = site.id;
    return this.resolvedSiteId;
  }

  async _resolveDriveId() {
    if (this.resolvedDriveId) return this.resolvedDriveId;
    if (this.driveId) {
      this.resolvedDriveId = this.driveId;
      return this.resolvedDriveId;
    }

    const client = await this._getClient();
    const siteId = await this._resolveSiteId();
    const drive = await client.api(`/sites/${siteId}/drive`).get();
    
    this.resolvedDriveId = drive.id;
    return this.resolvedDriveId;
  }

  _getFullPath(storagePath) {
    if (this.baseFolder) {
      return `${this.baseFolder}/${storagePath}`.replace(/\/+/g, '/');
    }
    return storagePath;
  }

  async upload(options) {
    const { file, storagePath, mimeType, metadata = {} } = options;
    const fullPath = this._getFullPath(storagePath);

    const client = await this._getClient();
    const driveId = await this._resolveDriveId();

    const result = await client
      .api(`/drives/${driveId}/root:/${fullPath}:/content`)
      .put(file);

    return {
      url: result.webUrl,
      storagePath: fullPath,
      sharePointId: result.id,
      metadata: { ...metadata, sharePointId: result.id, webUrl: result.webUrl }
    };
  }

  async download(storagePath) {
    const fullPath = this._getFullPath(storagePath);
    const client = await this._getClient();
    const driveId = await this._resolveDriveId();

    const fileInfo = await client
      .api(`/drives/${driveId}/root:/${fullPath}`)
      .get();

    const downloadUrl = fileInfo['@microsoft.graph.downloadUrl'];
    const response = await fetch(downloadUrl);
    const arrayBuffer = await response.arrayBuffer();
    const file = Buffer.from(arrayBuffer);

    return {
      file,
      mimeType: fileInfo.file?.mimeType || 'application/octet-stream',
      size: fileInfo.size,
      metadata: { sharePointId: fileInfo.id, webUrl: fileInfo.webUrl }
    };
  }

  async getSignedUrl(storagePath, expiresIn = 3600) {
    const fullPath = this._getFullPath(storagePath);
    const client = await this._getClient();
    const driveId = await this._resolveDriveId();

    const fileInfo = await client
      .api(`/drives/${driveId}/root:/${fullPath}`)
      .select('@microsoft.graph.downloadUrl')
      .get();

    return fileInfo['@microsoft.graph.downloadUrl'];
  }

  async delete(storagePath) {
    const fullPath = this._getFullPath(storagePath);
    const client = await this._getClient();
    const driveId = await this._resolveDriveId();

    await client.api(`/drives/${driveId}/root:/${fullPath}`).delete();
    return true;
  }

  async list(folder = '') {
    const fullPath = this._getFullPath(folder);
    const client = await this._getClient();
    const driveId = await this._resolveDriveId();

    const apiPath = fullPath
      ? `/drives/${driveId}/root:/${fullPath}:/children`
      : `/drives/${driveId}/root/children`;

    const result = await client.api(apiPath).get();

    return result.value.map(item => ({
      name: item.name,
      path: fullPath ? `${fullPath}/${item.name}` : item.name,
      size: item.size,
      lastModified: item.lastModifiedDateTime,
      isFolder: !!item.folder,
      sharePointId: item.id,
      webUrl: item.webUrl,
      mimeType: item.file?.mimeType
    }));
  }

  async exists(storagePath) {
    const fullPath = this._getFullPath(storagePath);
    const client = await this._getClient();
    const driveId = await this._resolveDriveId();

    try {
      await client.api(`/drives/${driveId}/root:/${fullPath}`).get();
      return true;
    } catch (error) {
      if (error.statusCode === 404) return false;
      throw error;
    }
  }
}

module.exports = SharePointProvider;
