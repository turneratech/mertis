/**
 * S3Provider - AWS S3 storage provider
 */

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

class S3Provider {
  constructor(config) {
    this.name = 's3';
    this.bucket = config.bucket;
    this.region = config.region || 'us-east-1';
    this.baseFolder = config.baseFolder || '';

    const clientConfig = { region: this.region };

    // Add credentials if provided (otherwise uses IAM role)
    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      };
    }

    // Custom endpoint for S3-compatible services (MinIO, etc.)
    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
      clientConfig.forcePathStyle = config.forcePathStyle !== false;
    }

    this.client = new S3Client(clientConfig);
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

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fullPath,
      Body: file,
      ContentType: mimeType,
      Metadata: this._sanitizeMetadata(metadata)
    });

    await this.client.send(command);

    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${fullPath}`;

    return { url, storagePath: fullPath, metadata };
  }

  async download(storagePath) {
    const fullPath = this._getFullPath(storagePath);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullPath
    });

    const response = await this.client.send(command);
    
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const file = Buffer.concat(chunks);

    return {
      file,
      mimeType: response.ContentType,
      size: response.ContentLength,
      metadata: response.Metadata
    };
  }

  async getSignedUrl(storagePath, expiresIn = 3600) {
    const fullPath = this._getFullPath(storagePath);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullPath
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }

  async delete(storagePath) {
    const fullPath = this._getFullPath(storagePath);

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: fullPath
    });

    await this.client.send(command);
    return true;
  }

  async list(folder = '') {
    const prefix = this._getFullPath(folder);

    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix ? `${prefix}/` : '',
      Delimiter: '/'
    });

    const response = await this.client.send(command);

    const files = (response.Contents || []).map(item => ({
      name: item.Key.split('/').pop(),
      path: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
      isFolder: false
    }));

    const folders = (response.CommonPrefixes || []).map(item => ({
      name: item.Prefix.replace(/\/$/, '').split('/').pop(),
      path: item.Prefix,
      isFolder: true
    }));

    return [...folders, ...files];
  }

  async exists(storagePath) {
    const fullPath = this._getFullPath(storagePath);

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fullPath
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  _sanitizeMetadata(metadata) {
    const sanitized = {};
    for (const [key, value] of Object.entries(metadata)) {
      const sanitizedKey = key.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      sanitized[sanitizedKey] = String(value);
    }
    return sanitized;
  }
}

module.exports = S3Provider;
