import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Product } from "../../types.ts";
import type { OrderInput, OrderDetail, OrderSummary } from "../../order-types.ts";
import { DEMO_ORDER_POLICIES } from "../../order-policy.ts";
import { withUserTransaction } from "../postgres.ts";
import { OrderError, payloadHash, validateOrderPolicies, type OrderPage } from "./policy.ts";

type OrderRow = { id: string; product_slug: string; product_kind: OrderInput["productKind"]; product_name: string;
  color: OrderInput["color"]; length_cm: number; created_at: Date; preview_confirmed_at: Date; photo_count: number };
const selection = `SELECT o.*, (SELECT count(*)::int FROM app.order_beads b
  WHERE b.order_id=o.id AND b.photo_asset_id IS NOT NULL) AS photo_count FROM app.orders o`;
function summary(row: OrderRow): OrderSummary {
  return { orderId:row.id,status:"REQUESTED",mode:"DEMO",productSlug:row.product_slug,productKind:row.product_kind,
    productName:row.product_name,color:row.color,lengthCm:row.length_cm,photoCount:row.photo_count,createdAt:row.created_at.toISOString() };
}
async function detail(db: PoolClient, owner: string, id: string): Promise<OrderDetail> {
  const {rows:[row]} = await db.query<OrderRow>(`${selection} WHERE o.id=$1 AND o.owner_id=$2`,[id,owner]);
  if (!row) throw new OrderError("ORDER_NOT_FOUND");
  const {rows:beads} = await db.query<{slot_index:number;photo_asset_id:string|null}>(
    "SELECT slot_index,photo_asset_id FROM app.order_beads WHERE order_id=$1 AND owner_id=$2 ORDER BY slot_index",[id,owner]);
  const {rows:receipts} = await db.query<{consent_type:keyof OrderDetail["consents"];accepted:boolean;policy_version:string;accepted_at:Date|null;recorded_at:Date}>(
    "SELECT consent_type,accepted,policy_version,accepted_at,recorded_at FROM app.order_consents WHERE order_id=$1 AND owner_id=$2 ORDER BY consent_type",[id,owner]);
  return {...summary(row),previewConfirmedAt:row.preview_confirmed_at.toISOString(),
    beadLayout:{squareCount:7,beads:beads.map(b=>({index:b.slot_index,photoAssetId:b.photo_asset_id}))},
    consents:Object.fromEntries(receipts.map(c=>[c.consent_type,{accepted:c.accepted,policyVersion:c.policy_version,
      acceptedAt:c.accepted_at?.toISOString()??null,recordedAt:c.recorded_at.toISOString()}]))};
}
export function createOrderRepository(pool: Pool, catalog: () => Promise<readonly Product[]>) {
  return {
    async create(owner: string, input: OrderInput, key: string) {
      return withUserTransaction(pool,owner,async db=>{
        await db.query("SET LOCAL lock_timeout='5s'");
        await db.query("SET LOCAL statement_timeout='10s'");
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,100))",[`${owner}:${key}`]);
        const hash=payloadHash(input);
        const {rows:[prior]}=await db.query<{id:string;request_payload_hash:string}>(
          "SELECT id,request_payload_hash FROM app.orders WHERE owner_id=$1 AND idempotency_key=$2",[owner,key]);
        if (prior) {
          if(prior.request_payload_hash!==hash) throw new OrderError("ORDER_IDEMPOTENCY_CONFLICT");
          return {order:await detail(db,owner,prior.id),created:false};
        }
        validateOrderPolicies(input);
        const product=(await catalog()).find(p=>p.slug===input.productSlug);
        if(!product || product.kind!==input.productKind || !product.colors.includes(input.color)) throw new OrderError("INVALID_ORDER_REQUEST");
        const photos=[...new Set(input.beadLayout.beads.flatMap(b=>b.photoAssetId?[b.photoAssetId]:[]))].sort();
        if(photos.length){
          const result=await db.query(`SELECT id FROM app.photo_assets WHERE id=ANY($1::uuid[]) AND owner_id=$2
            AND status='verified' AND access_blocked_at IS NULL ORDER BY id FOR SHARE`,[photos,owner]);
          if(result.rowCount!==photos.length) throw new OrderError("ORDER_PHOTO_NOT_READY");
        }
        const {rows:[clock]}=await db.query<{now:Date}>("SELECT clock_timestamp()::timestamptz(3) AS now");
        const id=randomUUID(), now=clock.now;
        await db.query(`INSERT INTO app.orders(id,owner_id,product_slug,product_kind,product_name,catalog_source,
          color,length_cm,preview_confirmed,preview_confirmed_at,idempotency_key,request_payload_hash,created_at)
          VALUES($1,$2,$3,$4,$5,'DEMO_CATALOG',$6,$7,true,$8,$9,$10,$8)`,
          [id,owner,input.productSlug,input.productKind,product.name,input.color,input.lengthCm,now,key,hash]);
        for(const b of input.beadLayout.beads) await db.query(
          "INSERT INTO app.order_beads(order_id,owner_id,slot_index,photo_asset_id) VALUES($1,$2,$3,$4)",[id,owner,b.index,b.photoAssetId]);
        for(const type of Object.keys(DEMO_ORDER_POLICIES) as (keyof typeof DEMO_ORDER_POLICIES)[]){
          const c=input[type];if(!c)continue;
          const policy=DEMO_ORDER_POLICIES[type];
          await db.query(`INSERT INTO app.order_consents(order_id,owner_id,consent_type,accepted,policy_version,policy_text,
            policy_sha256,accepted_at,recorded_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [id,owner,type,c.accepted,c.policyVersion,policy.text,createHash("sha256").update(policy.text).digest("hex"),c.accepted?now:null,now]);
        }
        return {order:await detail(db,owner,id),created:true};
      });
    },
    get(owner: string,id: string) { return withUserTransaction(pool,owner,db=>detail(db,owner,id)); },
    list(owner: string,page: OrderPage) {
      return withUserTransaction(pool,owner,async db=>{
        const {rows}=await db.query<OrderRow>(`${selection} WHERE o.owner_id=$1
          AND ($2::timestamptz IS NULL OR (o.created_at,o.id)<($2::timestamptz,$3::uuid))
          ORDER BY o.created_at DESC,o.id DESC LIMIT $4`,[owner,page.cursor?.createdAt??null,page.cursor?.orderId??null,page.limit+1]);
        const items=rows.slice(0,page.limit).map(summary),last=items.at(-1);
        return {items,nextCursor:rows.length>page.limit && last ? Buffer.from(JSON.stringify({createdAt:last.createdAt,orderId:last.orderId})).toString("base64url"):null};
      });
    },
  };
}
export type OrderRepository = ReturnType<typeof createOrderRepository>;
