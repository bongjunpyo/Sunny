import { uploadRoute } from "@/lib/server/uploads/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request, context: { params: Promise<{ assetId: string }> }) {
  return uploadRoute(request, "complete", (await context.params).assetId);
}
