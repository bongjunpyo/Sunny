import "server-only";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {PHOTOCHROMIC_COLORS,type Product} from "../../types.ts";
import type {OrderInput,OrderItemInput,OrderItemSummary,OrderItemDetail,OrderDetail,OrderSummary} from "../../order-types.ts";
import {DEMO_ORDER_POLICIES} from "../../order-policy.ts";
import {withUserTransaction} from "../postgres.ts";
import {OrderError,payloadHash,validateOrderPolicies,type OrderPage} from "./policy.ts";

type Root={id:string;created_at:Date};
type ItemRow={id:string;product_slug:string;product_kind:OrderItemInput["productKind"];product_name:string;
 color:OrderItemInput["color"];length_cm:number;quantity:number;created_at:Date;preview_confirmed_at:Date;photo_count:number};
const roots=`SELECT id,created_at FROM app.order_checkouts WHERE owner_id=$1`;
function itemSummary(row:ItemRow):OrderItemSummary{return {itemId:row.id,productSlug:row.product_slug,productKind:row.product_kind,
 productName:row.product_name,color:row.color,lengthCm:row.length_cm,quantity:row.quantity,photoCount:row.photo_count};}
async function load(db:PoolClient,owner:string,id:string,full:true,known?:Root):Promise<OrderDetail>;
async function load(db:PoolClient,owner:string,id:string,full:false,known?:Root):Promise<OrderSummary>;
async function load(db:PoolClient,owner:string,id:string,full:boolean,known?:Root):Promise<OrderSummary|OrderDetail>{
 const root=known??(await db.query<Root>(`SELECT * FROM (${roots}) r WHERE id=$2`,[owner,id])).rows[0];
 if(!root)throw new OrderError("ORDER_NOT_FOUND");
 const {rows}=await db.query<ItemRow>(`SELECT o.*,(SELECT count(*)::int FROM app.order_beads b WHERE b.order_id=o.id AND b.photo_asset_id IS NOT NULL) AS photo_count
 FROM app.orders o WHERE owner_id=$1 AND checkout_id=$2
 ORDER BY item_position`,[owner,id]);
 const items=rows.map(itemSummary);
 const header={orderId:id,status:"REQUESTED" as const,mode:"DEMO" as const,createdAt:root.created_at.toISOString(),
 itemCount:items.length,totalQuantity:items.reduce((n,i)=>n+i.quantity,0),photoCount:items.reduce((n,i)=>n+i.photoCount,0)};
 if(!full)return {...header,items};
 const ids=rows.map(r=>r.id);
 const beads=(await db.query<{order_id:string;slot_index:number;photo_asset_id:string|null;shape:"square"|"moon"|"round"}>(
 "SELECT order_id,slot_index,photo_asset_id,shape FROM app.order_beads WHERE owner_id=$1 AND order_id=ANY($2::uuid[]) ORDER BY order_id,slot_index",[owner,ids])).rows;
 const receipts=(await db.query<{order_id:string;consent_type:keyof OrderItemDetail["consents"];accepted:boolean;policy_version:string;accepted_at:Date|null;recorded_at:Date}>(
 "SELECT order_id,consent_type,accepted,policy_version,accepted_at,recorded_at FROM app.order_consents WHERE owner_id=$1 AND order_id=ANY($2::uuid[]) ORDER BY order_id,consent_type",[owner,ids])).rows;
 return {...header,items:rows.map(row=>{
   const slots=beads.filter(b=>b.order_id===row.id);
   const beadLayout:OrderItemDetail["beadLayout"]=row.product_kind==="bracelet"
    ?{squareCount:7,beads:slots.map(b=>({index:b.slot_index,photoAssetId:b.photo_asset_id}))}
    :{moonCount:1,roundCount:2,beads:slots.map(b=>({index:b.slot_index,shape:b.shape as "round"|"moon",photoAssetId:null}))};
   return {...itemSummary(row),previewConfirmedAt:row.preview_confirmed_at.toISOString(),beadLayout,
    consents:Object.fromEntries(receipts.filter(c=>c.order_id===row.id).map(c=>[c.consent_type,{accepted:c.accepted,policyVersion:c.policy_version,
     acceptedAt:c.accepted_at?.toISOString()??null,recordedAt:c.recorded_at.toISOString()}]))};
 })};
}
export function createOrderRepository(pool:Pool,catalog:()=>Promise<readonly Product[]>){return {
 async create(owner:string,input:OrderInput,key:string){return withUserTransaction(pool,owner,async db=>{
   await db.query("SET LOCAL lock_timeout='5s'");await db.query("SET LOCAL statement_timeout='10s'");
   await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,100))",[`${owner}:${key}`]);
   const hash=payloadHash(input);
   const prior=(await db.query<{id:string;request_payload_hash:string}>(`SELECT id,request_payload_hash FROM app.order_checkouts WHERE owner_id=$1 AND idempotency_key=$2
`,[owner,key])).rows[0];
   if(prior){if(prior.request_payload_hash!==hash)throw new OrderError("ORDER_IDEMPOTENCY_CONFLICT");return {order:await load(db,owner,prior.id,true),created:false};}
   validateOrderPolicies(input);
   const products=await catalog();
   for(const item of input.items){const product=products.find(p=>p.slug===item.productSlug);
    if(!product||product.kind!==item.productKind||!(item.color==="mixed"?item.productKind==="bracelet"&&PHOTOCHROMIC_COLORS.every(c=>product.colors.includes(c)):product.colors.includes(item.color)))throw new OrderError("INVALID_ORDER_REQUEST");}
   const photos=[...new Set(input.items.flatMap(i=>"beads" in i.beadLayout?i.beadLayout.beads.flatMap(b=>b.photoAssetId?[b.photoAssetId]:[]):[]))].sort();
   if(photos.length){const result=await db.query(`SELECT id FROM app.photo_assets WHERE id=ANY($1::uuid[]) AND owner_id=$2 AND purpose='custom_order_photo'
    AND status='verified' AND access_blocked_at IS NULL ORDER BY id FOR SHARE`,[photos,owner]);if(result.rowCount!==photos.length)throw new OrderError("ORDER_PHOTO_NOT_READY");}
   const now=(await db.query<{now:Date}>("SELECT clock_timestamp()::timestamptz(3) AS now")).rows[0].now,id=randomUUID();
   await db.query("INSERT INTO app.order_checkouts(id,owner_id,idempotency_key,request_payload_hash,created_at) VALUES($1,$2,$3,$4,$5)",[id,owner,key,hash,now]);
   for(const [position,item] of input.items.entries()){
    const itemId=randomUUID(),product=products.find(p=>p.slug===item.productSlug)!;
    await db.query(`INSERT INTO app.orders(id,owner_id,product_slug,product_kind,product_name,catalog_source,color,length_cm,
     preview_confirmed,preview_confirmed_at,created_at,checkout_id,item_position,quantity)
     VALUES($1,$2,$3,$4,$5,'DEMO_CATALOG',$6,$7,true,$8,$8,$9,$10,$11)`,
     [itemId,owner,item.productSlug,item.productKind,product.name,item.color,item.lengthCm,now,id,position,item.quantity]);
    if("beads" in item.beadLayout){for(const b of item.beadLayout.beads)await db.query(
     "INSERT INTO app.order_beads(order_id,owner_id,slot_index,photo_asset_id,shape) VALUES($1,$2,$3,$4,'square')",[itemId,owner,b.index,b.photoAssetId]);}
    else{for(let index=0;index<3;index++)await db.query(
     "INSERT INTO app.order_beads(order_id,owner_id,slot_index,photo_asset_id,shape) VALUES($1,$2,$3,NULL,$4)",[itemId,owner,index,index===1?"moon":"round"]);}
    for(const type of Object.keys(DEMO_ORDER_POLICIES) as (keyof typeof DEMO_ORDER_POLICIES)[]){const c=item[type];if(!c)continue;const policy=DEMO_ORDER_POLICIES[type];
     await db.query(`INSERT INTO app.order_consents(order_id,owner_id,consent_type,accepted,policy_version,policy_text,policy_sha256,accepted_at,recorded_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[itemId,owner,type,c.accepted,c.policyVersion,policy.text,createHash("sha256").update(policy.text).digest("hex"),c.accepted?now:null,now]);}
   }
   return {order:await load(db,owner,id,true),created:true};
 });},
 get(owner:string,id:string){return withUserTransaction(pool,owner,db=>load(db,owner,id,true));},
 list(owner:string,page:OrderPage){return withUserTransaction(pool,owner,async db=>{
  const {rows}=await db.query<Root>(`SELECT * FROM (${roots}) r WHERE ($2::timestamptz IS NULL OR (created_at,id)<($2::timestamptz,$3::uuid))
   ORDER BY created_at DESC,id DESC LIMIT $4`,[owner,page.cursor?.createdAt??null,page.cursor?.orderId??null,page.limit+1]);
  const items:OrderSummary[]=[];for(const row of rows.slice(0,page.limit))items.push(await load(db,owner,row.id,false,row));
  const last=items.at(-1);return {items,nextCursor:rows.length>page.limit&&last?Buffer.from(JSON.stringify({createdAt:last.createdAt,orderId:last.orderId})).toString("base64url"):null};
 });}
};}
export type OrderRepository=ReturnType<typeof createOrderRepository>;
