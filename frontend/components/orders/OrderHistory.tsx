"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrderRequest, getOrderRequests, orderErrorMessage } from "../../lib/orders.ts";
import type { OrderDetail, OrderSummary } from "../../lib/order-types.ts";
import { COLOR_LABEL } from "../../lib/types.ts";
import styles from "./orders.module.css";
const kind={bracelet:"팔찌",necklace:"목걸이"};
export function OrderHistory({orderId,submitted}:{orderId?:string;submitted?:string}){
  const [items,setItems]=useState<OrderSummary[]>([]),[detail,setDetail]=useState<OrderDetail|null>(null);
  const [cursor,setCursor]=useState<string|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null),[approved,setApproved]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;setReady(false);setError(null);setApproved(false);setDetail(null);setItems([]);setCursor(null);
    (async()=>{
      if(orderId){const d=await getOrderRequest(orderId);if(active)setDetail(d);}
      else{const d=await getOrderRequests();if(active){setItems(d.items);setCursor(d.nextCursor);}
        if(submitted){await getOrderRequest(submitted);if(active)setApproved(true);}}
    })().catch(e=>{if(active)setError(orderErrorMessage(e));}).finally(()=>{if(active)setReady(true);});
    return()=>{active=false;};
  },[orderId,submitted,attempt]);
  return <section>
    <h1>{orderId?"주문 요청 상세":"내 주문 요청"}</h1>
    <p className={styles.notice}>시연 내역입니다. 실제 결제·제작·배송은 진행되지 않습니다. 현재 로그인 또는 게스트 세션의 주문만 표시합니다.</p>
    {approved?<p role="status">시연용 주문 요청이 승인되었습니다.</p>:null}
    {!ready?<p role="status">불러오는 중…</p>:null}
    {error?<div role="alert"><p>{error}</p><button className={styles.button} onClick={()=>setAttempt(a=>a+1)}>다시 확인</button> <Link href="/login">로그인</Link></div>:null}
    {ready&&!error&&!orderId&&items.length===0?<p>아직 이 세션의 주문 요청이 없습니다. <Link href="/custom">커스텀 둘러보기</Link></p>:null}
    {items.length?<ul className={styles.list}>{items.map(o=><li key={o.orderId}><Link href={`/orders/${o.orderId}`}>
      <strong>{o.productName} · {kind[o.productKind]}</strong><span>{COLOR_LABEL[o.color]} · {o.lengthCm} cm · 사진 배치 {o.photoCount}칸</span>
      <span>주문 요청 · 시연</span><time dateTime={o.createdAt}>{new Date(o.createdAt).toLocaleString("ko-KR")}</time>
    </Link></li>)}</ul>:null}
    {cursor?<button className={styles.button} disabled={busy} onClick={async()=>{setBusy(true);setError(null);
      try{const d=await getOrderRequests(cursor);setItems(old=>[...old,...d.items.filter(n=>!old.some(o=>o.orderId===n.orderId))]);setCursor(d.nextCursor);}
      catch(error){setError(orderErrorMessage(error));}finally{setBusy(false);}}}>{busy?"불러오는 중…":"더 보기"}</button>:null}
    {detail?<article className={styles.detail}>
      <h2>{detail.productName} · {kind[detail.productKind]}</h2><p>{COLOR_LABEL[detail.color]} · {detail.lengthCm} cm · 주문 요청 · 시연</p>
      <p>요청 일시: <time dateTime={detail.createdAt}>{new Date(detail.createdAt).toLocaleString("ko-KR")}</time></p>
      <h3>비즈 배치 · 7칸</h3><ol className={styles.beads}>{detail.beadLayout.beads.map(b=><li key={b.index}><b>{b.index+1}번</b><span>{b.photoAssetId?"사진 사용":"무늬 없음"}</span></li>)}</ol>
      <p>가시안 확인 기록: {new Date(detail.previewConfirmedAt).toLocaleString("ko-KR")}</p>
      <h3>시연 동의 기록</h3>{Object.keys(detail.consents).length===0?<p>사진을 사용하지 않아 사진 동의 기록이 없습니다.</p>:
        Object.entries(detail.consents).map(([type,c])=>c?<p key={type}>{type==="photoProductionConsent"?"사진 제작 이용":"브랜드 공개 이용"}: {c.accepted?"동의":"동의하지 않음"}<br/>{c.policyVersion} · 기록 {new Date(c.recordedAt).toLocaleString("ko-KR")}</p>:null)}
    </article>:null}
    <p><Link href={orderId?"/orders":"/account"}>{orderId?"내 주문 요청 목록":"마이페이지"} ↗</Link></p>
  </section>;
}
