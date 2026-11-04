import { test } from "node:test";
import assert from "node:assert/strict";
import { getMember, signIn, signInWithKakao, signUp, signOut, requestPasswordReset, resetPassword, AuthError } from "../lib/auth.ts";

test("password reset sends the token only in the POST body and rejects a malformed success", async t => {
  let valid = false;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "/api/auth/reset-password"); assert.equal(init.method, "POST"); assert.equal(init.cache, "no-store");
    assert.deepEqual(JSON.parse(String(init.body)), { token: "synthetic-reset-token", newPassword: "Synthetic-New-114!" });
    return Response.json(valid ? { success: true } : {});
  });
  await assert.rejects(resetPassword("synthetic-reset-token", "Synthetic-New-114!"), { code: "INVALID_AUTH_RESPONSE" });
  valid = true; await resetPassword("synthetic-reset-token", "Synthetic-New-114!");
});

test("failed reset request cannot display a delivery success or provider detail", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: { code: "AUTH_EMAIL_UNAVAILABLE", message: "private provider detail" } }, { status: 503 }));
  await assert.rejects(requestPasswordReset("synthetic@example.invalid"), error => error instanceof AuthError
    && error.code === "AUTH_EMAIL_UNAVAILABLE" && !error.message.includes("private provider detail"));
});

test("signup posts password to real auth API even with product mock mode and returns registered without signup mail", async t => {
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "/api/auth/sign-up/email");
    assert.equal(init.method, "POST"); assert.equal(init.credentials, "same-origin"); assert.equal(init.cache, "no-store");
    assert.deepEqual(JSON.parse(init.body as string), { email: "synthetic@example.invalid", name: "TestMember", password: "Synthetic123!" });
    return Response.json({ registered: true });
  });
  assert.deepEqual(await signUp(" synthetic@example.invalid ", " TestMember ", "Synthetic123!"), { registered: true });
});

test("session lookup uses the server; guests and missing sessions are not members", async t => {
  let data: unknown = null;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "/api/auth/get-session"); assert.equal(init.method, "GET"); assert.equal(init.cache, "no-store");
    return Response.json(data);
  });
  assert.equal(await getMember(), null);
  data = { user: { isAnonymous: true, nickname: "Anonymous" } };
  assert.equal(await getMember(), null);
  data = { user: { isAnonymous: false, email: "synthetic@example.invalid", nickname: "TestMember" }, session: { expiresAt: "2099-01-01" } };
  assert.deepEqual(await getMember(), { email: "synthetic@example.invalid", nickname: "TestMember" });
});

test("login includes password; logout and reset requests call the matching server endpoint", async t => {
  const seen: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    seen.push(url); const body = JSON.parse(init.body as string);
    if (url.endsWith("sign-in/email")) {
      assert.deepEqual(body, { email: "synthetic@example.invalid", password: "Synthetic123!" });
      return Response.json({ user: { isAnonymous: false, email: body.email, nickname: "TestMember" } });
    }
    assert.deepEqual(body, url.endsWith("sign-out") ? {} : { email: "synthetic@example.invalid" });
    return Response.json(url.endsWith("request-password-reset") ? { message: "비밀번호 재설정이 가능한 계정이면 안내 메일을 보냈습니다." } : { success: true });
  });
  await signIn(" synthetic@example.invalid ", "Synthetic123!");
  await signOut(); await requestPasswordReset("synthetic@example.invalid");
  assert.deepEqual(seen, ["/api/auth/sign-in/email", "/api/auth/sign-out", "/api/auth/request-password-reset"]);
});

test("mail/service failures and unverified login cannot turn into client success", async t => {
  let code = "AUTH_EMAIL_UNAVAILABLE"; let status = 503;
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: { code, message: "private upstream detail" } }, { status }));
  await assert.rejects(signUp("synthetic@example.invalid", "TestMember", "Synthetic123!"), (error: unknown) => error instanceof AuthError && error.code === code && !error.message.includes("private"));
  code = "EMAIL_NOT_VERIFIED"; status = 403;
  await assert.rejects(signIn("synthetic@example.invalid", "Synthetic123!"), (error: unknown) => error instanceof AuthError && error.code === code);
  status = 429;
  await assert.rejects(requestPasswordReset("synthetic@example.invalid"), /잠시 기다린/);
});

test("malformed successful response and network failure are not fake member sessions", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ user: { email: "synthetic@example.invalid" } }));
  await assert.rejects(getMember(), AuthError);
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("network"); });
  await assert.rejects(signIn("synthetic@example.invalid", "Synthetic123!"));
});


test("Kakao client posts only provider and rejects unexpected redirect destinations",async t=>{
  let target="https://kauth.kakao.com/oauth/authorize?state=synthetic";
  t.mock.method(globalThis,"fetch",async(url:string,init:RequestInit)=>{
    assert.equal(url,"/api/auth/sign-in/social"); assert.deepEqual(JSON.parse(init.body as string),{provider:"kakao"});
    return Response.json({url:target});
  });
  assert.equal(await signInWithKakao(),target);
  target="https://evil.invalid/authorize"; await assert.rejects(signInWithKakao(),AuthError);
});
