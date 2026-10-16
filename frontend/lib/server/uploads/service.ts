import "server-only";
import { inspectPhoto } from "./image.ts";
import { photoRules, UploadError, uploadPolicy, type PresignInput } from "./policy.ts";
import { photoResult, type PhotoRepository, type PhotoAsset } from "./repository.ts";
import type { PhotoStorage } from "./storage.ts";

let activeInspections = 0;
function finalState(asset: PhotoAsset) {
  if (asset.status === "verified") return photoResult(asset);
  if (asset.status === "expired") throw new UploadError("UPLOAD_EXPIRED");
  if (asset.status === "rejected") throw new UploadError(asset.rejection_code!);
}
export function createUploadService(repo: PhotoRepository, storage: PhotoStorage) {
  return {
    presign(owner: string, input: PresignInput) {
      return repo.presign(owner, input, (key, mime, date) => storage.signPut(key, mime, uploadPolicy.putSeconds, date));
    },
    async complete(owner: string, id: string) {
      const current = await repo.get(owner, id);
      const final = finalState(current);
      if (final) return final;
      if (activeInspections >= 2) throw new UploadError(current.status === "inspecting"
        ? "UPLOAD_INSPECTION_IN_PROGRESS" : "UPLOAD_STORAGE_UNAVAILABLE", 3);
      activeInspections++;
      try {
        const { asset, claimed } = await repo.claim(owner, id);
        const existing = finalState(asset);
        if (existing) return existing;
        if (!claimed || !asset.inspection_token) throw new UploadError("UPLOAD_STORAGE_UNAVAILABLE");
        const token = asset.inspection_token;
        try {
          const input = await storage.read(asset.pending_key, photoRules.maxBytes);
          const photo = await inspectPhoto(input, asset.declared_mime);
          await storage.write(`verified/${token}`, photo.data, photo.mimeType);
          return photoResult(await repo.finish(owner, id, token, photo));
        } catch (error) {
          const invalid = error instanceof UploadError && ["FILE_TOO_LARGE", "UNSUPPORTED_IMAGE_TYPE", "INVALID_IMAGE_FILE",
            "IMAGE_DIMENSIONS_TOO_SMALL", "IMAGE_ASPECT_RATIO_NOT_ALLOWED"].includes(error.code);
          try { await repo.fail(owner, id, token, invalid ? (error as UploadError).code : undefined); }
          catch { /* Lease recovery handles database outage. Never log bytes, credentials, URLs or raw errors. */ }
          if (invalid) throw error;
          throw new UploadError("UPLOAD_STORAGE_UNAVAILABLE");
        }
      } finally { activeInspections--; }
    },
    async readUrl(owner: string, id: string) {
      const asset = await repo.get(owner, id);
      if (asset.status === "expired") throw new UploadError("UPLOAD_EXPIRED");
      if (asset.status !== "verified" || !asset.verified_key) throw new UploadError("UPLOAD_NOT_VERIFIED");
      const now = new Date();
      return { readUrl: await storage.signGet(asset.verified_key, uploadPolicy.readSeconds, now),
        expiresAt: new Date(now.getTime() + uploadPolicy.readSeconds * 1000).toISOString() };
    },
  };
}
export type UploadService = ReturnType<typeof createUploadService>;
