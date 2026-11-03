"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {useSite} from "./Provider";
import {c,Intro,Art,TextLink} from "./ui";
import {productInfo,palette,productHref} from "./data";
import {getSessionIdentity,startGuestSession,AUTH_CHANGED_EVENT,authErrorMessage,type SessionIdentity} from "../../lib/auth.ts";
import {readPhotoURL} from "../../lib/uploads.ts";
import {toOrderInput,type CartItem} from "../../lib/cart.ts";
import {DEMO_ORDER_POLICIES} from "../../lib/order-policy.ts";
import type {OrderInput} from "../../lib/order-types.ts";
import {OrderRequestButton} from "../orders/OrderRequestButton.tsx";
function PhotoArt({item,onReady}:{item:CartItem;onReady?:(ready:boolean)=>void}){
 const [photos,setPhotos]=useState<({url:string}|null)[]>([]),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
 const callback=useRef(onReady);callback.current=onReady;
 const ids=JSON.stringify(item.photoAssetIds),owner=item.photoOwnerId;
 useEffect(()=>{
  let active=true,timer:ReturnType<typeof setTimeout>|undefined;setPhotos([]);setError("");callback.current?.(false);
  const assets=JSON.parse(ids) as (string|null)[];
  if(!assets.some(Boolean)){callback.current?.(true);return;}
  const load=async()=>{
   try{
    const session=await getSessionIdentity();if(!session||session.userId!==owner)throw new Error("사진을 올린 세션에서 다시 확인해 주세요.");
    const unique=[...new Set(assets.filter((x):x is string=>x!==null))];
    const urls=await Promise.all(unique.map(async id=>{const result=await readPhotoURL(id);const image=new Image();image.src=result.url;await image.decode();return {id,...result};}));
    if(!active)return;setPhotos(assets.map(id=>id?{url:urls.find(u=>u.id===id)!.url}:null));callback.current?.(true);
    const expiry=Math.min(...urls.map(u=>Date.parse(u.expiresAt)));timer=setTimeout(load,Math.max(1000,expiry-Date.now()-10000));
   }catch{if(active){setPhotos([]);setError("사진 미리보기를 확인하지 못했습니다. 원래 세션인지 확인하고 다시 불러와 주세요.");callback.current?.(false);}}
  };void load();return()=>{active=false;if(timer)clearTimeout(timer);};
 },[ids,owner,attempt]);
 return <><Art kind={item.kind} color={item.color} photos={photos}/>{error?<p role="alert" className={c("small-copy")}>{error}<button className={c("text-button")} onClick={()=>setAttempt(n=>n+1)}>사진 다시 확인</button></p>:null}</>;
}
export function Cart(){
 const {cart,quantity,remove,ready,cartMessage,checkoutBusy}=useSite();
 return <><Intro title="빛을 담은 가방." eyebrow="YOUR BAG">여러 제품의 색·길이·사진 배치와 수량을 함께 확인해 주세요.</Intro><section className={c("section-pad")}>
 {cartMessage?<p role="alert">{cartMessage}</p>:null}
 {!ready?<p>구성을 불러오는 중입니다.</p>:!cart.length?<div className={c("empty-state")}><h2>아직 담긴 빛이 없어요.</h2><TextLink href="/collection">컬렉션 둘러보기</TextLink></div>:<>
  <div className={c("commerce-list")}>{cart.map((item,index)=><article key={item.id} className={c("cart-row")}>
   <div><Link href={productHref(item.kind)} aria-label={`${productInfo[item.kind].name} 상세`}><span className={c("small-copy")}>제품 보기 ↗</span></Link><PhotoArt item={item}/></div>
   <div><h2>{productInfo[item.kind].name}</h2><p className={c("small-copy")}>{palette.find(p=>p.id===item.color)?.name} · {item.length}<br/>{item.kind==="necklace"?"달 1개 · 양옆 원형 2개":`사진 ${item.photoAssetIds.filter(Boolean).length}칸 · 네모 7칸`}</p>
    <label className={c("field")}>수량 · {productInfo[item.kind].name}<input type="number" min={1} max={10} value={item.quantity} disabled={checkoutBusy} onChange={e=>quantity(index,Number(e.target.value))}/></label>
    <button className={c("text-button")} disabled={checkoutBusy} onClick={()=>remove(index)}>구성 삭제</button>
   </div><span>시연용 구성</span>
  </article>)}</div>
  <div className={c("collection-note")}><p className={c("small-copy")}>{cart.length}품목 · 총 {cart.reduce((n,i)=>n+i.quantity,0)}개입니다. 실제 결제·제작·배송은 진행하지 않습니다.</p><TextLink href="/collection">제품 더 담기</TextLink><Link className={c("button")} href="/checkout">주문서 화면 보기 ↗</Link></div>
 </>}
 </section></>;
}
export function Checkout(){
 const {cart,ready,cartMessage,checkoutKey,completeCheckout,lockCheckout,checkoutBusy}=useSite();
 const [identity,setIdentity]=useState<SessionIdentity|null>(null),[authError,setAuthError]=useState(""),[guestBusy,setGuestBusy]=useState(false);
 const [confirmed,setConfirmed]=useState(false),[production,setProduction]=useState(false),[brand,setBrand]=useState(false),[previews,setPreviews]=useState<Record<string,boolean>>({});
 const signature=JSON.stringify(cart),hasPhotos=cart.some(i=>i.photoAssetIds.some(Boolean));
 useEffect(()=>{let active=true;const load=()=>getSessionIdentity().then(v=>{if(active){setIdentity(v);setAuthError("");}}).catch(e=>{if(active)setAuthError(authErrorMessage(e));});
  void load();window.addEventListener(AUTH_CHANGED_EVENT,load);window.addEventListener("focus",load);return()=>{active=false;window.removeEventListener(AUTH_CHANGED_EVENT,load);window.removeEventListener("focus",load);};},[]);
 useEffect(()=>{setConfirmed(false);setProduction(false);setBrand(false);},[signature,identity?.userId]);
 const allReady=cart.length>0&&cart.every(i=>previews[i.id]===true);
 let input:OrderInput|null=null,validation="";
 if(ready&&identity&&confirmed&&allReady)try{input=toOrderInput(cart,identity.userId,confirmed,production,brand);}catch(e){validation=e instanceof Error?e.message:"주문 구성을 확인해 주세요.";}
 return <><Intro title="당신에게 닿기까지." eyebrow="CHECKOUT / DEMONSTRATION">선택한 구성을 한 번 더 확인해 주세요.<br/>결제하기는 실제 결제 없이 시연용 주문 요청을 저장합니다.</Intro>
 <section className={c("section-pad")}><div className={c("qna-layout")}><div><h2>선택한 구성</h2>
 {!ready?<p>불러오는 중입니다.</p>:cart.length?cart.map(item=><article key={item.id} className={c("checkout-item")}>
  <PhotoArt item={item} onReady={value=>setPreviews(old=>old[item.id]===value?old:{...old,[item.id]:value})}/>
  <h3>{productInfo[item.kind].name}</h3><p className={c("small-copy")}>{palette.find(p=>p.id===item.color)?.name} · {item.length} · {item.quantity}개<br/>{item.kind==="necklace"?"원형 – 달 – 원형":"네모 사진 비즈 7칸"}</p>
 </article>):<div className={c("empty-state")}><p>장바구니가 비어 있습니다.</p><TextLink href="/collection">제품 고르기</TextLink></div>}
 <TextLink href="/cart">장바구니에서 수정하기</TextLink></div>
 <div className={c("qna-form")}><h2>주문 요청 확인</h2><p className={c("body-copy")}>시연용 요청입니다. 배송지와 결제 정보는 입력받지 않으며 실제 청구·제작·배송은 진행하지 않습니다.</p>
 <div className={c("summary-row")}><span>구성</span><span>{cart.length}품목 · 총 {cart.reduce((n,i)=>n+i.quantity,0)}개</span></div>
 {!identity?<div><p className={c("small-copy")}>로그인하거나 현재 브라우저의 게스트 세션으로 계속할 수 있습니다.</p><TextLink href="/login">로그인하기</TextLink>
  <button className={c("button outline")} disabled={guestBusy||checkoutBusy} onClick={async()=>{setGuestBusy(true);setAuthError("");try{setIdentity(await startGuestSession());}catch(e){setAuthError(authErrorMessage(e));}finally{setGuestBusy(false);}}}>{guestBusy?"세션 확인 중…":"게스트로 계속"}</button></div>:<p className={c("small-copy")}>{identity.isAnonymous?"이 브라우저의 게스트 세션으로 요청합니다.":"로그인한 회원 세션으로 요청합니다."}</p>}
 <label className={c("checkout-confirm")}><input type="checkbox" checked={confirmed} disabled={!allReady||checkoutBusy} onChange={e=>setConfirmed(e.target.checked)}/><span>위 제품·색상·길이·수량과 사진 배치를 확인했습니다.</span></label>
 {hasPhotos?<><label className={c("checkout-confirm")}><input type="checkbox" checked={production} disabled={checkoutBusy} onChange={e=>setProduction(e.target.checked)}/><span>사진 제작 이용 동의 · 필수<br/><small>{DEMO_ORDER_POLICIES.photoProductionConsent.text}</small></span></label>
 <label className={c("checkout-confirm")}><input type="checkbox" checked={brand} disabled={checkoutBusy} onChange={e=>setBrand(e.target.checked)}/><span>브랜드 공개 이용 의사 · 선택<br/><small>{DEMO_ORDER_POLICIES.photoBrandUseConsent.text}</small></span></label></>:null}
 {authError||cartMessage||validation?<p role="alert">{authError||cartMessage||validation}</p>:null}
 <div className={c("checkout-submit")}><OrderRequestButton label="결제하기" input={input} previewReady={confirmed&&allReady} onBusyChange={lockCheckout}
  keyForInput={async payload=>{const current=await getSessionIdentity();if(!current||current.userId!==identity?.userId){setIdentity(current);throw new Error("세션이 변경되었습니다. 다시 확인해 주세요.");}return checkoutKey(current.userId,payload);}}
  onSaved={()=>completeCheckout(cart.map(i=>({...i})))}/></div>
 </div></div></section></>;
}
export function CheckoutResult(){const router=useRouter();useEffect(()=>router.replace("/orders"),[router]);return <Intro title="주문 요청 목록으로 이동합니다."><TextLink href="/orders">내 주문 요청 보기</TextLink></Intro>;}
