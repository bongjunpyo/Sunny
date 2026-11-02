import "server-only";
import products from "../../mock/products.json" with { type:"json" };
import type { Product } from "../../types.ts";
import { getAuth } from "../auth.ts";
import { createRuntimePool, verifyRuntimePool } from "../postgres.ts";
import { createOrderRepository, type OrderRepository } from "./repository.ts";
import { handleOrder } from "./handler.ts";
import { orderFailure } from "./policy.ts";

export function orderDemoEnabled(env:NodeJS.ProcessEnv){
  try{const url=new URL(env.BETTER_AUTH_URL??"");return env.ORDER_DEMO_ENABLED==="true" && env.AUTH_ENABLED==="true"
    && env.NODE_ENV==="development" && url.protocol==="http:" && ["localhost","127.0.0.1","[::1]"].includes(url.hostname);}
  catch{return false;}
}
let pending:Promise<OrderRepository>|undefined;
async function repository(){
  if(!pending)pending=(async()=>{
    if(!process.env.DATABASE_URL)throw new Error("Order DB unavailable");
    const pool=createRuntimePool(process.env.DATABASE_URL,"sunny_app");pool.on("error",()=>{});
    try{await verifyRuntimePool(pool,"sunny_app");return createOrderRepository(pool,async()=>products as Product[]);}
    catch(error){await pool.end();throw error;}
  })().catch(error=>{pending=undefined;throw error;});
  return pending;
}
export async function orderRoute(request:Request,action:"create"|"list"|"detail",id?:string){
  try{return await handleOrder(request,action,{baseURL:process.env.BETTER_AUTH_URL??"http://localhost:3000",
    enabled:orderDemoEnabled(process.env),repository,
    identity:async headers=>{
      const checked=await(await getAuth()).api.getSession({headers,query:{disableCookieCache:true},returnHeaders:true});
      return checked.response?{user:checked.response.user,headers:checked.headers}:null;
    }},id);
  }catch(error){return orderFailure(error);}
}
