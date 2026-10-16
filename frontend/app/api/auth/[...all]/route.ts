import "server-only";
import { kakaoOptions } from "@/lib/server/auth-kakao";
import { getAuth } from "@/lib/server/auth";
import { handleAuth, authError } from "@/lib/server/auth-handler";
import { verificationEmailConfigured } from "@/lib/server/auth-email";
import { localVerificationMailEnabled } from "@/lib/server/auth-local-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function dispatch(request: Request) {
  try {
    return await handleAuth(request, await getAuth(), {
      baseURL: process.env.BETTER_AUTH_URL!, emailReady: verificationEmailConfigured(),
      localMail: localVerificationMailEnabled(), kakaoReady: Boolean(kakaoOptions()),
    });
  } catch {
    return authError(503, "AUTH_SERVICE_UNAVAILABLE", "인증 서버를 준비하고 있습니다. 잠시 후 다시 시도해 주세요.");
  }
}
export const GET = dispatch;
export const POST = dispatch;
