import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { crc32 } from "node:zlib";
import { inspectPhoto } from "../../../frontend/lib/server/uploads/image.ts";
import { photoRules, UploadError, parsePresign } from "../../../frontend/lib/server/uploads/policy.ts";
import { boundedObjectRead, createR2Storage, r2Config } from "../../../frontend/lib/server/uploads/storage.ts";
import { uploadDevelopmentEnabled } from "../../../frontend/lib/server/uploads/runtime.ts";
const require = createRequire(new URL("../../../frontend/package.json", import.meta.url));
const sharp = require("sharp");
const image = (width=1200,height=1000) => sharp({create:{width,height,channels:3,background:"#eeddee"}});
const code = (expected:string) => (error:unknown) => error instanceof UploadError && error.code===expected;

test("JPEG orientation is applied and re-encoding strips EXIF including original metadata",async()=>{
  const input=await image().jpeg().withMetadata({orientation:6,exif:{IFD0:{Artist:"Synthetic test only"}}}).toBuffer();
  assert.ok((await sharp(input).metadata()).exif);
  const result=await inspectPhoto(input,"image/jpeg"); const metadata=await sharp(result.data).metadata();
  assert.equal(result.width,1000);assert.equal(result.height,1200); assert.equal(result.bytes,result.data.length);
  assert.equal(result.mimeType,"image/jpeg"); assert.match(result.sha256,/^[a-f0-9]{64}$/);
  for (const key of ["exif","orientation","xmp","iptc","icc"]) assert.equal(metadata[key],undefined);
});
test("PNG is fully decoded, sanitized and remains PNG",async()=>{
  const result=await inspectPhoto(await image().png().toBuffer(),"image/png");
  assert.equal(result.mimeType,"image/png");assert.equal((await sharp(result.data).metadata()).format,"png");
});
test("SVG, MIME spoofing, empty/truncated files, oversized bytes and too-small images are rejected",async()=>{
  await assert.rejects(inspectPhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),"image/png"),code("UNSUPPORTED_IMAGE_TYPE"));
  const jpg=await image().jpeg().toBuffer();
  await assert.rejects(inspectPhoto(jpg,"image/png"),code("UNSUPPORTED_IMAGE_TYPE"));
  await assert.rejects(inspectPhoto(jpg.subarray(0,200),"image/jpeg"),code("INVALID_IMAGE_FILE"));
  await assert.rejects(inspectPhoto(Buffer.alloc(0),"image/jpeg"),code("INVALID_IMAGE_FILE"));
  await assert.rejects(inspectPhoto(Buffer.alloc(photoRules.maxBytes+1),"image/png"),code("FILE_TOO_LARGE"));
  await assert.rejects(inspectPhoto(await image(999,1100).png().toBuffer(),"image/png"),code("IMAGE_DIMENSIONS_TOO_SMALL"));
});
test("decoder rejects pixel bombs, overlong dimensions and animated PNG",async()=>{
  const png=await image(1000,1000).png().toBuffer();
  const bomb=Buffer.from(png);bomb.writeUInt32BE(8000,16);bomb.writeUInt32BE(6000,20);
  bomb.writeUInt32BE(crc32(bomb.subarray(12,29)),29);
  await assert.rejects(inspectPhoto(bomb,"image/png"),code("INVALID_IMAGE_FILE"));
  await assert.rejects(inspectPhoto(await image(8001,1000).png().toBuffer(),"image/png"),code("INVALID_IMAGE_FILE"));
  const actl=Buffer.alloc(20);actl.writeUInt32BE(8,0);actl.write("acTL",4);actl.writeUInt32BE(2,8);
  actl.writeUInt32BE(crc32(actl.subarray(4,16)),16);
  await assert.rejects(inspectPhoto(Buffer.concat([png.subarray(0,33),actl,png.subarray(33)]),"image/png"),code("INVALID_IMAGE_FILE"));
});
test("bounded object stream stops at the byte limit and closes iterator",async()=>{
  let closed=false,tailRead=false;
  async function* chunks(){try {yield Buffer.alloc(6);yield Buffer.alloc(6);tailRead=true;yield Buffer.alloc(6);}finally{closed=true;}}
  await assert.rejects(boundedObjectRead(chunks(),10),code("FILE_TOO_LARGE"));assert.equal(closed,true);assert.equal(tailRead,false);
});
test("S3 signatures bind PUT Content-Type, exact key and expiry; GET disables caching",async()=>{
  const store=createR2Storage({accountId:"0".repeat(32),bucket:"synthetic-test",accessKeyId:"synthetic-access",secretAccessKey:"synthetic-secret"});
  const time=new Date("2026-10-16T00:00:00Z");
  const put=new URL(await store.signPut("pending/fake","image/png",300,time));
  assert.equal(put.protocol,"https:");assert.match(put.hostname,/r2\.cloudflarestorage\.com$/);
  assert.equal(put.searchParams.get("X-Amz-Expires"),"300");
  assert.match(put.searchParams.get("X-Amz-SignedHeaders")!,/content-type/);assert.match(put.pathname,/pending\/fake$/);
  const get=new URL(await store.signGet("verified/fake",300,time));
  assert.equal(get.searchParams.get("response-cache-control"),"no-store");assert.match(get.pathname,/verified\/fake$/);
});
test("input and runtime flags reject extra owner fields, missing keys and production activation",()=>{
  const input={purpose:"custom_order_photo",fileName:"test.jpg",mimeType:"image/jpeg",size:100};
  assert.throws(()=>parsePresign({...input,ownerId:"forged"}),code("INVALID_UPLOAD_REQUEST"));
  assert.throws(()=>parsePresign({...input,size:1.5}),code("INVALID_UPLOAD_REQUEST"));
  assert.throws(()=>r2Config({}),code("UPLOAD_STORAGE_UNAVAILABLE"));
  const env={PHOTO_UPLOAD_ENABLED:"true",AUTH_ENABLED:"true",BETTER_AUTH_URL:"http://localhost:3000",NODE_ENV:"development"};
  assert.equal(uploadDevelopmentEnabled(env),true);
  assert.equal(uploadDevelopmentEnabled({...env,NODE_ENV:"production"}),false);
  assert.equal(uploadDevelopmentEnabled({...env,BETTER_AUTH_URL:"https://public.example"}),false);
  assert.equal(uploadDevelopmentEnabled({...env,PHOTO_UPLOAD_ENABLED:"false"}),false);
});
