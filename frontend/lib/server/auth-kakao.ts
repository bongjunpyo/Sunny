import "server-only";
import type { KakaoOptions } from "better-auth/social-providers";
import { validateNickname } from "../validate.ts";

export function kakaoOptions(env: NodeJS.ProcessEnv = process.env): KakaoOptions | undefined {
  if (env.KAKAO_ENABLED !== "true" || !env.KAKAO_CLIENT_ID?.trim() || !env.KAKAO_CLIENT_SECRET?.trim()) return undefined;
  return {
    clientId: env.KAKAO_CLIENT_ID.trim(), clientSecret: env.KAKAO_CLIENT_SECRET.trim(),
    disableDefaultScope: true, scope: ["account_email", "profile_nickname"], requireEmailVerification: true,
    mapProfileToUser(profile) {
      const name = profile.kakao_account?.profile?.nickname?.trim() ?? "";
      return { name: validateNickname(name) ? "Sunny회원" : name, image: undefined };
    },
  };
}
