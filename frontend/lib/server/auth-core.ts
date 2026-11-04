import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { anonymous } from "better-auth/plugins";
import type { Pool } from "pg";
import type { KakaoOptions } from "better-auth/social-providers";
import { PASSWORD_MIN } from "../validate.ts";

export type VerificationMailer = (message: { email: string; url: string }) => Promise<void>;
const deliveryState = new AsyncLocalStorage<{ failed: boolean }>();

/** Better Auth 1.7.10 swallows some mail errors; retain only a request-local flag. */
export async function withVerificationDelivery<T>(operation: () => Promise<T>) {
  const state = { failed: false };
  const response = await deliveryState.run(state, operation);
  return { response, deliveryFailed: state.failed };
}

export function createAuth(pool: Pool, config: { baseURL: string; secret: string; mailer: VerificationMailer; kakao?: KakaoOptions }) {
  const origin = new URL(config.baseURL).origin;
  const base = new URL(origin);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))) {
    throw new Error("Authentication requires HTTPS outside loopback development");
  }
  if (config.secret.length < 32) throw new Error("Authentication secret is too short");
  return betterAuth({
    appName: "Sunny", baseURL: origin, basePath: "/api/auth", secret: config.secret,
    database: pool, trustedOrigins: [origin], logger: { disabled: true },
    emailAndPassword: { enabled: true, requireEmailVerification: true, autoSignIn: false,
      minPasswordLength: PASSWORD_MIN, maxPasswordLength: 128 },
    emailVerification: { sendOnSignUp: true, sendOnSignIn: false, expiresIn: 86400,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => {
        const target = new URL(url); target.searchParams.set("callbackURL", "/login");
        try { await config.mailer({ email: user.email, url: target.href }); }
        catch {
          const state = deliveryState.getStore();
          if (state) state.failed = true;
          // Never forward the provider exception, recipient or verification URL.
          throw new APIError("SERVICE_UNAVAILABLE", { code: "AUTH_EMAIL_UNAVAILABLE", message: "Verification email delivery failed" });
        }
      } },
    socialProviders: config.kakao ? { kakao: config.kakao } : {},
    onAPIError: { errorURL: `${origin}/login` },
    account: { accountLinking: { enabled: false }, encryptOAuthTokens: true, storeStateStrategy: "database" },
    session: { expiresIn: 604800, updateAge: 86400, cookieCache: { enabled: false } },
    advanced: { database: { generateId: "uuid" }, cookiePrefix: "sunny",
      useSecureCookies: origin.startsWith("https://"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" } },
    rateLimit: { enabled: true, window: 60, max: 30, storage: "memory",
      customRules: { "/sign-in/email": { window: 60, max: 10 },
        "/sign-in/anonymous": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
        "/sign-in/social": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 3 } } },
    plugins: [anonymous({ disableDeleteAnonymousUser: true })],
  });
}
export type SunnyAuth = ReturnType<typeof createAuth>;
