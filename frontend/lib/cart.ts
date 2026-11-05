import {LENGTH_OPTIONS,PHOTOCHROMIC_COLORS,type ProductKind} from "./types.ts";
import {DEMO_ORDER_POLICIES} from "./order-policy.ts";
import type {OrderInput,OrderItemInput,OrderColor} from "./order-types.ts";
export type CartItem={id:string;kind:ProductKind;color:OrderColor;length:string;quantity:number;
  photoAssetIds:(string|null)[];photoOwnerId:string|null};
export type CartChoice={kind:ProductKind;color:string;length:string;photoAssetIds?:(string|null)[];photoOwnerId?:string|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function normalizeCart(value:unknown):CartItem[]{
 if(!Array.isArray(value)||value.length>20)throw new Error("장바구니를 다시 구성해 주세요.");
 const result=value.map(v=>{
  if(!v||!["bracelet","necklace"].includes(v.kind)||!(PHOTOCHROMIC_COLORS.includes(v.color)||(v.kind==="bracelet"&&v.color==="mixed"))
   ||!LENGTH_OPTIONS[v.kind as ProductKind].includes(v.length)||!Number.isInteger(v.quantity)||v.quantity<1||v.quantity>10)
   throw new Error("장바구니의 제품·색·길이·수량을 다시 확인해 주세요.");
  const photos=v.photoAssetIds??(v.kind==="bracelet"?Array(7).fill(null):[]);
  if(!Array.isArray(photos)||photos.length!==(v.kind==="bracelet"?7:0)||photos.some(p=>p!==null&&(typeof p!=="string"||!uuid.test(p))))throw new Error("사진 배치를 다시 확인해 주세요.");
  const hasPhotos=photos.some(Boolean);
  if(hasPhotos&&(typeof v.photoOwnerId!=="string"||!uuid.test(v.photoOwnerId)))throw new Error("사진을 올린 세션을 다시 확인해 주세요.");
  return {id:typeof v.id==="string"&&uuid.test(v.id)?v.id.toLowerCase():crypto.randomUUID(),kind:v.kind,color:v.color,length:v.length,
   quantity:v.quantity,photoAssetIds:photos.map(p=>p===null?null:p.toLowerCase()),photoOwnerId:hasPhotos?v.photoOwnerId.toLowerCase():null} as CartItem;
 });
 if(new Set(result.map(i=>i.id)).size!==result.length||result.reduce((n,i)=>n+i.quantity,0)>100)throw new Error("장바구니는 20품목·총 100개까지 담을 수 있습니다.");
 return result;
}
export function addCartItem(cart:CartItem[],choice:CartChoice):CartItem[]{
 const next=normalizeCart([{...choice,id:crypto.randomUUID(),quantity:1}])[0];
 const fingerprint=(i:CartItem)=>JSON.stringify([i.kind,i.color,i.length,i.photoAssetIds,i.photoOwnerId]);
 const index=cart.findIndex(i=>fingerprint(i)===fingerprint(next));
 const result=index<0?[...cart,next]:cart.map((i,n)=>n===index?{...i,quantity:i.quantity+1}:i);
 return normalizeCart(result);
}
export function toOrderInput(cart:CartItem[],owner:string,confirmed:boolean,production:boolean,brand:boolean):OrderInput{
 if(!confirmed)throw new Error("제품과 사진 배치를 확인해 주세요.");
 const clean=normalizeCart(cart);if(!clean.length)throw new Error("장바구니가 비어 있습니다.");
 return {items:clean.map(i=>{
  const hasPhotos=i.photoAssetIds.some(Boolean);
  if(hasPhotos&&i.photoOwnerId!==owner.toLowerCase())throw new Error("다른 세션에서 올린 사진입니다. 현재 세션에서 다시 구성해 주세요.");
  if(hasPhotos&&!production)throw new Error("사진 제작 이용에 동의해 주세요.");
  const item:OrderItemInput={productSlug:i.kind==="bracelet"?"light-study-01":"light-study-02",productKind:i.kind,color:i.color,
   lengthCm:Number.parseInt(i.length,10),quantity:i.quantity,previewConfirmed:true,
   beadLayout:i.kind==="bracelet"?{squareCount:7,beads:i.photoAssetIds.map((photoAssetId,index)=>({index,photoAssetId}))}:{moonCount:1,roundCount:2}};
  if(hasPhotos){item.photoProductionConsent={accepted:true,policyVersion:DEMO_ORDER_POLICIES.photoProductionConsent.version};
   item.photoBrandUseConsent={accepted:brand,policyVersion:DEMO_ORDER_POLICIES.photoBrandUseConsent.version};}
  return item;
 })};
}
