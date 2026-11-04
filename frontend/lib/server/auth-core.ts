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

export function createAuth(pool: Pool, config: { baseURL: string; secret: string; mailer?: VerificationMailer; resetMailer?: VerificationMailer; kakao?: KakaoOptions }) {
  const origin = new URL(config.baseURL).origin;
  const base = new URL(origin);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))) {
    throw new Error("Authentication requires HTTPS outside loopback development");
  }
  if (config.secret.length < 32) throw new Error("Authentication secret is too short");
  return betterAuth({
    appName: "Sunny", baseURL: origin, basePath: "/api/auth", secret: config.secret,
    database: pool, trustedOrigins: [origin], logger: { disabled: true },
    emailAndPassword: { enabled: true, requireEmailVerification: false, autoSignIn: false,
      minPasswordLength: PASSWORD_MIN, maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 3600, revokeSessionsOnPasswordReset: true,
      ...(config.resetMailer ? { sendResetPassword: async ({ user, token }: { user: { id: string; email: string }; token: string }) => {
        const credential = await pool.query('SELECT 1 FROM auth.account WHERE "userId"=$1 AND "providerId"=\'credential\' AND password IS NOT NULL', [user.id]);
        if (!credential.rowCount) return;
        const target = new URL("/reset-password", origin);
        target.hash = new URLSearchParams({ token }).toString();
        try { await config.resetMailer!({ email: user.email, url: target.href }); }
        catch {
          const state = deliveryState.getStore();
          if (state) state.failed = true;
          // Never forward the provider exception, recipient or verification URL.
          throw new APIError("SERVICE_UNAVAILABLE", { code: "AUTH_EMAIL_UNAVAILABLE", message: "Password reset delivery failed" });
        }
      } } : {}) },
    emailVerification: { sendOnSignUp: false, sendOnSignIn: false, autoSignInAfterVerification: false },
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
        "/request-password-reset": { window: 60, max: 3 },
        "/reset-password": { window: 60, max: 5 } } },
    plugins: [anonymous({ disableDeleteAnonymousUser: true })],
  });
}
export type SunnyAuth = ReturnType<typeof createAuth>;
