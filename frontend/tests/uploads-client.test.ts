import {test} from "node:test";
import assert from "node:assert/strict";
import {getPhotoRules,uploadPhoto,PhotoUploadError,type UploadAttempt} from "../lib/uploads.ts";
import {checkPhotoFile,checkPhotoSize} from "../lib/photo.ts";
const id="00000000-0000-4000-8000-000000000002";
const signed={assetId:id,uploadUrl:"https://synthetic.r2.example.invalid/pending?signature=synthetic",expiresAt:"2099-01-01T00:00:00.000Z"};
test("client validation follows photo-rules values and cannot fall back to local WebP/8MB rules",async t=>{
 t.mock.method(globalThis,"fetch",async(url:string,init:RequestInit)=>{
  assert.equal(url,"/api/uploads/photo-rules");assert.equal(init.cache,"no-store");
  return Response.json({photoRules:{accept:["image/png"],maxBytes:2048,minWidth:10,minHeight:20,aspectRatio:null,provisional:true}});
 });
 const rules=await getPhotoRules();assert.match(checkPhotoFile({type:"image/webp",size:100,name:"synthetic.webp"},rules)!,/PNG/);
 assert.match(checkPhotoFile({type:"image/png",size:2049,name:"synthetic.png"},rules)!,/큽니다/);
 assert.match(checkPhotoSize(50,19,rules)!,/10×20/);
});
test("PUT failure retains the same upload attempt; complete only follows successful PUT",async t=>{
 let captured:UploadAttempt|undefined,putOK=false;const seen:string[]=[];
 t.mock.method(globalThis,"fetch",async(url:string,init:RequestInit)=>{
  seen.push(url);
  if(url.endsWith("presign"))return Response.json(signed,{status:201});
  if(url.startsWith("https:")){assert.equal(init.credentials,"omit");assert.equal(init.method,"PUT");return new Response(null,{status:putOK?200:403});}
  assert.equal(url,`/api/uploads/${id}/complete`);return Response.json({assetId:id,status:"verified"});
 });
 const file=new File(["synthetic"],"synthetic.png",{type:"image/png"});
 await assert.rejects(uploadPhoto(file,{onAttempt:a=>captured=a}),e=>e instanceof PhotoUploadError&&e.code==="UPLOAD_NOT_RECEIVED");
 assert.equal(seen.length,2);putOK=true;
 assert.equal(await uploadPhoto(file,{attempt:captured}),id);assert.equal(seen.filter(u=>u.endsWith("presign")).length,1);
});
test("NoSuchKey response does not trigger complete polling or fake verification",async t=>{
 let calls=0;t.mock.method(globalThis,"fetch",async(url:string)=>{
  if(url.endsWith("presign"))return Response.json(signed,{status:201});
  if(url.startsWith("https:"))return new Response(null,{status:200});
  calls++;return Response.json({error:{code:"UPLOAD_NOT_RECEIVED",message:"private provider error"}},{status:409});
 });
 await assert.rejects(uploadPhoto(new File(["synthetic"],"test.png",{type:"image/png"})),e=>e instanceof PhotoUploadError&&e.code==="UPLOAD_NOT_RECEIVED"&&!e.message.includes("private"));
 assert.equal(calls,1);
});
