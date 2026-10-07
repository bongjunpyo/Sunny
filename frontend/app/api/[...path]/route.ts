import { proxyFastApi } from "@/lib/server/fastapi-proxy";

// Next.js는 동일 출처 전달만 맡고, 업무 API는 FastAPI에서 구현한다.
export const runtime = "nodejs";

export const GET = proxyFastApi;
export const POST = proxyFastApi;
export const PUT = proxyFastApi;
export const PATCH = proxyFastApi;
export const DELETE = proxyFastApi;
export const HEAD = proxyFastApi;
export const OPTIONS = proxyFastApi;
