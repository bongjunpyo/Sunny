import "server-only";
import { OrderError, orderFailure, orderJSON, parseOrderInput, parseOrderPage, uuid } from "./policy.ts";
import type { OrderRepository } from "./repository.ts";

type Identity = { user:{id:string;isAnonymous?:boolean|null;emailVerified:boolean}; headers?:Headers };
export type OrderDependencies = { baseURL:string;enabled:boolean;identity:(headers:Headers)=>Promise<Identity|null>;
  repository:()=>Promise<OrderRepository> };
async function body(request: Request) {
  const reader=request.body?.getReader();if(!reader)throw new OrderError("INVALID_ORDER_REQUEST");
  const chunks:Uint8Array[]=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>65536)throw new OrderError("ORDER_BODY_TOO_LARGE");chunks.push(value);}
  } finally { await reader.cancel().catch(()=>{});reader.releaseLock(); }
  try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(chunks)));}
  catch {throw new OrderError("INVALID_ORDER_REQUEST");}
}
export async function handleOrder(request: Request, action:"create"|"list"|"detail", deps:OrderDependencies, id?:string) {
  let cookies:string[]=[];let response:Response;
  try{
    const origin=new URL(deps.baseURL).origin, given=request.headers.get("origin"), url=new URL(request.url);
    if((request.method==="POST" && given!==origin) || (given!==null && given!==origin)
      || request.headers.get("sec-fetch-site")==="cross-site")throw new OrderError("ORDER_ORIGIN_REJECTED");
    if(!deps.enabled)throw new OrderError("ORDER_SERVICE_UNAVAILABLE");
    const checked=await deps.identity(request.headers);cookies=checked?.headers?.getSetCookie()??[];
    const user=checked?.user;
    if(!user || !uuid.test(user.id))throw new OrderError("AUTHENTICATION_REQUIRED");
    if(user.isAnonymous!==true && user.emailVerified!==true)throw new OrderError("ORDER_SESSION_NOT_ELIGIBLE");
    if(action==="create"){
      if(url.search)throw new OrderError("INVALID_ORDER_REQUEST");
      if(request.headers.get("content-type")?.split(";",1)[0].trim().toLowerCase()!=="application/json")throw new OrderError("ORDER_CONTENT_TYPE_REJECTED");
      const key=request.headers.get("idempotency-key");if(!key || !uuid.test(key))throw new OrderError("INVALID_ORDER_REQUEST");
      const input=parseOrderInput(await body(request));
      const result=await (await deps.repository()).create(user.id,input,key.toLowerCase());
      response=orderJSON({order:result.order,nextPath:`/orders?submitted=${result.order.orderId}`,noticeCode:"DEMO_ORDER_REQUEST_APPROVED"},result.created?201:200);
    }else if(action==="detail"){
      if(!id || !uuid.test(id) || url.search)throw new OrderError("INVALID_ORDER_REQUEST");
      response=orderJSON({order:await (await deps.repository()).get(user.id,id.toLowerCase())});
    }else{
      const page=parseOrderPage(url);response=orderJSON(await (await deps.repository()).list(user.id,page));
    }
  }catch(error){response=orderFailure(error);}
  for(const cookie of cookies)response.headers.append("Set-Cookie",cookie);
  return response;
}
