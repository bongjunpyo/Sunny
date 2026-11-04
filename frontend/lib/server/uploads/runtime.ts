import "server-only";
import { getAuth } from "../auth.ts";
import { createRuntimePool, verifyRuntimePool } from "../postgres.ts";
import { createPhotoRepository } from "./repository.ts";
import { createUploadService, type UploadService } from "./service.ts";
import { createR2Storage, r2Config } from "./storage.ts";
import { UploadError, uploadFailure } from "./policy.ts";
import { handleUpload } from "./handler.ts";

let pending: Promise<UploadService> | undefined;
export function uploadDevelopmentEnabled(env: NodeJS.ProcessEnv) {
  try {
    const origin = new URL(env.BETTER_AUTH_URL ?? "");
    return env.PHOTO_UPLOAD_ENABLED === "true" && env.AUTH_ENABLED === "true" && env.NODE_ENV === "development"
      && origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  } catch { return false; }
}
async function getUploadService() {
  if (!pending) {
    pending = (async () => {
      const config = r2Config(process.env);
      if (!process.env.DATABASE_URL) throw new UploadError("UPLOAD_STORAGE_UNAVAILABLE");
      const pool = createRuntimePool(process.env.DATABASE_URL, "sunny_app");
      pool.on("error", () => { /* No connection string or SQL parameters in logs. */ });
      try {
        await verifyRuntimePool(pool, "sunny_app");
        return createUploadService(createPhotoRepository(pool), createR2Storage(config));
      } catch (error) { await pool.end(); throw error; }
    })().catch((error: unknown) => { pending = undefined; throw error; });
  }
  return pending;
}
export async function uploadRoute(request: Request, action: "rules" | "presign" | "complete" | "read-url", assetId?: string) {
  try {
    return await handleUpload(request, action, {
      baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
      enabled: uploadDevelopmentEnabled(process.env), service: getUploadService,
      identity: async headers => {
        const session = await (await getAuth()).api.getSession({ headers, query: { disableCookieCache: true } });
        return session?.user ?? null;
      },
    }, assetId);
  } catch (error) { return uploadFailure(error); }
}
