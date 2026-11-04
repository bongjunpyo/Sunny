import { test } from "node:test";
import assert from "node:assert/strict";
import { submitOrderRequest, getOrderRequests, getOrderRequest, OrderClientError } from "../lib/orders.ts";
import type { OrderInput, OrderDetail } from "../lib/order-types.ts";
const id="00000000-0000-4000-8000-000000000003", key="00000000-0000-4000-8000-000000000004";
const layout={squareCount:7 as const,beads:Array.from({length:7},(_,index)=>({index,photoAssetId:null}))};
const input:OrderInput={items:[{productSlug:"light-study-01",productKind:"bracelet",color:"violet",lengthCm:18,quantity:1,beadLayout:layout,previewConfirmed:true}]};
const order:OrderDetail={orderId:id,status:"REQUESTED",mode:"DEMO",itemCount:1,totalQuantity:1,photoCount:0,createdAt:"2026-11-03T00:00:00.000Z",
 items:[{itemId:"00000000-0000-4000-8000-000000000005",productSlug:"light-study-01",productKind:"bracelet",productName:"Synthetic",color:"violet",lengthCm:18,quantity:1,photoCount:0,
 previewConfirmedAt:"2026-11-03T00:00:00.000Z",beadLayout:layout,consents:{}}]};
test("submission uses a stable caller key, real API and credentials even when catalog is mock",async t=>{
  t.mock.method(globalThis,"fetch",async(url:string,init:RequestInit)=>{
    assert.equal(url,"/api/orders");assert.equal(init.method,"POST");assert.equal(init.credentials,"same-origin");assert.equal(init.cache,"no-store");
    assert.equal((init.headers as Record<string,string>)["Idempotency-Key"],key);assert.deepEqual(JSON.parse(init.body as string),input);
    return Response.json({order,nextPath:`/orders?submitted=${id}`,noticeCode:"DEMO_ORDER_REQUEST_APPROVED"},{status:201});
  });
  assert.equal((await submitOrderRequest(input,key)).nextPath,`/orders?submitted=${id}`);
});
test("errors and a malformed success never become demo approval or unsafe navigation",async t=>{
  t.mock.method(globalThis,"fetch",async()=>Response.json({error:{code:"ORDER_PHOTO_NOT_READY",message:"private SQL"}},{status:409}));
  await assert.rejects(submitOrderRequest(input,key),e=>e instanceof OrderClientError&&e.code==="ORDER_PHOTO_NOT_READY"&&!e.message.includes("SQL"));
  for(const nextPath of ["https://foreign.invalid/", "/orders?submitted=other", "javascript:alert(1)"]){
    t.mock.method(globalThis,"fetch",async()=>Response.json({order,nextPath,noticeCode:"DEMO_ORDER_REQUEST_APPROVED"}));
    await assert.rejects(submitOrderRequest(input,key),OrderClientError);
  }
});
test("list and detail require actual private API DTOs, and absent orders remain errors",async t=>{
  const seen:string[]=[];
  t.mock.method(globalThis,"fetch",async(url:string,init:RequestInit)=>{seen.push(url);assert.equal(init.cache,"no-store");
    return Response.json(url.includes(id)?{order}:{items:[order],nextCursor:null});});
  assert.equal((await getOrderRequests()).items[0].orderId,id);assert.equal((await getOrderRequest(id)).orderId,id);
  assert.deepEqual(seen,["/api/orders",`/api/orders/${id}`]);
  t.mock.method(globalThis,"fetch",async()=>Response.json({error:{code:"ORDER_NOT_FOUND"}},{status:404}));
  await assert.rejects(getOrderRequest(id),OrderClientError);
});

test("mixed bracelet create/list/detail DTOs are accepted, mixed necklace is rejected",async t=>{
 const mixed:OrderDetail={...order,items:[{...order.items[0],color:"mixed"}]};
 t.mock.method(globalThis,"fetch",async(url:string)=>Response.json(url==="/api/orders"?{order:mixed,items:[mixed],nextCursor:null,nextPath:`/orders?submitted=${id}`,noticeCode:"DEMO_ORDER_REQUEST_APPROVED"}:{order:mixed}));
 assert.equal((await submitOrderRequest({...input,items:[{...input.items[0],color:"mixed"}]},key)).order.items[0].color,"mixed");
 assert.equal((await getOrderRequests()).items[0].items[0].color,"mixed");assert.equal((await getOrderRequest(id)).items[0].color,"mixed");
 const invalid={...mixed,items:[{...mixed.items[0],productKind:"necklace"}]};
 t.mock.method(globalThis,"fetch",async()=>Response.json({order:invalid,items:[invalid],nextCursor:null}));
 await assert.rejects(getOrderRequest(id),OrderClientError);await assert.rejects(getOrderRequests(),OrderClientError);
});
