"use client";
import {useEffect,useRef,useState,type ChangeEvent} from "react";
import {useRouter} from "next/navigation";
import type {ProductKind} from "../../lib/types.ts";
import type {PhotoRules} from "../../lib/photo.ts";
import {describeRules} from "../../lib/photo.ts";
import {getPhotoRules,checkPhoto,uploadPhoto,photoErrorMessage,type UploadAttempt} from "../../lib/uploads.ts";
import {getSessionIdentity,startGuestSession,authErrorMessage,type SessionIdentity} from "../../lib/auth.ts";
import {productInfo,colorName,kinds} from "./data";
import {useSite} from "./Provider";
import {Art,Intro,c} from "./ui";
import {ColorPicker,LightPicker} from "./ProductViews";
type Selected={url:string;assetId:string;ownerId:string};
export function Custom({initialKind="bracelet"}:{initialKind?:ProductKind}){
 const [kind,setKind]=useState(initialKind),[color,setColor]=useState("violet"),[length,setLength]=useState(productInfo[initialKind].lengths[1]);
 const [light,setLight]=useState("sunlight"),[photos,setPhotos]=useState<(Selected|null)[]>(Array(7).fill(null)),[slot,setSlot]=useState(0);
 const [rules,setRules]=useState<PhotoRules|null>(null),[rulesAttempt,setRulesAttempt]=useState(0),[identity,setIdentity]=useState<SessionIdentity|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const mounted=useRef(true),urls=useRef(new Set<string>()),attempts=useRef(new Map<string,UploadAttempt>()),verified=useRef(new Map<string,string>());
 const {add,checkoutBusy}=useSite(),router=useRouter();
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;urls.current.forEach(u=>URL.revokeObjectURL(u));};},[]);
 useEffect(()=>{const used=new Set(photos.flatMap(p=>p?[p.url]:[]));for(const url of urls.current)if(!used.has(url))URL.revokeObjectURL(url);urls.current=used;},[photos]);
 useEffect(()=>{let active=true;setRules(null);getPhotoRules().then(r=>{if(active)setRules(r);}).catch(e=>{if(active)setError(photoErrorMessage(e));});
  getSessionIdentity().then(v=>{if(active)setIdentity(v);}).catch(()=>{});return()=>{active=false;};},[rulesAttempt]);
 async function pick(event:ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];event.target.value="";if(!file||!rules||!identity||busy)return;
  setBusy(true);setError("");let url:string|undefined;
  try{
   const checked=await checkPhoto(file,rules);url=checked.url;
   const hash=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());
   const fingerprint=identity.userId+":"+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");
   const assetId=verified.current.get(fingerprint)??await uploadPhoto(file,{attempt:attempts.current.get(fingerprint),onAttempt:a=>attempts.current.set(fingerprint,a)});
   verified.current.set(fingerprint,assetId);
   if(!mounted.current){URL.revokeObjectURL(url);return;}
   urls.current.add(url);const selected={url,assetId,ownerId:identity.userId};setPhotos(old=>old.map((p,i)=>i===slot?selected:p));url=undefined;
  }catch(e){if(url)URL.revokeObjectURL(url);if(mounted.current)setError(photoErrorMessage(e));}
  finally{if(mounted.current)setBusy(false);}
 }
 const hasPhotos=photos.some(Boolean),existing=[...new Map(photos.flatMap(p=>p?[[p.assetId,p] as const]:[])).values()];
 function toCart(){
  if(busy||checkoutBusy)return;
  if(kind==="bracelet"&&hasPhotos&&photos.some(p=>p&&p.ownerId!==identity?.userId)){setError("사진을 올린 세션이 바뀌었습니다. 현재 세션에서 사진을 다시 구성해 주세요.");return;}
  add({kind,color,length,...(kind==="bracelet"?{photoAssetIds:photos.map(p=>p?.assetId??null),photoOwnerId:hasPhotos?identity!.userId:null}:{})});router.push("/cart");
 }
 return <><Intro title="나만의 비즈." eyebrow="YOUR MOMENT, YOUR SUNNY">좋아하는 색과 나에게 맞는 길이.<br/>{kind==="bracelet"?"작은 네모에 당신의 하루를 담아보세요.":"달 하나와 양옆의 원 둘에 어울리는 색을 골라보세요."}</Intro>
 <section className={c("custom-page")}><div className={c("custom-layout")}><div className={c("custom-preview")}>
  <Art kind={kind} color={color} light={light} photos={kind==="bracelet"?photos:[]}/><div className={c("preview-bar")}><span className={c("micro")}>YOUR PIECE / LIVE PREVIEW</span><LightPicker value={light} onChange={setLight}/></div>
  <p className={c("custom-help")}>선택한 색{kind==="bracelet"?"과 사진":""}이 구성 그림에 반영됩니다.<br/>실물 치수와 발색 시험을 재현한 화면은 아닙니다.</p>
 </div><div className={c("custom-options")}>
  <section className={c("option-section")}><h2><small>01 / FORM</small>빛을 지닐 자리</h2><div className={c("choice-row")}>{kinds.map(k=><button key={k} className={c("choice")} disabled={busy} aria-pressed={kind===k} onClick={()=>{if(k==="necklace"&&color==="mixed")setColor("violet");setKind(k);setLength(productInfo[k].lengths[1]);setSlot(0);setError("");}}>{productInfo[k].kind}</button>)}</div></section>
  <section className={c("option-section")}><h2><small>02 / COLOR</small>나를 닮은 색</h2><p className={c("option-label")}>햇빛 아래 반응색 · {colorName(color)}</p><ColorPicker value={color} onChange={setColor} allowMixed={kind==="bracelet"}/></section>
  <section className={c("option-section")}><h2><small>03 / LENGTH</small>편안한 길이</h2><div className={c("choice-row")}>{productInfo[kind].lengths.map(l=><button key={l} className={c("choice")} aria-pressed={l===length} onClick={()=>setLength(l)}>{l}</button>)}</div><p className={c("small-copy")}>길이는 디자인 검토용 예시입니다.</p></section>
  {kind==="bracelet"?<section className={c("option-section")}><h2><small>04 / MEMORY</small>간직하고 싶은 장면</h2>
   <div className={c("photo-slots")}>{photos.map((p,i)=><button key={i} className={c("photo-slot")} aria-label={`${i+1}번 비즈`} aria-pressed={slot===i} disabled={busy} onClick={()=>setSlot(i)}>{p?<img src={p.url} alt="확인된 사진"/>:<span>+</span>}<span className={c("slot-index")}>{i+1}</span></button>)}</div>
   {!identity?<div><p className={c("small-copy")}>사진을 비공개로 저장하려면 로그인하거나 이 브라우저의 게스트 세션을 시작해 주세요.</p><button className={c("text-button")} disabled={busy} onClick={async()=>{setBusy(true);setError("");try{setIdentity(await startGuestSession());}catch(e){setError(authErrorMessage(e));}finally{setBusy(false);}}}>게스트로 사진 올리기</button></div>:null}
   <div className={c("photo-controls")}><label className={c("upload-label")} htmlFor="memory-photo">{busy?"사진 확인 중…":"선택한 칸에 사진 담기"}</label>
    <input className={c("sr-only")} id="memory-photo" type="file" accept={rules?.accept.join(",")??""} disabled={!rules||!identity||busy} onChange={pick}/>
    <button className={c("text-button")} disabled={busy} onClick={()=>setPhotos(old=>old.map((p,i)=>i===slot?null:p))}>선택한 사진 지우기</button>
   </div>
   {existing.length?<label className={c("field")}>이미 올린 사진 재사용<select value="" disabled={busy} onChange={e=>{const p=existing.find(p=>p.assetId===e.target.value);if(p)setPhotos(old=>old.map((v,i)=>i===slot?p:v));}}><option value="">사진 선택</option>{existing.map((p,i)=><option key={p.assetId} value={p.assetId}>사진 {i+1}</option>)}</select></label>:null}
   <p className={c("small-copy")}>{rules?describeRules(rules):"서버 사진 규칙을 확인하고 있습니다."}{rules?.provisional?<><br/>시연용 임시 규칙입니다.</>:null}<br/>사진은 비공개 업로드와 서버 검사를 마친 뒤 장바구니에 연결합니다.</p>
   {!rules?<button className={c("text-button")} onClick={()=>{setError("");setRulesAttempt(v=>v+1);}}>사진 규칙 다시 확인</button>:null}
  </section>:null}
  <aside className={c("custom-summary")}><div className={c("summary-head")}>당신의 작은 기록 <span>YOUR SUNNY</span></div>
   {[["형태",productInfo[kind].kind],["반응색",colorName(color)],["길이",length],["구성",kind==="bracelet"?"네모 7칸 · 원형 교대":"달 1개 · 양옆 원형 2개"]].map(([k,v])=><div className={c("summary-row")} key={k}><span>{k}</span><span>{v}</span></div>)}
   {error?<p role="alert" className={c("small-copy")}>{error}</p>:null}<button className={c("button full")} disabled={busy||checkoutBusy} onClick={toCart}>이 구성 장바구니에 담기 ↗</button><p className={c("small-copy")}>시연용 주문 요청으로 연결됩니다. 실제 결제·제작은 진행하지 않습니다.</p>
  </aside>
 </div></div></section></>;
}
