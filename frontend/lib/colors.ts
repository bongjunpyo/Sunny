import type { PhotochromicColor } from "./types.ts";

/** 광변색 반응색의 화면 표시용 색값 — **원본은 여기 한 곳이다.**
 *
 *  실제 발색과 같은 색이 아니다. 화면에서 색을 구분하기 위한 견본이고,
 *  실물 색은 시험 기록(농도 · 노출 시간 · 날씨)과 함께 사진으로 보여준다. */
export const COLOR_HEX: Record<PhotochromicColor, string> = {
  red: "#c24b40",
  orange: "#d9853b",
  blue: "#3f67a8",
  yellow: "#d8b43a",
  violet: "#7c5aa6",
};

/** 햇빛을 받기 전(실내) 비즈 색 — 흰색에 가깝다 */
export const BEAD_BASE = "#eee9e0";
