"use client";
import type { OrderInput, OrderCreated, OrderDetail, OrderList, OrderSummary } from "./order-types.ts";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const messages:Record<string,string>={
  AUTHENTICATION_REQUIRED:"로그인 또는 게스트 인증 후 주문 내역을 확인해 주세요.",
  ORDER_SESSION_NOT_ELIGIBLE:"이메일 인증을 마친 뒤 다시 로그인해 주세요.",
  ORDER_NOT_FOUND:"이 세션에서 확인할 수 있는 주문 요청이 없습니다.",
  ORDER_SERVICE_UNAVAILABLE:"주문 시연에 연결할 수 없습니다. 잠시 후 같은 요청으로 다시 확인해 주세요.",
  ORDER_PHOTO_NOT_READY:"사진 업로드와 확인 상태를 다시 확인해 주세요.",
  ORDER_POLICY_MISMATCH:"현재 시연 동의 내용을 다시 확인해 주세요.",
  ORDER_IDEMPOTENCY_CONFLICT:"다른 구성에 사용된 요청입니다. 기존 주문 내역을 확인해 주세요.",
};
export class OrderClientError extends Error {
  readonly code:string;
  constructor(code:string){super(messages[code]??"주문 요청을 확인하지 못했습니다. 입력 또는 연결 상태를 확인해 주세요.");this.code=code;}
}
export function orderErrorMessage(error:unknown){return error instanceof OrderClientError?error.message:"연결을 확인한 뒤 같은 요청으로 다시 시도해 주세요.";}
async function request(path:string,body?:OrderInput,key?:string){
  const response=await fetch(`/api/orders${path}`,{method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",
    signal:AbortSignal.timeout(15000),...(body?{headers:{"Content-Type":"application/json","Idempotency-Key":key!},body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new OrderClientError(typeof data?.error?.code==="string"?data.error.code:"ORDER_REQUEST_FAILED");
  return data;
}
function isSummary(value:unknown):value is OrderSummary {
  const v=value as Partial<OrderSummary>|null;
  return !!v && typeof v.orderId==="string" && uuid.test(v.orderId) && v.status==="REQUESTED" && v.mode==="DEMO"
    && typeof v.productName==="string" && ["bracelet","necklace"].includes(v.productKind??"") && typeof v.createdAt==="string"
    && ["red","orange","blue","yellow","violet"].includes(v.color??"") && typeof v.lengthCm==="number";
}
function isDetail(value:unknown):value is OrderDetail {
  if(!isSummary(value))return false;const d=value as OrderDetail;
  return d.beadLayout?.squareCount===7 && Array.isArray(d.beadLayout.beads) && d.beadLayout.beads.length===7
    && d.beadLayout.beads.every((b,i)=>b.index===i && (b.photoAssetId===null || (typeof b.photoAssetId==="string"&&uuid.test(b.photoAssetId))))
    && !!d.consents && typeof d.previewConfirmedAt==="string";
}
export async function submitOrderRequest(input:OrderInput,key:string):Promise<OrderCreated>{
  if(!uuid.test(key))throw new OrderClientError("INVALID_ORDER_REQUEST");
  const d=await request("",input,key);
  if(!isDetail(d?.order) || d.noticeCode!=="DEMO_ORDER_REQUEST_APPROVED" || d.nextPath!==`/orders?submitted=${d.order.orderId}`)throw new OrderClientError("INVALID_ORDER_RESPONSE");
  return d;
}
export async function getOrderRequest(id:string):Promise<OrderDetail>{
  if(!uuid.test(id))throw new OrderClientError("ORDER_NOT_FOUND");
  const d=await request(`/${encodeURIComponent(id)}`);
  if(!isDetail(d?.order) || d.order.orderId.toLowerCase()!==id.toLowerCase())throw new OrderClientError("INVALID_ORDER_RESPONSE");
  return d.order;
}
export async function getOrderRequests(cursor?:string):Promise<OrderList>{
  const d=await request(cursor?`?cursor=${encodeURIComponent(cursor)}`:"");
  if(!Array.isArray(d?.items) || !d.items.every(isSummary) || !(d.nextCursor===null || typeof d.nextCursor==="string"))throw new OrderClientError("INVALID_ORDER_RESPONSE");
  return d;
}
