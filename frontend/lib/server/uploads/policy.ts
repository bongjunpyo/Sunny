import "server-only";
import { PHOTO_RULES } from "../../photo.ts";

export const photoRules = Object.freeze({ ...PHOTO_RULES, accept: Object.freeze([...PHOTO_RULES.accept]),
  aspectRatio: null, provisional: true });
// Development proposals, not approved production policy. See backend/uploads/contract-review.md.
export const uploadPolicy = Object.freeze({ putSeconds: 300, readSeconds: 300, completeSeconds: 900,
  leaseSeconds: 120, maxPixels: 40_000_000, maxSide: 8000, ioSeconds: 15, decodeSeconds: 15 });
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const errors = {
  INVALID_UPLOAD_REQUEST: [400, "사진 업로드 요청을 확인해 주세요."],
  AUTHENTICATION_REQUIRED: [401, "로그인 또는 게스트 인증이 필요합니다."],
  UPLOAD_SESSION_NOT_ELIGIBLE: [403, "이메일 인증을 완료한 뒤 다시 로그인해 주세요."],
  UPLOAD_ORIGIN_REJECTED: [403, "허용되지 않은 요청입니다."],
  UPLOAD_NOT_FOUND: [404, "사진을 찾을 수 없습니다."],
  UPLOAD_INSPECTION_IN_PROGRESS: [409, "사진을 확인하고 있습니다. 잠시 후 다시 확인해 주세요."],
  UPLOAD_NOT_VERIFIED: [409, "확인이 끝난 사진만 사용할 수 있습니다."],
  UPLOAD_EXPIRED: [410, "사진 업로드 기한이 지났습니다. 다시 업로드해 주세요."],
  FILE_TOO_LARGE: [413, "사진 또는 요청 크기가 허용 기준을 초과했습니다."],
  UNSUPPORTED_IMAGE_TYPE: [415, "JPEG 또는 PNG 사진만 업로드할 수 있습니다."],
  INVALID_IMAGE_FILE: [422, "사진 파일을 확인할 수 없습니다."],
  IMAGE_DIMENSIONS_TOO_SMALL: [422, "사진 해상도가 최소 기준보다 작습니다."],
  IMAGE_ASPECT_RATIO_NOT_ALLOWED: [422, "사진 비율이 허용 범위를 벗어났습니다."],
  UPLOAD_RATE_LIMITED: [429, "사진 업로드 요청이 많습니다. 잠시 후 다시 시도해 주세요."],
  UPLOAD_STORAGE_UNAVAILABLE: [503, "사진 업로드를 준비할 수 없습니다. 잠시 후 다시 시도해 주세요."],
} as const;
export type UploadErrorCode = keyof typeof errors;
export class UploadError extends Error {
  readonly code: UploadErrorCode;
  readonly retryAfter?: number;
  constructor(code: UploadErrorCode, retryAfter?: number) { super(code); this.code = code; this.retryAfter = retryAfter; }
}
export function json(value: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff", ...extra } });
}
export function uploadFailure(error: unknown) {
  const safe = error instanceof UploadError ? error : new UploadError("UPLOAD_STORAGE_UNAVAILABLE");
  const [status, message] = errors[safe.code];
  return json({ error: { code: safe.code, message } }, status,
    safe.retryAfter ? { "Retry-After": String(safe.retryAfter) } : {});
}
export type PresignInput = { purpose: "custom_order_photo"; fileName: string; mimeType: string; size: number };
export function parsePresign(value: unknown): PresignInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new UploadError("INVALID_UPLOAD_REQUEST");
  const b = value as Record<string, unknown>;
  if (Object.keys(b).sort().join(",") !== "fileName,mimeType,purpose,size" || b.purpose !== "custom_order_photo"
    || typeof b.fileName !== "string" || !b.fileName.trim() || b.fileName.length > 255 || /[\x00-\x1f\x7f]/.test(b.fileName)
    || typeof b.mimeType !== "string" || !Number.isSafeInteger(b.size) || Number(b.size) < 1) {
    throw new UploadError("INVALID_UPLOAD_REQUEST");
  }
  if (!photoRules.accept.includes(b.mimeType)) throw new UploadError("UNSUPPORTED_IMAGE_TYPE");
  if (Number(b.size) > photoRules.maxBytes) throw new UploadError("FILE_TOO_LARGE");
  return b as PresignInput;
}
