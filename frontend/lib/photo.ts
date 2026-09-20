/** 커스텀 사진 규칙 — **회의 전 임시값이다.**
 *
 *  확정되면 서버가 `photoRules` 로 내려주고, 화면은 그 값을 그대로 쓴다.
 *  그때까지는 이 파일 한 곳만 고치면 된다 → 이슈 #26 (서버 검사)
 *
 *  화면 검사는 편의일 뿐이다. **진짜 검사는 서버가 한다.** */

export interface PhotoRules {
  /** 받는 형식 (MIME) */
  accept: string[];
  maxBytes: number;
  minWidth: number;
  minHeight: number;
  /** 회의에서 확정되기 전이면 true — 화면에 임시값이라고 알린다 */
  provisional: boolean;
}

export const PHOTO_RULES: PhotoRules = {
  accept: ["image/jpeg", "image/png"],
  maxBytes: 10 * 1024 * 1024,
  minWidth: 1000,
  minHeight: 1000,
  provisional: true,
};

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / 1024 / 1024) * 10) / 10}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

export function describeRules(rules: PhotoRules = PHOTO_RULES): string {
  const kinds = rules.accept.map((type) => type.replace("image/", "").toUpperCase()).join(" · ");
  return `${kinds} · ${formatBytes(rules.maxBytes)} 이하 · ${rules.minWidth}×${rules.minHeight}px 이상`;
}

/** 파일 자체를 열기 전에 알 수 있는 것부터 본다 (형식 · 용량). */
export function checkPhotoFile(
  file: { type: string; size: number; name: string },
  rules: PhotoRules = PHOTO_RULES
): string | null {
  if (!rules.accept.includes(file.type)) {
    const kinds = rules.accept.map((type) => type.replace("image/", "").toUpperCase()).join(" · ");
    return `${kinds} 형식만 넣을 수 있습니다.`;
  }
  if (file.size > rules.maxBytes) {
    return `파일이 ${formatBytes(rules.maxBytes)}보다 큽니다. (${formatBytes(file.size)})`;
  }
  if (file.size === 0) return "빈 파일입니다.";
  return null;
}

/** 실제로 이미지로 열린 다음에 보는 것 (해상도). 확장자만 바꾼 파일도 여기서 걸린다. */
export function checkPhotoSize(
  width: number,
  height: number,
  rules: PhotoRules = PHOTO_RULES
): string | null {
  if (width < rules.minWidth || height < rules.minHeight) {
    return `사진이 작습니다. ${rules.minWidth}×${rules.minHeight}px 이상이 필요합니다. (지금 ${width}×${height}px)`;
  }
  return null;
}
