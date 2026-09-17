/** 화면과 서버가 함께 쓰는 타입. 원본 계약은 docs/CONTRACT_API.md 다. */

export type ProductKind = "bracelet" | "necklace";

/** 광변색 반응색 — 기획서 수정본 기준 5색 */
export type PhotochromicColor = "red" | "orange" | "blue" | "yellow" | "violet";

export interface Product {
  slug: string;
  kind: ProductKind;
  name: string;
  summary: string;
  colors: PhotochromicColor[];
  /** 판매 상태가 정해지기 전에는 "planning" */
  status: "planning" | "available" | "soldout";
}

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
