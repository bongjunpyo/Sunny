import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { createAuth } from "../../../frontend/lib/server/auth-core.ts";
import { handleAuth } from "../../../frontend/lib/server/auth-handler.ts";
import { createRuntimePool, verifyRuntimePool, withUserTransaction } from "../../../frontend/lib/server/postgres.ts";
import { createOrderRepository } from "../../../frontend/lib/server/orders/repository.ts";
import { handleOrder } from "../../../frontend/lib/server/orders/handler.ts";
import { parseOrderInput, parseOrderPage, OrderError, payloadHash } from "../../../frontend/lib/server/orders/policy.ts";
import { orderDemoEnabled } from "../../../frontend/lib/server/orders/runtime.ts";
import { DEMO_ORDER_POLICIES } from "../../../frontend/lib/order-policy.ts";
import type { OrderInput, OrderItemInput } from "../../../frontend/lib/order-types.ts";
import { PHOTOCHROMIC_COLORS, type Product } from "../../../frontend/lib/types.ts";
const require=createRequire(new URL("../../../frontend/package.json",import.meta.url));
const {Pool}=require("pg");
const base="http://localhost:4302";
type Who={id:string;cookie:string};
let admin:InstanceType<typeof Pool>,app:ReturnType<typeof createRuntimePool>,authPool:ReturnType<typeof createRuntimePool>;
let auth:ReturnType<typeof createAuth>,repo:ReturnType<typeof createOrderRepository>,alice:Who,bob:Who,member:Who;
const mail:{email:string;url:string}[]=[],ids:string[]=[];
const products:Product[]=[{slug:"light-study-01",kind:"bracelet",name:"Synthetic Bracelet",summary:"",story:[],colors:[...PHOTOCHROMIC_COLORS],status:"planning"},{slug:"light-study-02",kind:"necklace",name:"Synthetic Necklace",summary:"",story:[],colors:[...PHOTOCHROMIC_COLORS],status:"planning"}];
function item(photo:string|null=null):OrderItemInput {return {productSlug:"light-study-01",productKind:"bracelet",color:"violet",lengthCm:18,quantity:1,
  beadLayout:{squareCount:7,beads:Array.from({length:7},(_,index)=>({index,photoAssetId:index<2?photo:null}))},previewConfirmed:true,
  ...(photo?{photoProductionConsent:{accepted:true,policyVersion:DEMO_ORDER_POLICIES.photoProductionConsent.version},
    photoBrandUseConsent:{accepted:false,policyVersion:DEMO_ORDER_POLICIES.photoBrandUseConsent.version}}:{})};}
function input(photo:string|null=null):OrderInput{return {items:[item(photo)]};}
function necklace(quantity=1):OrderItemInput{return {productSlug:"light-study-02",productKind:"necklace",color:"blue",lengthCm:45,quantity,beadLayout:{moonCount:1,roundCount:2},previewConfirmed:true};}
const cookie=(r:Response)=>r.headers.getSetCookie().map(c=>c.split(";",1)[0]).join("; ");
async function authCall(path:string,b:unknown){return handleAuth(new Request(`${base}/api/auth/${path}`,{method:"POST",headers:{origin:base,"content-type":"application/json"},body:JSON.stringify(b)}),auth,{baseURL:base,emailReady:true});}
async function guest(){const r=await authCall("sign-in/anonymous",{});assert.equal(r.status,200);const d=await r.json();ids.push(d.user.id);return{id:d.user.id,cookie:cookie(r)};}
async function call(action:"create"|"list"|"detail",who:Who|null=alice,b:unknown=input(),key=randomUUID(),id?:string,query="",extra:Record<string,string>={}){
  const request=new Request(`${base}/api/orders${query}`,{method:action==="create"?"POST":"GET",
    headers:{...(action==="create"?{origin:base,"content-type":"application/json","idempotency-key":key}:{}),...(who?{cookie:who.cookie}:{}),...extra},
    ...(action==="create"?{body:JSON.stringify(b)}:{})});
  return handleOrder(request,action,{baseURL:base,enabled:true,repository:async()=>repo,identity:async headers=>{
    const s=await auth.api.getSession({headers,query:{disableCookieCache:true},returnHeaders:true});return s.response?{user:s.response.user,headers:s.headers}:null;
  }},id);
}
async function fail(r:Response,status:number,code:string){assert.equal(r.status,status);assert.equal(r.headers.get("cache-control"),"no-store");
  const b=await r.json();assert.deepEqual(Object.keys(b),["error"]);assert.equal(b.error.code,code);}
async function photo(owner:string,status="verified"){
  const id=randomUUID();await admin.query(`INSERT INTO app.photo_assets(id,owner_id,purpose,declared_mime,declared_bytes,status,pending_key,
    created_at,put_expires_at,complete_expires_at,pending_cleanup_after,verified_key,mime_type,bytes,width,height,sha256)
    VALUES($1,$2,'custom_order_photo','image/png',10,$3,$4,clock_timestamp(),clock_timestamp()+interval '5m',clock_timestamp()+interval '15m',
    clock_timestamp()+interval '20m',$5,$6,$7,$8,$9,$10)`,[id,owner,status,`pending/${randomUUID()}`,
    status==="verified"?`verified/${randomUUID()}`:null,status==="verified"?"image/png":null,status==="verified"?10:null,
    status==="verified"?1000:null,status==="verified"?1000:null,status==="verified"?"a".repeat(64):null]);return id;
}
const stamp="2026-11-03T00:00:00.000Z";
async function insertGroup(db:import("pg").PoolClient,owner:string){
 const group=randomUUID();await db.query("INSERT INTO app.order_checkouts(id,owner_id,idempotency_key,request_payload_hash,created_at) VALUES($1,$2,$3,$4,$5)",[group,owner,randomUUID(),"a".repeat(64),stamp]);return group;
}
async function insertLine(db:import("pg").PoolClient,owner:string,id:string,{checkout,position=0,kind="bracelet",color="violet"}:{checkout?:string;position?:number;kind?:string;color?:string}={}){
 const group=checkout??await insertGroup(db,owner);
 await db.query(`INSERT INTO app.orders(id,owner_id,product_slug,product_kind,product_name,catalog_source,color,length_cm,
  preview_confirmed,preview_confirmed_at,created_at,checkout_id,item_position,quantity)
  VALUES($1,$2,'synthetic',$3,'Synthetic','DEMO_CATALOG',$4,$5,true,$6,$6,$7,$8,1)`,[id,owner,kind,color,kind==="bracelet"?18:45,stamp,group,position]);
}
before(async()=>{
  assert.ok(process.env.SUNNY_ORDER_TEST_CONFIG,"Run python3 backend/orders/run-isolated-tests.py in an isolated checkout");
  const config=JSON.parse(await readFile(process.env.SUNNY_ORDER_TEST_CONFIG,"utf8"));
  assert.match(config.container,/^sunny-order-test-[a-f0-9]{12}$/);assert.notEqual(config.port,5434);
  for(const role of ["admin","app","auth"]){const u=new URL(config[role]);assert.equal(u.hostname,"127.0.0.1");assert.equal(Number(u.port),config.port);assert.equal(u.pathname,"/sunny");}
  admin=new Pool({connectionString:config.admin,max:2});app=createRuntimePool(config.app,"sunny_app");authPool=createRuntimePool(config.auth,"sunny_auth");
  await verifyRuntimePool(app,"sunny_app");
  auth=createAuth(authPool,{baseURL:base,secret:randomBytes(48).toString("base64url"),mailer:async m=>{mail.push(m);}});
  repo=createOrderRepository(app,async()=>products);alice=await guest();bob=await guest();
  const email=`orders-${randomUUID()}@example.invalid`,password="Synthetic-order-test-100!";
  assert.equal((await authCall("sign-up/email",{email,password,name:"OrderTest"})).status,200);
  const {rows:[user]}=await admin.query('SELECT id FROM auth."user" WHERE email=$1',[email]);ids.push(user.id);
  assert.equal((await handleAuth(new Request(mail[0].url),auth,{baseURL:base,emailReady:true})).status,303);
  const login=await authCall("sign-in/email",{email,password});member={id:user.id,cookie:cookie(login)};
});
after(async()=>{await Promise.all([app?.end(),authPool?.end(),admin?.end()]);}); // Entire owned tmpfs cluster is removed by runner.

test("seven slots, preview, owner fields, kinds/lengths and consent shapes are validated",()=>{
  const baseItem=item();
  const bad:unknown[]=[{...input(),ownerId:alice.id},{items:[{...baseItem,previewConfirmed:false}]},{items:[{...baseItem,lengthCm:45}]},
    {items:[{...baseItem,quantity:0}]},{items:[{...baseItem,quantity:11}]},{items:[]},{items:Array(21).fill(baseItem)},
    {items:Array(11).fill({...baseItem,quantity:10})},
    {items:[{...baseItem,beadLayout:{squareCount:7,beads:(baseItem.beadLayout as {beads:unknown[]}).beads.slice(0,6)}}]},
    {items:[{...baseItem,beadLayout:{squareCount:7,beads:Array(7).fill({index:0,photoAssetId:null})}}]},
    {items:[{...necklace(),beadLayout:baseItem.beadLayout}]},
    {items:[{...necklace(),photoProductionConsent:{accepted:true,policyVersion:"SUNNY_DEMO_PRODUCTION_V1"}}]},
    {items:[{...item(randomUUID()),photoProductionConsent:{accepted:false,policyVersion:"SUNNY_DEMO_PRODUCTION_V1"}}]},
    {items:[{...item(randomUUID()),photoProductionConsent:{accepted:true,policyVersion:"SUNNY_DEMO_PRODUCTION_V1",acceptedAt:"client"}}]}];
  for(const b of bad)assert.throws(()=>parseOrderInput(b),e=>e instanceof OrderError && e.code==="INVALID_ORDER_REQUEST");
  const shuffled=input();(shuffled.items[0].beadLayout as {beads:unknown[]}).beads.reverse();assert.equal(payloadHash(parseOrderInput(shuffled)),payloadHash(input()));
});
test("guest creates seven photo-free slots; DTO has no secrets and is readable only by its session",async()=>{
  const response=await call("create");assert.equal(response.status,201);assert.equal(response.headers.get("cache-control"),"no-store");
  const d=await response.json();assert.equal(d.order.status,"REQUESTED");assert.equal(d.order.mode,"DEMO");assert.equal(d.order.items[0].beadLayout.beads.length,7);
  assert.equal(d.order.photoCount,0);assert.deepEqual(d.order.items[0].consents,{});assert.equal(d.order.createdAt,d.order.items[0].previewConfirmedAt);
  assert.equal(d.nextPath,`/orders?submitted=${d.order.orderId}`);assert.equal(d.noticeCode,"DEMO_ORDER_REQUEST_APPROVED");
  for(const sensitive of [alice.id,"owner_id","token","request_payload_hash","idempotency_key","PAID"])assert.equal(JSON.stringify(d).includes(sensitive),false);
  assert.deepEqual((await(await call("detail",alice,undefined,undefined,d.order.orderId)).json()).order,d.order);
  await fail(await call("detail",bob,undefined,undefined,d.order.orderId),404,"ORDER_NOT_FOUND");
  await fail(await call("detail",bob,undefined,undefined,randomUUID()),404,"ORDER_NOT_FOUND");
  await fail(await call("detail",member,undefined,undefined,d.order.orderId),404,"ORDER_NOT_FOUND");
});
test("one checkout atomically stores mixed products and quantities with round-moon-round necklace",async()=>{
  const first={...item(),quantity:2},body={items:[first,necklace(3)]},key=randomUUID();
  const response=await call("create",alice,body,key);assert.equal(response.status,201);const {order}=await response.json();
  assert.equal(order.itemCount,2);assert.equal(order.totalQuantity,5);assert.equal(order.items[0].beadLayout.beads.length,7);
  assert.deepEqual(order.items[1].beadLayout.beads.map((b:{shape:string;photoAssetId:null})=>[b.shape,b.photoAssetId]),[["round",null],["moon",null],["round",null]]);
  assert.equal((await call("create",alice,body,key)).status,200);
  await fail(await call("create",alice,{items:[first,necklace(4)]},key),409,"ORDER_IDEMPOTENCY_CONFLICT");
  const rows=(await admin.query("SELECT quantity FROM app.orders WHERE checkout_id=$1 ORDER BY item_position",[order.orderId])).rows;
  assert.deepEqual(rows.map((r:{quantity:number})=>r.quantity),[2,3]);
});
test("invalid later item leaves neither a checkout nor its valid first item",async()=>{
  const before=(await admin.query("SELECT (SELECT count(*) FROM app.orders)::int AS lines,(SELECT count(*) FROM app.order_checkouts)::int AS groups")).rows[0];
  await fail(await call("create",alice,{items:[item(),item(await photo(bob.id)),necklace()]}),409,"ORDER_PHOTO_NOT_READY");
  assert.deepEqual((await admin.query("SELECT (SELECT count(*) FROM app.orders)::int AS lines,(SELECT count(*) FROM app.order_checkouts)::int AS groups")).rows[0],before);
});
test("mixed bracelet round-trips but necklace and unsupported catalog mix are rejected",async()=>{
  const mixed={items:[{...item(),color:"mixed"}]},r=await call("create",alice,mixed);assert.equal(r.status,201);
  const {order}=await r.json();assert.equal(order.items[0].color,"mixed");
  assert.equal((await repo.get(alice.id,order.orderId)).items[0].color,"mixed");
  await fail(await call("create",alice,{items:[{...necklace(),color:"mixed"}]}),400,"INVALID_ORDER_REQUEST");
  const unsupported=createOrderRepository(app,async()=>products.map(p=>({...p,colors:PHOTOCHROMIC_COLORS.filter(c=>c==="violet")})));
  await assert.rejects(unsupported.create(alice.id,parseOrderInput(mixed),randomUUID()),e=>e instanceof OrderError&&e.code==="INVALID_ORDER_REQUEST");
});
test("deferred cart constraints reject empty groups and wrong necklace shapes, rolling back every item",async()=>{
  const stamp="2026-11-03T00:00:00.000Z";
  for(const empty of [true,false]){
    const group=randomUUID();
    await assert.rejects(withUserTransaction(app,alice.id,async db=>{
      await db.query("INSERT INTO app.order_checkouts(id,owner_id,idempotency_key,request_payload_hash,created_at) VALUES($1,$2,$3,$4,$5)",[group,alice.id,randomUUID(),"a".repeat(64),stamp]);
      if(empty)return;
      for(const [position,kind] of ["bracelet","necklace"].entries()){
        const id=randomUUID();
        await insertLine(db,alice.id,id,{checkout:group,position,kind});
        // Valid first bracelet, deliberately invalid all-square necklace.
        for(let index=0;index<(kind==="bracelet"?7:3);index++)await db.query("INSERT INTO app.order_beads(order_id,owner_id,slot_index,shape) VALUES($1,$2,$3,'square')",[id,alice.id,index]);
      }
    }),(e:unknown)=>(e as {code:string}).code==="23514");
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM app.order_checkouts WHERE id=$1",[group])).rows[0].n,0);
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM app.orders WHERE checkout_id=$1",[group])).rows[0].n,0);
  }
});
test("repeated own verified photo is allowed; production and declined brand receipts use server times",async()=>{
  const id=await photo(alice.id),r=await call("create",alice,input(id));assert.equal(r.status,201);const {order}=await r.json();
  assert.equal(order.photoCount,2);assert.equal(order.items[0].beadLayout.beads[0].photoAssetId,order.items[0].beadLayout.beads[1].photoAssetId);
  assert.equal(order.items[0].consents.photoProductionConsent.acceptedAt,order.createdAt);
  assert.equal(order.items[0].consents.photoBrandUseConsent.acceptedAt,null);assert.equal(order.items[0].consents.photoBrandUseConsent.recordedAt,order.createdAt);
  const {rows}=await admin.query("SELECT policy_text,policy_sha256 FROM app.order_consents WHERE order_id=$1",[order.items[0].itemId]);
  for(const row of rows)assert.equal(createHash("sha256").update(row.policy_text).digest("hex"),row.policy_sha256);
});
test("foreign, missing, pending and blocked photos share a safe error and leave no partial order",async()=>{
  const blocked=await photo(alice.id);await admin.query("UPDATE app.photo_assets SET access_blocked_at=clock_timestamp() WHERE id=$1",[blocked]);
  const before=(await admin.query("SELECT count(*)::int AS n FROM app.orders")).rows[0].n;
  for(const id of [await photo(bob.id),randomUUID(),await photo(alice.id,"pending"),blocked])await fail(await call("create",alice,input(id)),409,"ORDER_PHOTO_NOT_READY");
  assert.equal((await admin.query("SELECT count(*)::int AS n FROM app.orders")).rows[0].n,before);
});
test("old policies are rejected; brand omission is allowed and is not fabricated as consent",async()=>{
  const b=input(await photo(alice.id));b.items[0].photoProductionConsent!.policyVersion="OLD_VERSION";
  await fail(await call("create",alice,b),409,"ORDER_POLICY_MISMATCH");
  b.items[0].photoProductionConsent!.policyVersion=DEMO_ORDER_POLICIES.photoProductionConsent.version;delete b.items[0].photoBrandUseConsent;
  const r=await call("create",alice,b);assert.equal(r.status,201);assert.equal((await r.json()).order.items[0].consents.photoBrandUseConsent,undefined);
});
test("same-key concurrent requests create exactly one order, shuffled input replays, changed payload conflicts",async()=>{
  const key=randomUUID(),body=input();const results=await Promise.all(Array.from({length:8},()=>call("create",alice,body,key)));
  assert.equal(results.filter(r=>r.status===201).length,1);assert.equal(results.filter(r=>r.status===200).length,7);
  const orders=await Promise.all(results.map(r=>r.json()));assert.equal(new Set(orders.map(d=>d.order.orderId)).size,1);
  const reverse=input();(reverse.items[0].beadLayout as {beads:unknown[]}).beads.reverse();assert.equal((await call("create",alice,reverse,key)).status,200);
  await fail(await call("create",alice,{items:[{...body.items[0],lengthCm:20}]},key),409,"ORDER_IDEMPOTENCY_CONFLICT");
  assert.equal((await call("create",bob,body,key)).status,201);
  const swapped=createOrderRepository(app,async()=>[]);const existing=await swapped.create(alice.id,parseOrderInput(body),key);
  assert.equal(existing.created,false);assert.equal(existing.order.orderId,orders[0].order.orderId);
});
test("list pagination has no gaps/duplicates at equal timestamps and never crosses owners",async()=>{
  for(let i=0;i<5;i++)assert.equal((await call("create",member)).status,201);
  await admin.query("BEGIN");
  await admin.query("UPDATE app.order_checkouts SET created_at='2026-11-03T01:02:03.123Z' WHERE owner_id=$1",[member.id]);
  await admin.query("UPDATE app.orders SET created_at='2026-11-03T01:02:03.123Z',preview_confirmed_at='2026-11-03T01:02:03.123Z' WHERE owner_id=$1",[member.id]);await admin.query("COMMIT");
  const seen:string[]=[];let cursor:string|null=null;
  do{const r=await call("list",member,undefined,undefined,undefined,`?limit=2${cursor?`&cursor=${cursor}`:""}`);assert.equal(r.status,200);const d=await r.json();
    assert.ok(d.items.length<=2);seen.push(...d.items.map((o:{orderId:string})=>o.orderId));cursor=d.nextCursor;
  }while(cursor);
  assert.equal(seen.length,5);assert.equal(new Set(seen).size,5);
  for(const query of ["?limit=0","?limit=51","?limit=1&limit=2","?ownerId=other","?cursor=garbage"])assert.throws(()=>parseOrderPage(new URL(base+query)),OrderError);
});
test("RLS, no-context access, runtime mutation/DDL and auth role access are denied",async()=>{
  const {rows}=await app.query("SELECT count(*)::int AS n FROM app.orders");assert.equal(rows[0].n,0);
  assert.equal((await app.query("SELECT current_setting('app.user_id',true) AS value")).rows[0].value??"","");
  const all=await withUserTransaction(app,alice.id,async db=>(await db.query("SELECT owner_id FROM app.orders")).rows);
  assert.ok(all.length);assert.ok(all.every(r=>r.owner_id===alice.id));
  await assert.rejects(withUserTransaction(app,alice.id,async db=>{
    const group=await insertGroup(db,alice.id);
    await insertLine(db,bob.id,randomUUID(),{checkout:group});
  }),(e:unknown)=>(e as {code:string}).code==="42501");
  for(const sql of ["UPDATE app.orders SET quantity=1","DELETE FROM app.order_beads","TRUNCATE app.orders CASCADE","CREATE TABLE app.illegal_order_test(id int)"])
    await assert.rejects(app.query(sql),(e:unknown)=>(e as {code:string}).code==="42501");
  await assert.rejects(authPool.query("SELECT * FROM app.orders"),(e:unknown)=>(e as {code:string}).code==="42501");
  const tables=(await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('app.orders'::regclass,'app.order_beads'::regclass,'app.order_consents'::regclass,'app.order_checkouts'::regclass)")).rows;
  assert.equal(tables.length,4);assert.ok(tables.every((r:{relrowsecurity:boolean;relforcerowsecurity:boolean})=>r.relrowsecurity&&r.relforcerowsecurity));
});
test("deferred constraint rejects partial order; rollback leaves neither order nor slots",async()=>{
  const id=randomUUID();
  await assert.rejects(withUserTransaction(app,alice.id,async db=>{
    await insertLine(db,alice.id,id);
    for(let index=0;index<6;index++)await db.query("INSERT INTO app.order_beads(order_id,owner_id,slot_index,photo_asset_id,shape) VALUES($1,$2,$3,NULL,'square')",[id,alice.id,index]);
  }),(e:unknown)=>(e as {code:string}).code==="23514");
  assert.equal((await admin.query("SELECT count(*)::int AS n FROM app.orders WHERE id=$1",[id])).rows[0].n,0);
  assert.equal((await admin.query("SELECT count(*)::int AS n FROM app.order_beads WHERE order_id=$1",[id])).rows[0].n,0);
});
test("database also rejects seven photo slots without mandatory production consent",async()=>{
  const id=randomUUID(),asset=await photo(alice.id);
  await assert.rejects(withUserTransaction(app,alice.id,async db=>{
    await insertLine(db,alice.id,id);
    for(let index=0;index<7;index++)await db.query("INSERT INTO app.order_beads(order_id,owner_id,slot_index,photo_asset_id,shape) VALUES($1,$2,$3,$4,'square')",[id,alice.id,index,asset]);
  }),(e:unknown)=>(e as {code:string}).code==="23514");
  assert.equal((await admin.query("SELECT count(*)::int AS n FROM app.orders WHERE id=$1",[id])).rows[0].n,0);
});
test("initial DB rejects mixed necklaces and every item must belong to a checkout",async()=>{
 await assert.rejects(withUserTransaction(app,alice.id,db=>insertLine(db,alice.id,randomUUID(),{kind:"necklace",color:"mixed"})),(e:unknown)=>(e as {code:string}).code==="23514");
 await assert.rejects(withUserTransaction(app,alice.id,db=>db.query(`INSERT INTO app.orders(id,owner_id,product_slug,product_kind,product_name,catalog_source,color,length_cm,
  preview_confirmed,preview_confirmed_at,created_at,item_position,quantity) VALUES($1,$2,'synthetic','bracelet','Synthetic','DEMO_CATALOG','violet',18,true,$3,$3,0,1)`,[randomUUID(),alice.id,stamp])),(e:unknown)=>(e as {code:string}).code==="23502");
 const columns=(await admin.query("SELECT column_name FROM information_schema.columns WHERE table_schema='app' AND table_name='orders'")).rows.map((r:{column_name:string})=>r.column_name);
 assert.ok(!columns.includes("idempotency_key"));assert.ok(!columns.includes("request_payload_hash"));
});
test("concurrent photo blocking serializes with the order eligibility check",async()=>{
  const asset=await photo(alice.id),client=await admin.connect();
  try{
    await client.query("BEGIN");await client.query("SELECT id FROM app.photo_assets WHERE id=$1 FOR UPDATE",[asset]);
    const creation=repo.create(alice.id,parseOrderInput(input(asset)),randomUUID());
    // Attach rejection handler immediately; inspect actual lock wait before releasing the blocker.
    const rejected=assert.rejects(creation,e=>e instanceof OrderError && e.code==="ORDER_PHOTO_NOT_READY");
    let waiting=false;
    for(let i=0;i<100;i++){
      const q=await admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename='sunny_app' AND wait_event_type='Lock' AND query LIKE '%FOR SHARE%'");
      if(q.rows[0].n>0){waiting=true;break;}await new Promise(r=>setTimeout(r,10));
    }
    assert.ok(waiting);
    await client.query("UPDATE app.photo_assets SET access_blocked_at=clock_timestamp() WHERE id=$1",[asset]);await client.query("COMMIT");await rejected;
  }finally{await client.query("ROLLBACK");client.release();}
});
test("order boundary preserves refreshed session cookies on success and error",async()=>{
  const headers=new Headers();headers.append("Set-Cookie","sunny.synthetic=refreshed; HttpOnly; SameSite=Lax");
  const deps={baseURL:base,enabled:true,repository:async()=>repo,identity:async()=>({user:{id:alice.id,isAnonymous:true,emailVerified:false},headers})};
  const r=await handleOrder(new Request(base+"/api/orders"),"list",deps);assert.equal(r.status,200);assert.equal(r.headers.getSetCookie().length,1);
  const bad=await handleOrder(new Request(base+"/api/orders?limit=0"),"list",deps);assert.equal(bad.status,400);assert.equal(bad.headers.getSetCookie().length,1);
});
test("missing sessions, unverified identity, Origin, content type, size and disabled/production gates are safe",async()=>{
  await fail(await call("create",null),401,"AUTHENTICATION_REQUIRED");
  await fail(await call("create",alice,input(),randomUUID(),undefined,"",{origin:"https://foreign.invalid"}),403,"ORDER_ORIGIN_REJECTED");
  await fail(await call("list",alice,undefined,undefined,undefined,"",{"sec-fetch-site":"cross-site"}),403,"ORDER_ORIGIN_REJECTED");
  await fail(await call("create",alice,input(),randomUUID(),undefined,"",{"content-type":"text/plain"}),415,"ORDER_CONTENT_TYPE_REJECTED");
  await fail(await call("create",alice,{...input(),padding:"x".repeat(70000)}),413,"ORDER_BODY_TOO_LARGE");
  const req=()=>new Request(base+"/api/orders");
  await fail(await handleOrder(req(),"list",{baseURL:base,enabled:true,repository:async()=>repo,
    identity:async()=>({user:{id:alice.id,isAnonymous:false,emailVerified:false}})}),403,"ORDER_SESSION_NOT_ELIGIBLE");
  await fail(await handleOrder(req(),"list",{baseURL:base,enabled:false,repository:async()=>repo,identity:async()=>null}),503,"ORDER_SERVICE_UNAVAILABLE");
  const outage=await handleOrder(req(),"list",{baseURL:base,enabled:true,
    repository:async()=>{throw new Error("Private synthetic DB details");},identity:async()=>({user:{id:alice.id,isAnonymous:true,emailVerified:false}})});
  assert.equal(JSON.stringify(await outage.clone().json()).includes("Private"),false);
  await fail(outage,503,"ORDER_SERVICE_UNAVAILABLE");
  const env={NODE_ENV:"development",AUTH_ENABLED:"true",ORDER_DEMO_ENABLED:"true",BETTER_AUTH_URL:base};
  assert.equal(orderDemoEnabled(env),true);assert.equal(orderDemoEnabled({...env,NODE_ENV:"production"}),false);
  assert.equal(orderDemoEnabled({...env,BETTER_AUTH_URL:"https://public.invalid"}),false);
});
