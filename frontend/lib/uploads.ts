"use client";
import type {PhotoRules} from "./photo.ts";
import {checkPhotoFile,checkPhotoSize} from "./photo.ts";
export type UploadAttempt={assetId:string;uploadUrl:string;expiresAt:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const messages:Record<string,string>={AUTHENTICATION_REQUIRED:"로그인 또는 게스트 세션을 시작해 주세요.",UPLOAD_NOT_RECEIVED:"사진 업로드가 확인되지 않았습니다. 같은 사진으로 다시 시도해 주세요.",
 UPLOAD_RATE_LIMITED:"사진 업로드 요청이 많습니다. 잠시 후 다시 시도해 주세요.",UPLOAD_STORAGE_UNAVAILABLE:"사진 업로드 서비스를 준비하고 있습니다. 잠시 후 다시 시도해 주세요.",
 UPLOAD_SESSION_NOT_ELIGIBLE:"이메일 인증을 완료한 뒤 다시 로그인해 주세요.",UPLOAD_EXPIRED:"업로드 기한이 지났습니다. 사진을 다시 선택해 주세요."};
export class PhotoUploadError extends Error{readonly code:string;constructor(code:string){super(messages[code]??"사진 규칙과 업로드 상태를 다시 확인해 주세요.");this.code=code;}}
export class PhotoInputError extends Error {}
export function photoErrorMessage(error:unknown){return error instanceof PhotoUploadError||error instanceof PhotoInputError?error.message:"사진 업로드 연결을 확인하고 다시 시도해 주세요.";}
async function api(path:string,body?:unknown){
 const response=await fetch(`/api/uploads/${path}`,{method:path==="photo-rules"?"GET":"POST",credentials:"same-origin",cache:"no-store",
  signal:AbortSignal.timeout(20000),...(body===undefined?{}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})});
 const data=await response.json().catch(()=>null);return {response,data};
}
function fail(data:unknown):never{throw new PhotoUploadError((data as {error?:{code?:string}})?.error?.code??"UPLOAD_STORAGE_UNAVAILABLE");}
function secureURL(value:unknown):value is string{try{const u=new URL(String(value));return typeof value==="string"&&u.protocol==="https:"&&!u.username&&!u.password;}catch{return false;}}
export async function getPhotoRules():Promise<PhotoRules>{
 const {response,data}=await api("photo-rules");if(!response.ok)fail(data);const r=data?.photoRules;
 if(!r||!Array.isArray(r.accept)||!r.accept.length||!r.accept.every((m:unknown)=>typeof m==="string"&&/^image\/[a-z0-9.+-]+$/.test(m))
  ||![r.maxBytes,r.minWidth,r.minHeight].every(v=>Number.isSafeInteger(v)&&v>0)||typeof r.provisional!=="boolean"
  ||(r.aspectRatio!==undefined&&r.aspectRatio!==null))throw new PhotoUploadError("INVALID_PHOTO_RULES");
 return {accept:[...r.accept],maxBytes:r.maxBytes,minWidth:r.minWidth,minHeight:r.minHeight,provisional:r.provisional};
}
export async function checkPhoto(file:File,rules:PhotoRules):Promise<{url:string;width:number;height:number}>{
 const error=checkPhotoFile(file,rules);if(error)throw new PhotoInputError(error);
 const url=URL.createObjectURL(file);
 try{const image=new Image();image.src=url;await image.decode();const size=checkPhotoSize(image.naturalWidth,image.naturalHeight,rules);if(size)throw new PhotoInputError(size);
  return {url,width:image.naturalWidth,height:image.naturalHeight};}
 catch(error){URL.revokeObjectURL(url);throw error instanceof PhotoInputError?error:new PhotoInputError("이미지로 열 수 없는 파일입니다.");}
}
export async function uploadPhoto(file:File,options:{attempt?:UploadAttempt;onAttempt?:(a:UploadAttempt)=>void}={}):Promise<string>{
 let attempt=options.attempt;
 if(!attempt||Date.parse(attempt.expiresAt)<=Date.now()){
  const {response,data}=await api("presign",{purpose:"custom_order_photo",fileName:file.name,mimeType:file.type,size:file.size});if(!response.ok)fail(data);
  if(!uuid.test(data?.assetId??"")||!secureURL(data?.uploadUrl)||!Number.isFinite(Date.parse(data?.expiresAt)))throw new PhotoUploadError("INVALID_UPLOAD_RESPONSE");
  attempt={assetId:data.assetId,uploadUrl:data.uploadUrl,expiresAt:data.expiresAt};options.onAttempt?.(attempt);
 }
 const put=await fetch(attempt.uploadUrl,{method:"PUT",headers:{"Content-Type":file.type},body:file,credentials:"omit",redirect:"error",signal:AbortSignal.timeout(30000)});
 if(!put.ok)throw new PhotoUploadError("UPLOAD_NOT_RECEIVED");
 for(let extra=0;extra<=10;extra++){
  const {response,data}=await api(`${attempt.assetId}/complete`);
  if(response.ok){if(data?.status!=="verified"||data.assetId!==attempt.assetId)throw new PhotoUploadError("INVALID_UPLOAD_RESPONSE");return attempt.assetId;}
  const code=data?.error?.code;
  if(extra===10||!(response.status===503||code==="UPLOAD_INSPECTION_IN_PROGRESS"))fail(data);
  const raw=response.headers.get("Retry-After"),seconds=raw&&/^[0-9]{1,5}$/.test(raw)?Number(raw):3;
  await new Promise(r=>setTimeout(r,Math.max(1,seconds)*1000));
 }
 throw new PhotoUploadError("UPLOAD_STORAGE_UNAVAILABLE");
}
export async function readPhotoURL(assetId:string):Promise<{url:string;expiresAt:string}>{
 if(!uuid.test(assetId))throw new PhotoUploadError("INVALID_UPLOAD_RESPONSE");
 const {response,data}=await api(`${assetId}/read-url`);if(!response.ok)fail(data);
 if(!secureURL(data?.readUrl)||!Number.isFinite(Date.parse(data?.expiresAt)))throw new PhotoUploadError("INVALID_UPLOAD_RESPONSE");
 return {url:data.readUrl,expiresAt:data.expiresAt};
}
