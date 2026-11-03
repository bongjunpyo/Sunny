import "server-only";
import { createHash } from "node:crypto";
import { LENGTH_OPTIONS, PHOTOCHROMIC_COLORS } from "../../types.ts";
import { DEMO_ORDER_POLICIES } from "../../order-policy.ts";
import type { OrderInput, OrderItemInput, OrderConsent } from "../../order-types.ts";

export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failures = {
  INVALID_ORDER_REQUEST: [400, "주문 요청의 구성과 입력을 확인해 주세요."],
  AUTHENTICATION_REQUIRED: [401, "로그인 또는 게스트 인증이 필요합니다."],
  ORDER_SESSION_NOT_ELIGIBLE: [403, "이메일 인증을 마친 뒤 다시 로그인해 주세요."],
  ORDER_ORIGIN_REJECTED: [403, "허용되지 않은 요청입니다."],
  ORDER_NOT_FOUND: [404, "주문 요청을 찾을 수 없습니다."],
  ORDER_IDEMPOTENCY_CONFLICT: [409, "다른 구성의 주문에 사용된 요청 키입니다. 구성을 다시 확인해 주세요."],
  ORDER_PHOTO_NOT_READY: [409, "주문에 사용할 사진의 업로드와 확인 상태를 다시 확인해 주세요."],
  ORDER_POLICY_MISMATCH: [409, "현재 시연 동의 내용을 확인한 뒤 다시 동의해 주세요."],
  ORDER_BODY_TOO_LARGE: [413, "주문 요청 크기가 허용 기준을 초과했습니다."],
  ORDER_CONTENT_TYPE_REJECTED: [415, "JSON으로 주문을 요청해 주세요."],
  ORDER_SERVICE_UNAVAILABLE: [503, "주문 시연을 준비할 수 없습니다. 잠시 후 다시 확인해 주세요."],
} as const;
export class OrderError extends Error {
  readonly code: keyof typeof failures;
  constructor(code: keyof typeof failures) { super(code); this.code = code; }
}
export function orderJSON(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff" } });
}
export function orderFailure(error: unknown) {
  const code = error instanceof OrderError ? error.code : "ORDER_SERVICE_UNAVAILABLE";
  const [status, message] = failures[code]; return orderJSON({ error: { code, message } }, status);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OrderError("INVALID_ORDER_REQUEST");
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => ![...required,...optional].includes(key))) {
    throw new OrderError("INVALID_ORDER_REQUEST");
  }
}
function consent(value: unknown): OrderConsent {
  const c = object(value); keys(c,["accepted","policyVersion"]);
  if (typeof c.accepted !== "boolean" || typeof c.policyVersion !== "string" || !/^[A-Z0-9_]{1,100}$/.test(c.policyVersion)) {
    throw new OrderError("INVALID_ORDER_REQUEST");
  }
  return { accepted: c.accepted, policyVersion: c.policyVersion };
}
function parseOrderItem(value: unknown): OrderItemInput {
  const b = object(value); keys(b,["productSlug","productKind","color","lengthCm","beadLayout","previewConfirmed","quantity"],Object.keys(DEMO_ORDER_POLICIES));
  if (typeof b.productSlug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.productSlug) || b.productSlug.length>100
    || !["bracelet","necklace"].includes(b.productKind as string) || !PHOTOCHROMIC_COLORS.includes(b.color as never)
    || typeof b.lengthCm !== "number" || !LENGTH_OPTIONS[b.productKind as "bracelet"|"necklace"].includes(`${b.lengthCm} cm`)
    || b.previewConfirmed !== true || !Number.isInteger(b.quantity) || Number(b.quantity)<1 || Number(b.quantity)>10) throw new OrderError("INVALID_ORDER_REQUEST");
  const layout = object(b.beadLayout);
  if(b.productKind==="necklace"){
    keys(layout,["moonCount","roundCount"]);
    if(layout.moonCount!==1 || layout.roundCount!==2 || Object.hasOwn(b,"photoProductionConsent") || Object.hasOwn(b,"photoBrandUseConsent")) throw new OrderError("INVALID_ORDER_REQUEST");
    return {productSlug:b.productSlug,productKind:"necklace",color:b.color as OrderItemInput["color"],lengthCm:b.lengthCm,
      quantity:Number(b.quantity),beadLayout:{moonCount:1,roundCount:2},previewConfirmed:true};
  }
  keys(layout,["squareCount","beads"]);
  if (layout.squareCount !== 7 || !Array.isArray(layout.beads) || layout.beads.length !== 7) throw new OrderError("INVALID_ORDER_REQUEST");
  const beads = layout.beads.map(value => {
    const slot = object(value); keys(slot,["index","photoAssetId"]);
    if (!Number.isInteger(slot.index) || Number(slot.index)<0 || Number(slot.index)>6
      || (slot.photoAssetId !== null && (typeof slot.photoAssetId !== "string" || !uuid.test(slot.photoAssetId)))) {
      throw new OrderError("INVALID_ORDER_REQUEST");
    }
    return { index: Number(slot.index), photoAssetId: slot.photoAssetId===null ? null : String(slot.photoAssetId).toLowerCase() };
  }).sort((a,b)=>a.index-b.index);
  if (new Set(beads.map(b=>b.index)).size!==7) throw new OrderError("INVALID_ORDER_REQUEST");
  const hasPhotos = beads.some(b=>b.photoAssetId!==null);
  const production = Object.hasOwn(b,"photoProductionConsent") ? consent(b.photoProductionConsent) : undefined;
  const brand = Object.hasOwn(b,"photoBrandUseConsent") ? consent(b.photoBrandUseConsent) : undefined;
  if ((hasPhotos && !production?.accepted) || (!hasPhotos && (production || brand))) throw new OrderError("INVALID_ORDER_REQUEST");
  return { productSlug: b.productSlug, productKind: b.productKind as OrderItemInput["productKind"], color: b.color as OrderItemInput["color"],
    lengthCm: b.lengthCm, quantity:Number(b.quantity), beadLayout:{squareCount:7,beads}, previewConfirmed:true,
    ...(production ? {photoProductionConsent:production}:{}), ...(brand ? {photoBrandUseConsent:brand}:{}) };
}
export function parseOrderInput(value:unknown):OrderInput {
  const root=object(value);keys(root,["items"]);
  if(!Array.isArray(root.items) || root.items.length<1 || root.items.length>20)throw new OrderError("INVALID_ORDER_REQUEST");
  const items=root.items.map(parseOrderItem);
  if(items.reduce((total,item)=>total+item.quantity,0)>100)throw new OrderError("INVALID_ORDER_REQUEST");
  return {items};
}
export function validateOrderPolicies(input:OrderInput){
  for(const item of input.items)for(const type of Object.keys(DEMO_ORDER_POLICIES) as (keyof typeof DEMO_ORDER_POLICIES)[]){
    if(item[type] && item[type].policyVersion!==DEMO_ORDER_POLICIES[type].version)throw new OrderError("ORDER_POLICY_MISMATCH");
  }
}
export const payloadHash = (input: OrderInput) => createHash("sha256").update(JSON.stringify(input)).digest("hex");
export type OrderPage = { limit: number; cursor?: { createdAt: string; orderId: string } };
export function parseOrderPage(url: URL): OrderPage {
  const p = url.searchParams;
  if ([...p.keys()].some(key=>!["limit","cursor"].includes(key)) || p.getAll("limit").length>1 || p.getAll("cursor").length>1) throw new OrderError("INVALID_ORDER_REQUEST");
  const raw = p.get("limit")??"20";
  if (!/^[1-9][0-9]?$/.test(raw) || Number(raw)>50) throw new OrderError("INVALID_ORDER_REQUEST");
  if (!p.has("cursor")) return {limit:Number(raw)};
  try {
    const encoded=p.get("cursor")!;
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(encoded)) throw new Error();
    const cursor=object(JSON.parse(Buffer.from(encoded,"base64url").toString("utf8")));keys(cursor,["createdAt","orderId"]);
    if (typeof cursor.createdAt!=="string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cursor.createdAt)
      || new Date(cursor.createdAt).toISOString()!==cursor.createdAt || typeof cursor.orderId!=="string" || !uuid.test(cursor.orderId)) throw new Error();
    return {limit:Number(raw),cursor:{createdAt:cursor.createdAt,orderId:cursor.orderId.toLowerCase()}};
  } catch { throw new OrderError("INVALID_ORDER_REQUEST"); }
}
