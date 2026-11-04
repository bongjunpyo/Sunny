import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAuth } from "../../../frontend/lib/server/auth-handler.ts";
import type { SunnyAuth } from "../../../frontend/lib/server/auth-core.ts";

const baseURL = "http://localhost:4320";
const expired = "sunny.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax";
const renewed = "sunny.session_token=synthetic-renewal; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax";
async function lookup(body: unknown, status: number, path = "get-session") {
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", status === 200 && body ? renewed : expired);
  const auth = { handler: async () => Response.json(body, { status, headers }) } as unknown as SunnyAuth;
  return handleAuth(new Request(`${baseURL}/api/auth/${path}`, path === "sign-out"
    ? { method: "POST", headers: { origin: baseURL, "content-type": "application/json" }, body: "{}" } : {}), auth, { baseURL, emailReady: true });
}

test("null and rejected session lookups cannot send cookie mutations to a newer login", async () => {
  for (const [body, status] of [[null, 200], [{ code: "FAILED_TO_GET_SESSION" }, 401]] as const) {
    const response = await lookup(body, status);
    assert.equal(response.status, status);
    assert.deepEqual(response.headers.getSetCookie(), []);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    if (status === 200) assert.equal(await response.json(), null);
  }
});

test("valid session renewal still forwards HttpOnly cookie headers and only the public DTO", async () => {
  const response = await lookup({ user: { id: "synthetic", name: "KakaoTest", email: "synthetic@example.invalid", isAnonymous: false }, session: { expiresAt: "2099-01-01", token: "private" } }, 200);
  assert.deepEqual(response.headers.getSetCookie(), [renewed]);
  assert.equal(JSON.stringify(await response.json()).includes('"token"'), false);
});

test("explicit logout still clears the browser cookie", async () => {
  const response = await lookup(null, 200, "sign-out");
  assert.deepEqual(response.headers.getSetCookie(), [expired]);
  assert.deepEqual(await response.json(), { success: true });
});
