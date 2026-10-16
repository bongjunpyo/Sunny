import "server-only";
import { createAuth, type SunnyAuth } from "./auth-core.ts";
import { createRuntimePool, verifyRuntimePool } from "./postgres.ts";
import { sendVerificationEmail } from "./auth-email.ts";

let pending: Promise<SunnyAuth> | undefined;
export async function getAuth(): Promise<SunnyAuth> {
  if (process.env.AUTH_ENABLED !== "true") throw new Error("Authentication is disabled");
  if (!pending) {
    pending = (async () => {
      const { AUTH_DATABASE_URL, BETTER_AUTH_URL, BETTER_AUTH_SECRET } = process.env;
      if (!AUTH_DATABASE_URL || !BETTER_AUTH_URL || !BETTER_AUTH_SECRET) throw new Error("Authentication configuration missing");
      if (process.env.NODE_ENV === "production" && new URL(BETTER_AUTH_URL).protocol !== "https:") {
        throw new Error("Production authentication requires HTTPS");
      }
      const pool = createRuntimePool(AUTH_DATABASE_URL, "sunny_auth");
      pool.on("error", () => { /* Do not log connection credentials or SQL parameters. */ });
      try {
        await verifyRuntimePool(pool, "sunny_auth");
        return createAuth(pool, { baseURL: BETTER_AUTH_URL, secret: BETTER_AUTH_SECRET, mailer: sendVerificationEmail });
      } catch (error) { await pool.end(); throw error; }
    })().catch((error: unknown) => { pending = undefined; throw error; });
  }
  return pending;
}
