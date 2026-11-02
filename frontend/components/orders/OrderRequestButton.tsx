"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitOrderRequest, orderErrorMessage } from "../../lib/orders.ts";
import type { OrderInput } from "../../lib/order-types.ts";
import styles from "./orders.module.css";

/** The owning 3D flow must supply an explicitly confirmed seven-slot input. */
export function OrderRequestButton({input,previewReady}:{input:OrderInput|null;previewReady:boolean}){
  const router=useRouter(),pending=useRef(false);
  const attempt=useRef<{payload:string;key:string}|null>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
  return <div>
    <p className={styles.notice}>시연용 주문 요청입니다. 실제 결제·제작·배송은 진행되지 않습니다.</p>
    <button className={styles.button} type="button" disabled={busy||!previewReady||input?.previewConfirmed!==true} onClick={async()=>{
      if(pending.current||!input||!previewReady||input.previewConfirmed!==true)return;
      pending.current=true;setBusy(true);setError(null);setMessage(null);
      const payload=JSON.stringify(input);
      if(!attempt.current||attempt.current.payload!==payload)attempt.current={payload,key:crypto.randomUUID()};
      try{const result=await submitOrderRequest(input,attempt.current.key);
        setMessage("시연용 주문 요청이 승인되었습니다.");router.push(result.nextPath);}
      catch(error){setError(orderErrorMessage(error));}
      finally{pending.current=false;setBusy(false);}
    }}>{busy?"주문 요청 확인 중…":"시연 주문 요청"}</button>
    {!previewReady||input?.previewConfirmed!==true?<p className={styles.notice}>가시안을 확인하고 구성에 동의한 뒤 요청할 수 있습니다.</p>:null}
    {message?<p role="status">{message}</p>:null}{error?<p role="alert">{error}</p>:null}
  </div>;
}
