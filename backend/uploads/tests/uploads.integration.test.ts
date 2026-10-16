import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { createAuth } from "../../../frontend/lib/server/auth-core.ts";
import { handleAuth } from "../../../frontend/lib/server/auth-handler.ts";
import { createRuntimePool, verifyRuntimePool, withUserTransaction } from "../../../frontend/lib/server/postgres.ts";
import { createPhotoRepository } from "../../../frontend/lib/server/uploads/repository.ts";
import { createUploadService } from "../../../frontend/lib/server/uploads/service.ts";
import { handleUpload } from "../../../frontend/lib/server/uploads/handler.ts";
import { inspectPhoto } from "../../../frontend/lib/server/uploads/image.ts";
import { UploadError, type PresignInput } from "../../../frontend/lib/server/uploads/policy.ts";
import type { PhotoStorage } from "../../../frontend/lib/server/uploads/storage.ts";

const require=createRequire(new URL("../../../frontend/package.json",import.meta.url));
const {Pool}=require("pg"),sharp=require("sharp");
const baseURL="http://localhost:4301", prefix=`r2-it-${randomUUID()}`;
const ids:string[]=[], mail:{email:string;url:string}[]=[];
let admin:InstanceType<typeof Pool>, app:ReturnType<typeof createRuntimePool>,authPool:ReturnType<typeof createRuntimePool>;
let auth:ReturnType<typeof createAuth>,repo:ReturnType<typeof createPhotoRepository>;
let member:{id:string;cookie:string},guest:{id:string;cookie:string},other:{id:string;cookie:string},quota:{id:string;cookie:string};
let png:Buffer, jpeg:Buffer;
const objects=new Map<string,Buffer>();
let onRead:((key:string)=>Promise<void>)|undefined, onWrite:((key:string)=>Promise<void>)|undefined;
let failWrite=false, signFailure=false, reads=0;
const storage:PhotoStorage={
  async signPut(key){if(signFailure)throw new Error("synthetic-signing-error");return `https://objects.example.invalid/${key}?signature=synthetic`;},
  async read(key){reads++; const snapshot=Buffer.from(objects.get(key)??[]);await onRead?.(key);if(!snapshot.length)throw new Error("Missing synthetic object");return snapshot;},
  async write(key,data){if(failWrite)throw new Error("Synthetic storage outage");objects.set(key,Buffer.from(data));await onWrite?.(key);},
  async signGet(key){return `https://objects.example.invalid/${key}?signature=synthetic`;},
};
let service:ReturnType<typeof createUploadService>;
const input:PresignInput={purpose:"custom_order_photo",fileName:"synthetic.png",mimeType:"image/png",size:1000};
function jar(response:Response){return response.headers.getSetCookie().map(c=>c.split(";",1)[0]).join("; ");}
async function authCall(path:string,body:unknown,cookie?:string){
  return handleAuth(new Request(`${baseURL}/api/auth/${path}`,{method:"POST",headers:{origin:baseURL,"content-type":"application/json",...(cookie?{cookie}:{})},body:JSON.stringify(body)}),auth,{baseURL,emailReady:true});
}
async function newGuest(){const response=await authCall("sign-in/anonymous",{});assert.equal(response.status,200);const dto=await response.json();ids.push(dto.user.id);return{id:dto.user.id,cookie:jar(response)};}
async function call(action:"rules"|"presign"|"complete"|"read-url",who?:{cookie:string},assetId?:string,body?:unknown,
  extra:{origin?:string;enabled?:boolean;identity?:unknown;service?:typeof service}={}){
  const request=new Request(`${baseURL}/api/uploads/${action}`,{method:action==="rules"?"GET":"POST",
    headers:{origin:extra.origin??baseURL,"content-type":"application/json",...(who?{cookie:who.cookie}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  return handleUpload(request,action,{baseURL,enabled:extra.enabled??true,
    identity:async headers=>extra.identity===undefined?(await auth.api.getSession({headers,query:{disableCookieCache:true}}))?.user??null:extra.identity as never,
    service:async()=>extra.service??service},assetId);
}
async function presign(who=guest, bytes=png, mime="image/png"){
  const response=await call("presign",who,undefined,{...input,size:bytes.length,mimeType:mime});
  assert.equal(response.status,201);const dto=await response.json();
  assert.deepEqual(Object.keys(dto).sort(),["assetId","expiresAt","uploadUrl"]);
  const asset=await repo.get(who.id,dto.assetId);objects.set(asset.pending_key,Buffer.from(bytes));return asset;
}
async function error(response:Response,status:number,code:string){assert.equal(response.status,status);assert.equal(response.headers.get("cache-control"),"no-store");assert.deepEqual(Object.keys(await response.clone().json()),["error"]);assert.equal((await response.json()).error.code,code);}

before(async()=>{
  // Never use process env URLs: tests target only this checkout's loopback sunny development DB.
  const env=Object.fromEntries((await readFile(new URL("../../.env.local",import.meta.url),"utf8")).split(/\r?\n/)
    .filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
  const port=env.SUNNY_PG_PORT||"5434";
  const url=(role:string,key:string)=>`postgresql://${role}:${encodeURIComponent(env[key])}@127.0.0.1:${port}/sunny`;
  admin=new Pool({connectionString:url("sunny_admin","SUNNY_PG_ADMIN_PASSWORD"),max:1});
  const {rows:[identity]}=await admin.query("SELECT current_database() AS db,session_user AS role");
  assert.equal(identity.db,"sunny");assert.equal(identity.role,"sunny_admin");
  app=createRuntimePool(url("sunny_app","SUNNY_PG_APP_PASSWORD"),"sunny_app");
  authPool=createRuntimePool(url("sunny_auth","SUNNY_PG_AUTH_PASSWORD"),"sunny_auth");
  auth=createAuth(authPool,{baseURL,secret:randomBytes(48).toString("base64url"),mailer:async message=>{mail.push(message);}});
  repo=createPhotoRepository(app);service=createUploadService(repo,storage);
  png=await sharp({create:{width:1200,height:1000,channels:3,background:"#edcdee"}}).png().toBuffer();
  jpeg=await sharp(png).jpeg().toBuffer();
  guest=await newGuest();other=await newGuest();quota=await newGuest();
  const email=`${prefix}@example.invalid`,password="Synthetic-upload-password-93!";
  assert.equal((await authCall("sign-up/email",{email,password,name:"UploadTest"})).status,200);
  const {rows:[user]}=await admin.query('SELECT id FROM auth."user" WHERE email=$1',[email]);ids.push(user.id);
  const link=new URL(mail.find(m=>m.email===email)!.url);
  assert.equal((await handleAuth(new Request(link),auth,{baseURL,emailReady:true})).status,303);
  const login=await authCall("sign-in/email",{email,password});assert.equal(login.status,200);
  member={id:user.id,cookie:jar(login)};
});
after(async()=>{
  if(admin&&ids.length){
    // Only synthetic IDs created by this test; real users, schemas, volumes and R2 objects are untouched.
    await admin.query("DELETE FROM app.photo_upload_attempts WHERE owner_id=ANY($1::uuid[])",[ids]);
    await admin.query("DELETE FROM app.photo_assets WHERE owner_id=ANY($1::uuid[])",[ids]);
    await admin.query('DELETE FROM auth."user" WHERE id=ANY($1::uuid[])',[ids]);
    await admin.query("DELETE FROM auth.verification WHERE identifier LIKE $1",[`%${prefix}%`]);
  }
  await Promise.all([app?.end(),authPool?.end(),admin?.end()]);
});

test("migration has owner UUID FK, FORCE RLS and isolated runtime privileges; context resets",async()=>{
  await verifyRuntimePool(app,"sunny_app");
  const {rows}=await admin.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r' ORDER BY c.relname`);
  assert.deepEqual(rows.map((r:{relname:string})=>r.relname),["photo_assets","photo_upload_attempts"]);
  assert.ok(rows.every((r:{relrowsecurity:boolean;relforcerowsecurity:boolean})=>r.relrowsecurity&&r.relforcerowsecurity));
  assert.equal((await app.query("SELECT count(*)::int AS n FROM app.photo_assets")).rows[0].n,0);
  await assert.rejects(authPool.query("SELECT * FROM app.photo_assets"));
  for(const sql of ["SELECT * FROM auth.session","CREATE TABLE app.probe(id int)","DELETE FROM app.photo_assets"]){await assert.rejects(app.query(sql));}
  const asset=await presign();
  await assert.rejects(admin.query('DELETE FROM auth."user" WHERE id=$1',[guest.id]),{code:"23503"});
  assert.equal((await withUserTransaction(app,other.id,db=>db.query("SELECT * FROM app.photo_assets WHERE id=$1",[asset.id]))).rowCount,0);
  await assert.rejects(withUserTransaction(app,other.id,db=>db.query("INSERT INTO app.photo_upload_attempts(id,asset_id,owner_id,object_key) VALUES ($1,$2,$3,$4)",[randomUUID(),asset.id,guest.id,`verified/${randomUUID()}`])),{code:"42501"});
  await assert.rejects(withUserTransaction(app,guest.id,async db=>{await db.query("SELECT 1 / 0");}));
  const context=await app.query("SELECT nullif(current_setting('app.user_id',true),'') AS id");assert.equal(context.rows[0].id,null);
});
test("public rules, missing/unverified sessions, Origin, disabled feature and forged owner are safe",async()=>{
  const rules=await call("rules");assert.equal(rules.status,200);assert.equal((await rules.json()).photoRules.provisional,true);
  await error(await call("presign",undefined,undefined,input),401,"AUTHENTICATION_REQUIRED");
  await error(await call("presign",guest,undefined,input,{origin:"https://attacker.example"}),403,"UPLOAD_ORIGIN_REJECTED");
  await error(await call("presign",guest,undefined,input,{enabled:false}),503,"UPLOAD_STORAGE_UNAVAILABLE");
  await error(await call("presign",guest,undefined,input,{identity:{id:guest.id,isAnonymous:false,emailVerified:false}}),403,"UPLOAD_SESSION_NOT_ELIGIBLE");
  await error(await call("presign",guest,undefined,{...input,ownerId:other.id}),400,"INVALID_UPLOAD_REQUEST");
  await error(await call("complete",guest,"not-a-uuid"),400,"INVALID_UPLOAD_REQUEST");
});
test("guest complete is idempotent and verified bytes resist later pending overwrite",async()=>{
  const asset=await presign();let before=reads;
  await error(await call("read-url",guest,asset.id),409,"UPLOAD_NOT_VERIFIED");
  // The read returns a snapshot, then the still-live PUT changes pending before sanitization finishes.
  onRead=async key=>{objects.set(key,Buffer.from("<svg>untrusted replacement</svg>"));};
  const response=await call("complete",guest,asset.id);onRead=undefined;
  assert.equal(response.status,200);const dto=await response.json();assert.equal(dto.status,"verified");
  assert.deepEqual(Object.keys(dto).sort(),["assetId","bytes","height","mimeType","status","width"]);
  const verified=await repo.get(guest.id,asset.id);assert.ok(verified.verified_key);assert.notEqual(verified.pending_key,verified.verified_key);
  assert.equal((await sharp(objects.get(verified.verified_key!)).metadata()).format,"png");
  const again=await call("complete",guest,asset.id);assert.deepEqual(await again.json(),dto);assert.equal(reads,before+1);
  const urls=await Promise.all(Array.from({length:7},()=>call("read-url",guest,asset.id)));
  for(const url of urls){assert.equal(url.status,200);assert.match((await url.json()).readUrl,/\/verified\//);}
  await error(await call("complete",other,asset.id),404,"UPLOAD_NOT_FOUND");
  await error(await call("read-url",member,asset.id),404,"UPLOAD_NOT_FOUND");
  await error(await call("read-url",guest,randomUUID()),404,"UPLOAD_NOT_FOUND");
});
test("verified member has independent ownership; blocked photo cannot issue more read URLs",async()=>{
  const asset=await presign(member,jpeg,"image/jpeg");
  assert.equal((await call("complete",member,asset.id)).status,200);
  assert.equal((await call("read-url",member,asset.id)).status,200);
  await error(await call("read-url",guest,asset.id),404,"UPLOAD_NOT_FOUND");
  await admin.query("UPDATE app.photo_assets SET access_blocked_at=clock_timestamp() WHERE id=$1",[asset.id]);
  await error(await call("read-url",member,asset.id),404,"UPLOAD_NOT_FOUND");
});
test("concurrent complete returns 409 Retry-After:3 and performs only one inspection",async()=>{
  const asset=await presign();let release!:()=>void,entered!:()=>void;
  const blocked=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{entered=r;});
  onRead=async()=>{entered();await blocked;};
  const first=call("complete",guest,asset.id);await started;
  const duplicate=await call("complete",guest,asset.id);assert.equal(duplicate.headers.get("retry-after"),"3");
  await error(duplicate,409,"UPLOAD_INSPECTION_IN_PROGRESS");release();onRead=undefined;
  assert.equal((await first).status,200);
});
test("rejected is terminal, empty/missing object is retryable, expired state persists",async()=>{
  const bad=await presign(guest,Buffer.from("<svg/>"));
  await error(await call("complete",guest,bad.id),415,"UNSUPPORTED_IMAGE_TYPE");
  objects.set(bad.pending_key,png);
  await error(await call("complete",guest,bad.id),415,"UNSUPPORTED_IMAGE_TYPE");
  const missing=await presign();objects.delete(missing.pending_key);
  await error(await call("complete",guest,missing.id),503,"UPLOAD_STORAGE_UNAVAILABLE");
  assert.equal((await repo.get(guest.id,missing.id)).status,"pending");
  objects.set(missing.pending_key,png);assert.equal((await call("complete",guest,missing.id)).status,200);
  const expired=await presign();
  await admin.query(`UPDATE app.photo_assets SET created_at=clock_timestamp()-interval '1000 seconds',
    put_expires_at=clock_timestamp()-interval '600 seconds',complete_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1`,[expired.id]);
  await error(await call("complete",guest,expired.id),410,"UPLOAD_EXPIRED");
  assert.equal((await repo.get(guest.id,expired.id)).status,"expired");
});
test("inspection capacity is bounded and an in-progress duplicate still receives 409",async()=>{
  const first=await presign(),second=await presign(),third=await presign();
  let release!:()=>void,entered!:()=>void,number=0;
  const blocked=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{entered=r;});
  onRead=async()=>{if(++number===2)entered();await blocked;};
  const running=[call("complete",guest,first.id),call("complete",guest,second.id)];
  try{
    await started;
    await error(await call("complete",guest,first.id),409,"UPLOAD_INSPECTION_IN_PROGRESS");
    await error(await call("complete",guest,third.id),503,"UPLOAD_STORAGE_UNAVAILABLE");
  }finally{release();onRead=undefined;await Promise.all(running);}
  assert.equal((await repo.get(guest.id,third.id)).status,"pending");
});
test("storage outage and DB finalization failure recover without losing orphan candidate keys",async()=>{
  const failed=await presign();failWrite=true;
  await error(await call("complete",guest,failed.id),503,"UPLOAD_STORAGE_UNAVAILABLE");failWrite=false;
  assert.equal((await repo.get(guest.id,failed.id)).status,"pending");
  assert.equal((await call("complete",guest,failed.id)).status,200);
  const dbFailure=await presign();const broken=createUploadService({...repo,finish:async()=>{throw new Error("Synthetic DB commit failure");}},storage);
  await error(await call("complete",guest,dbFailure.id,undefined,{service:broken}),503,"UPLOAD_STORAGE_UNAVAILABLE");
  const candidates=await admin.query("SELECT object_key,published_at FROM app.photo_upload_attempts WHERE asset_id=$1",[dbFailure.id]);
  assert.equal(candidates.rowCount,1);assert.equal(candidates.rows[0].published_at,null);assert.ok(objects.has(candidates.rows[0].object_key));
  assert.equal((await call("complete",guest,dbFailure.id)).status,200);
  assert.equal((await admin.query("SELECT count(*)::int AS n FROM app.photo_upload_attempts WHERE asset_id=$1",[dbFailure.id])).rows[0].n,2);
});
test("stale inspection lease recovers; old token cannot publish or undo a newer verified result",async()=>{
  const asset=await presign(),old=await repo.claim(guest.id,asset.id);assert.equal(old.claimed,true);
  await admin.query("UPDATE app.photo_assets SET inspection_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[asset.id]);
  assert.equal((await call("complete",guest,asset.id)).status,200);
  const current=await repo.get(guest.id,asset.id);
  await assert.rejects(repo.finish(guest.id,asset.id,old.asset.inspection_token!,await inspectPhoto(png,"image/png")),(e:unknown)=>e instanceof UploadError&&e.code==="UPLOAD_STORAGE_UNAVAILABLE");
  await repo.fail(guest.id,asset.id,old.asset.inspection_token!,"INVALID_IMAGE_FILE");
  assert.equal((await repo.get(guest.id,asset.id)).verified_key,current.verified_key);
});
test("lease lost after object write cannot publish and is recoverable with a new attempt",async()=>{
  const asset=await presign();
  onWrite=async()=>{await admin.query("UPDATE app.photo_assets SET inspection_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[asset.id]);};
  try{await error(await call("complete",guest,asset.id),503,"UPLOAD_STORAGE_UNAVAILABLE");}finally{onWrite=undefined;}
  assert.equal((await repo.get(guest.id,asset.id)).status,"pending");
  assert.equal((await call("complete",guest,asset.id)).status,200);
});
test("presign rollback on signing failure, atomic 20/60m quota and bounded Retry-After",async()=>{
  const before=await admin.query("SELECT count(*)::int AS n FROM app.photo_assets WHERE owner_id=$1",[other.id]);
  signFailure=true;await error(await call("presign",other,undefined,input),503,"UPLOAD_STORAGE_UNAVAILABLE");signFailure=false;
  assert.equal((await admin.query("SELECT count(*)::int AS n FROM app.photo_assets WHERE owner_id=$1",[other.id])).rows[0].n,before.rows[0].n);
  const results=await Promise.all(Array.from({length:25},()=>call("presign",quota,undefined,input)));
  assert.equal(results.filter(r=>r.status===201).length,20);assert.equal(results.filter(r=>r.status===429).length,5);
  for(const response of results.filter(r=>r.status===429)){assert.ok(Number(response.headers.get("retry-after"))>0&&Number(response.headers.get("retry-after"))<=3600);await error(response,429,"UPLOAD_RATE_LIMITED");}
  const nextHour=await admin.query("SELECT id FROM app.photo_assets WHERE owner_id=$1 ORDER BY created_at LIMIT 1",[quota.id]);
  await admin.query("UPDATE app.photo_assets SET created_at=clock_timestamp()-interval '61 minutes' WHERE id=$1",[nextHour.rows[0].id]);
  assert.equal((await call("presign",quota,undefined,input)).status,201);
});
test("DB-expired and logged-out sessions cannot issue URLs, no cookie-cache fallback",async()=>{
  const asset=await presign(other);
  await admin.query('UPDATE auth.session SET "expiresAt"=clock_timestamp()-interval \'1 second\' WHERE "userId"=$1',[other.id]);
  await error(await call("read-url",other,asset.id),401,"AUTHENTICATION_REQUIRED");
  assert.equal((await authCall("sign-out",{},guest.cookie)).status,200);
  await error(await call("presign",guest,undefined,input),401,"AUTHENTICATION_REQUIRED");
});
