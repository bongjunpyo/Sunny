import type { ProductKind, PhotochromicColor } from "./types.ts";

export type OrderConsent = { accepted: boolean; policyVersion: string };
export type OrderInput = {
  productSlug: string; productKind: ProductKind; color: PhotochromicColor; lengthCm: number;
  beadLayout: { squareCount: 7; beads: { index: number; photoAssetId: string | null }[] };
  previewConfirmed: true;
  photoProductionConsent?: OrderConsent; photoBrandUseConsent?: OrderConsent;
};
export type ConsentReceipt = OrderConsent & { acceptedAt: string | null; recordedAt: string };
export type OrderSummary = {
  orderId: string; status: "REQUESTED"; mode: "DEMO"; productSlug: string; productKind: ProductKind;
  productName: string; color: PhotochromicColor; lengthCm: number; photoCount: number; createdAt: string;
};
export type OrderDetail = OrderSummary & { previewConfirmedAt: string; beadLayout: OrderInput["beadLayout"];
  consents: Partial<Record<"photoProductionConsent" | "photoBrandUseConsent", ConsentReceipt>> };
export type OrderCreated = { order: OrderDetail; nextPath: string; noticeCode: "DEMO_ORDER_REQUEST_APPROVED" };
export type OrderList = { items: OrderSummary[]; nextCursor: string | null };
