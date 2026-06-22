import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * StorageAdapter abstracts object storage so we can ship Cloudflare R2 today and
 * later let users "bring their own" S3-compatible bucket without touching any
 * call sites. Every adapter just needs to mint upload URLs and resolve public
 * URLs for a given key.
 */
export interface StorageAdapter {
  /** Presigned URL the browser can PUT the file to directly. */
  createUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<string>;
  /**
   * Direct public URL (only valid when the bucket/domain is configured for
   * public access). Prefer `createDownloadUrl` for private buckets.
   */
  getPublicUrl(key: string): string;
  /** Short-lived signed URL to GET a private object. */
  createDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  /** Remove an object. */
  delete(key: string): Promise<void>;
}

class R2StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl: string;

  constructor() {
    const accountId = required("R2_ACCOUNT_ID");
    this.bucket = required("R2_BUCKET");
    this.publicBaseUrl = required("R2_PUBLIC_BASE_URL").replace(/\/$/, "");
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
    });
  }

  async createUploadUrl({
    key,
    contentType,
    expiresInSeconds = 300,
  }: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  async createDownloadUrl(
    key: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required storage env var: ${name}`);
  }
  return value;
}

let cached: StorageAdapter | null = null;

/**
 * Returns the configured storage adapter. Defaults to Cloudflare R2.
 * A future "bring your own storage" mode would branch here on a per-tree or
 * per-user storage config and return a different S3-compatible adapter.
 */
export function getStorage(): StorageAdapter {
  if (!cached) {
    cached = new R2StorageAdapter();
  }
  return cached;
}
