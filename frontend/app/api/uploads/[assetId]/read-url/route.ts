import { uploadRoute } from "@/lib/server/uploads/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ assetId: string }> }) {
  return uploadRoute(request, "read-url", (await context.params).assetId);
}
