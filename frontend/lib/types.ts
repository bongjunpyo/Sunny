/** 화면과 서버가 함께 쓰는 타입. 원본 계약은 docs/CONTRACT_API.md 다. */

export type ProductKind = "bracelet" | "necklace";

/** 광변색 반응색 — 기획서 수정본 기준 5색 */
export type PhotochromicColor = "red" | "orange" | "blue" | "yellow" | "violet";

export interface Product {
  slug: string;
  kind: ProductKind;
  name: string;
  /** 목록 카드에 쓰는 한 줄 */
  summary: string;
  /** 상세에 쓰는 이야기 문단 */
  story: string[];
  colors: PhotochromicColor[];
  /** 판매 상태가 정해지기 전에는 "planning" */
  status: "planning" | "available" | "soldout";
}

/** 광변색 색 이름 — 화면 문구의 원본 */
export const COLOR_LABEL: Record<PhotochromicColor, string> = {
  red: "빨강",
  orange: "주황",
  blue: "파랑",
  yellow: "노랑",
  violet: "보라",
};

/** 태양 관측 이미지. 관측 시각을 확인하지 못하면 observedAt 은 null 이다. */
export interface SolarImage {
  id: string;
  provider: string;
  instrument: string;
  channel: string;
  imageUrl: string | null;
  observedAt: string | null;
  fetchedAt: string;
  credit: string;
  sourceUrl: string;
  status: "available" | "cached" | "unavailable";
}

/** 로그인한 회원 — 화면이 보여주는 최소한만 담는다 (민감정보 최소 반환) */
export interface Member {
  email: string;
  nickname: string;
}

/** 커스텀 구성 — 비즈 배열은 고정이라 고르지 않는다 */
export interface Customization {
  productSlug: string;
  color: PhotochromicColor;
  length: string;
  photoName: string | null;
}

/** 길이 선택지 — 제품 종류에 따라 다르다 */
export const LENGTH_OPTIONS: Record<ProductKind, string[]> = {
  bracelet: ["16 cm", "18 cm", "20 cm"],
  necklace: ["40 cm", "45 cm", "50 cm"],
};

export const PHOTOCHROMIC_COLORS: PhotochromicColor[] = [
  "red",
  "orange",
  "blue",
  "yellow",
  "violet",
];
