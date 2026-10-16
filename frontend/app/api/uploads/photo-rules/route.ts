import { uploadRoute } from "@/lib/server/uploads/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return uploadRoute(request, "rules"); }
