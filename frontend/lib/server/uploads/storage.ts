import "server-only";
import { S3Client, GetObjectCommand, PutObjectCommand, type GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UploadError, uploadPolicy } from "./policy.ts";

export interface PhotoStorage {
  signPut(key: string, mimeType: string, expiresIn: number, signingDate: Date): Promise<string>;
  read(key: string, maxBytes: number): Promise<Buffer>;
  write(key: string, data: Buffer, mimeType: string): Promise<void>;
  signGet(key: string, expiresIn: number, signingDate: Date): Promise<string>;
}
export type R2Config = { accountId: string; bucket: string; accessKeyId: string; secretAccessKey: string };
export function r2Config(env: NodeJS.ProcessEnv): R2Config {
  const { R2_ACCOUNT_ID: accountId, R2_BUCKET_NAME: bucket, R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey } = env;
  if (!accountId || !/^[a-f0-9]{32}$/.test(accountId) || !bucket || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)
    || !accessKeyId || !secretAccessKey) throw new UploadError("UPLOAD_STORAGE_UNAVAILABLE");
  return { accountId, bucket, accessKeyId, secretAccessKey };
}
export function createR2Storage(config: R2Config): PhotoStorage {
  const client = new S3Client({ region: "auto", endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED", maxAttempts: 1 });
  return {
    async signPut(key, mimeType, expiresIn, signingDate) {
      return getSignedUrl(client, new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: mimeType }),
        { expiresIn, signingDate, signableHeaders: new Set(["content-type"]) });
    },
    async read(key, maxBytes) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), uploadPolicy.ioSeconds * 1000);
      let body: GetObjectCommandOutput | undefined;
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal: controller.signal });
        body = result;
        if ((result.ContentLength ?? 0) > maxBytes) throw new UploadError("FILE_TOO_LARGE");
        if (!result.Body) throw new UploadError("UPLOAD_STORAGE_UNAVAILABLE");
        return await boundedObjectRead(result.Body as AsyncIterable<Uint8Array>, maxBytes);
      } finally {
        clearTimeout(timer);
        controller.abort();
        const stream = body?.Body as { destroy?: () => void } | undefined;
        stream?.destroy?.();
      }
    },
    async write(key, data, mimeType) {
      await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: data, ContentType: mimeType,
        CacheControl: "no-store", ContentDisposition: "inline" }), { abortSignal: AbortSignal.timeout(uploadPolicy.ioSeconds * 1000) });
    },
    async signGet(key, expiresIn, signingDate) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: key,
        ResponseCacheControl: "no-store", ResponseContentDisposition: "inline" }), { expiresIn, signingDate });
    },
  };
}

export async function boundedObjectRead(stream: AsyncIterable<Uint8Array>, maxBytes: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.byteLength;
    if (size > maxBytes) throw new UploadError("FILE_TOO_LARGE");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks, size);
}
