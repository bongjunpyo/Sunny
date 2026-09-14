// 광변색 비즈 데이터의 "모양"(타입). 모든 예제 페이지가 이 파일을 함께 쓴다.

export type PhotochromicColor = "violet" | "coral" | "sky"; // 이 3개 말고는 넣을 수 없음
export type Concentration = 3 | 6 | 9; // 염료 농도 wt%

export interface Bead {
  id: string;
  color: PhotochromicColor;
  concentration: Concentration;
  photo?: string; // ?가 붙으면 선택 항목 (사진 비즈일 때만)
}

export const BASE_WHITE = "#f7f4ee";

export const COLOR_HEX: Record<PhotochromicColor, string> = {
  violet: "#7b5cff",
  coral: "#ff5a4f",
  sky: "#2f98ff",
};

export const COLOR_LABEL: Record<PhotochromicColor, string> = {
  violet: "바이올렛",
  coral: "코랄",
  sky: "스카이",
};

// 농도가 높을수록 최대로 진해질 수 있는 정도
const CONCENTRATION_STRENGTH: Record<Concentration, number> = { 3: 0.45, 6: 0.72, 9: 1 };

// 자외선지수(0~11) → 발색 정도(0~1). 처음엔 빠르게 올라가다 점점 포화
export function activation(uvIndex: number): number {
  const uv = Math.min(Math.max(uvIndex, 0), 11);
  return 1 - Math.exp(-uv / 3);
}

export function beadStrength(bead: Pick<Bead, "concentration">, uvIndex: number): number {
  return activation(uvIndex) * CONCENTRATION_STRENGTH[bead.concentration];
}

export function activatedColor(bead: Bead, uvIndex: number): string {
  return mixHex(BASE_WHITE, COLOR_HEX[bead.color], beadStrength(bead, uvIndex));
}

// 광변색은 발색은 빠르고 흰색 복귀는 느리다 → 올라갈 때와 내려갈 때 속도를 다르게 보간
export function dampUv(current: number, target: number, dt: number): number {
  if (!(dt > 0)) return current; // 음수·NaN이면 지수가 커져 값이 폭주하므로 그대로 둔다
  const rate = target > current ? 3.5 : 0.9;
  return target + (current - target) * Math.exp(-rate * dt);
}

export function mixHex(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const k = Math.min(Math.max(t, 0), 1);
  return (
    "#" +
    a
      .map((v, i) => Math.round(v + (b[i] - v) * k))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// 3색 × 3농도 = 9개 샘플
export const SAMPLE_BEADS: Bead[] = (["violet", "coral", "sky"] as const).flatMap((color) =>
  ([3, 6, 9] as const).map((concentration) => ({ id: `${color}-${concentration}`, color, concentration })),
);
