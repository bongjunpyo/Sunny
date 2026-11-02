import { orderRoute } from "@/lib/server/orders/runtime";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{orderId:string}>}){
  return orderRoute(request,"detail",(await context.params).orderId);
}
