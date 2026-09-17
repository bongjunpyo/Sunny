/** 스크롤 진행률 하나로 태양의 가로 위치와 배율을 정한다.
 *  수치의 원본은 docs/design/brand-preview.html 이고,
 *  설계 근거는 docs/superpowers/specs/2026-09-18-main-page-design.md 다. */

export interface SunTransform {
  /** 화면 가로 기준 태양 중심 위치 (%) */
  xPercent: number;
  /** 태양 배율 — 1 에서 시작해 정면으로 확대된다 */
  scale: number;
}

export const SUN_START_X = { desktop: 78, mobile: 92 } as const;
const SUN_CENTER_X = 50;

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function sunTransform(progress: number, isMobile = false): SunTransform {
  const p = clamp01(progress);
  const start = isMobile ? SUN_START_X.mobile : SUN_START_X.desktop;

  // 0 → .38 : 오른쪽에서 가운데로
  const xPercent = start - (start - SUN_CENTER_X) * clamp01(p / 0.38);
  // .32 → .82 : 가운데에 고정한 채 정면으로 확대 (회전·궤도 이동 없음)
  const scale = 1 + Math.pow(clamp01((p - 0.32) / 0.5), 2) * 6;

  return { xPercent, scale };
}
