import "server-only";
import { photoRules, parsePresign, uuidPattern, UploadError, uploadFailure, json } from "./policy.ts";
import type { UploadService } from "./service.ts";

export type UploadIdentity = { id: string; isAnonymous?: boolean | null; emailVerified: boolean };
export type UploadDependencies = {
  baseURL: string;
  enabled: boolean;
  identity: (headers: Headers) => Promise<UploadIdentity | null>;
  service: () => Promise<UploadService>;
};
async function readBody(request: Request, maxBytes: number) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new UploadError("FILE_TOO_LARGE");
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function handleUpload(request: Request, action: "rules" | "presign" | "complete" | "read-url",
  dependencies: UploadDependencies, assetId?: string) {
  try {
    if (action === "rules") return json({ photoRules });
    if (request.headers.get("origin") !== new URL(dependencies.baseURL).origin
      || request.headers.get("sec-fetch-site") === "cross-site") throw new UploadError("UPLOAD_ORIGIN_REJECTED");
    if (!dependencies.enabled) throw new UploadError("UPLOAD_STORAGE_UNAVAILABLE");
    const user = await dependencies.identity(request.headers);
    if (!user || !uuidPattern.test(user.id)) throw new UploadError("AUTHENTICATION_REQUIRED");
    if (user.isAnonymous !== true && user.emailVerified !== true) throw new UploadError("UPLOAD_SESSION_NOT_ELIGIBLE");
    if (action === "presign") {
      if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
        throw new UploadError("INVALID_UPLOAD_REQUEST");
      }
      const raw = await readBody(request, 2048);
      let body: unknown;
      try { body = JSON.parse(raw); } catch { throw new UploadError("INVALID_UPLOAD_REQUEST"); }
      const input = parsePresign(body);
      return json(await (await dependencies.service()).presign(user.id, input), 201);
    }
    if (!assetId || !uuidPattern.test(assetId) || (await readBody(request, 1)).length) throw new UploadError("INVALID_UPLOAD_REQUEST");
    const service = await dependencies.service();
    return json(action === "complete" ? await service.complete(user.id, assetId) : await service.readUrl(user.id, assetId));
  } catch (error) { return uploadFailure(error); }
}
