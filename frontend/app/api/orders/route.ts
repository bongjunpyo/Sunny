import { orderRoute } from "@/lib/server/orders/runtime";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function GET(request:Request){return orderRoute(request,"list");}
export function POST(request:Request){return orderRoute(request,"create");}
