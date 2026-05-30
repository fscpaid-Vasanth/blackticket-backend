import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>("storage.s3Bucket");

    this.client = new S3Client({
      region: this.config.get<string>("storage.awsRegion"),
      credentials: {
        accessKeyId: this.config.get<string>("storage.awsAccessKeyId"),
        secretAccessKey: this.config.get<string>("storage.awsSecretAccessKey"),
      },
    });

    this.logger.log(
      `[S3] Initialized — bucket: ${this.bucket}, region: ${this.config.get("storage.awsRegion")}`
    );
  }

  // Upload a Buffer or Stream to S3 — returns the S3 object key
  async upload(
    key: string,
    body: Buffer | Readable,
    mimeType: string
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        ServerSideEncryption: "AES256",
      })
    );
    this.logger.log(`[S3] Uploaded object: ${key}`);
    return key;
  }

  // Generate a pre-signed download URL (valid for 1 hour by default)
  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
    this.logger.log(`[S3] Generated signed URL for: ${key}`);
    return url;
  }

  // Delete an object from S3
  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
    this.logger.log(`[S3] Deleted object: ${key}`);
  }
}
