import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createAuth } from "../../../frontend/lib/server/auth-core.ts";
import { handleAuth } from "../../../frontend/lib/server/auth-handler.ts";
import { createRuntimePool } from "../../../frontend/lib/server/postgres.ts";
import { hashPassword as legacyHash } from "../../../frontend/node_modules/better-auth/dist/crypto/index.mjs";

const require = createRequire(new URL("../../../frontend/package.json", import.meta.url));
const { Pool } = require("pg");
const baseURL = "http://localhost:4312", prefix = `reset-${randomUUID()}`;
const password = "Synthetic-Old-112!", replacement = "Synthetic-New-112!";
const ids = new Set<string>(), mail: { email: string; url: string }[] = [], resets: { email: string; url: string }[] = [];
let admin: InstanceType<typeof Pool>, pool: ReturnType<typeof createRuntimePool>, auth: ReturnType<typeof createAuth>;
let sequence = 0, failMail = false;
before(async () => {
  const env = parseEnv(await readFile(new URL("../../.env.local", import.meta.url), "utf8"));
  const connection = (role: string, key: string) => `postgresql://${role}:${encodeURIComponent(env[key])}@127.0.0.1:${env.SUNNY_PG_PORT || 5434}/sunny`;
  admin = new Pool({ connectionString: connection("sunny_admin", "SUNNY_PG_ADMIN_PASSWORD"), max: 1 });
  pool = createRuntimePool(connection("sunny_auth", "SUNNY_PG_AUTH_PASSWORD"), "sunny_auth");
  auth = createAuth(pool, { baseURL, secret: randomBytes(48).toString("base64url"), mailer: async m => { mail.push(m); },
    resetMailer: async m => { if (failMail) throw new Error("PRIVATE_PROVIDER_ERROR"); resets.push(m); } });
});
after(async () => {
  if (admin && ids.size) {
    await admin.query('DELETE FROM auth.verification WHERE value=ANY($1::text[])', [[...ids]]);
    await admin.query('DELETE FROM auth."user" WHERE id=ANY($1::uuid[])', [[...ids]]);
  }
  await Promise.all([pool?.end(), admin?.end()]);
});
const cookie = (r: Response) => r.headers.getSetCookie().map(c => c.split(";", 1)[0]).join("; ");
async function call(path: string, body?: unknown, options: { cookie?: string; ready?: boolean; origin?: string; ip?: string } = {}) {
  const headers = new Headers({ origin: options.origin ?? baseURL, "content-type": "application/json", "x-forwarded-for": options.ip ?? `192.0.2.${++sequence}` });
  if (options.cookie) headers.set("cookie", options.cookie);
  return handleAuth(new Request(`${baseURL}/api/auth/${path}`, { method: body === undefined ? "GET" : "POST", headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), auth, { baseURL, emailReady: options.ready ?? true });
}
async function member(suffix: string) {
  const email = `${prefix}-${suffix}@example.invalid`;
  assert.equal((await call("sign-up/email", { email, name: "ResetTest", password })).status, 200);
  const id = (await admin.query('SELECT id FROM auth."user" WHERE email=$1', [email])).rows[0].id; ids.add(id);
  assert.equal(mail.length, 0, "Signup must never send mail");

  return { email, id };
}
async function request(email: string) {
  const r = await call("request-password-reset", { email }); assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { message: "비밀번호 재설정이 가능한 계정이면 안내 메일을 보냈습니다." });
  const target = new URL(resets.filter(m => m.email === email).at(-1)!.url);
  assert.equal(target.origin, baseURL); assert.equal(target.pathname, "/reset-password"); assert.equal(target.search, "");
  return new URLSearchParams(target.hash.slice(1)).get("token")!;
}

test("new accounts keep scrypt; reset changes password, consumes token, revokes every old session and does not auto-login", async () => {
  const user = await member("success");
  const before = (await admin.query('SELECT password FROM auth.account WHERE "userId"=$1', [user.id])).rows[0].password;
  assert.match(before, /^[a-f0-9]+:[a-f0-9]+$/); assert.notEqual(before, password);
  const a = await call("sign-in/email", { email: user.email, password });
  const b = await call("sign-in/email", { email: user.email, password });
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  const token = await request(user.email);
  const expires = (await admin.query('SELECT "expiresAt" FROM auth.verification WHERE identifier=$1', [`reset-password:${token}`])).rows[0].expiresAt;
  assert.ok(expires.getTime() - Date.now() > 3500000 && expires.getTime() - Date.now() <= 3600000);
  const response = await call("reset-password", { token, newPassword: replacement });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { success: true });
  assert.equal(response.headers.getSetCookie().length, 0);
  for (const old of [a, b]) assert.equal(await (await call("get-session", undefined, { cookie: cookie(old) })).json(), null);
  assert.equal((await call("sign-in/email", { email: user.email, password })).status, 401);
  assert.equal((await call("sign-in/email", { email: user.email, password: replacement })).status, 200);
  assert.equal((await call("reset-password", { token, newPassword: "Replay-112!" })).status, 400);
  const after = (await admin.query('SELECT password FROM auth.account WHERE "userId"=$1', [user.id])).rows[0].password;
  assert.match(after, /^[a-f0-9]+:[a-f0-9]+$/); assert.notEqual(after, before);
});

test("existing scrypt passwords including over 72 bytes remain valid and reset stays scrypt", async () => {
  const user = await member("legacy"), long = "Legacy1" + "x".repeat(90);
  await admin.query('UPDATE auth.account SET password=$1 WHERE "userId"=$2', [await legacyHash(long), user.id]);
  assert.equal((await call("sign-in/email", { email: user.email, password: long })).status, 200);
  const wrong = await call("sign-in/email", { email: user.email, password: long + "x" });
  const absent = await call("sign-in/email", { email: `${prefix}-missing@example.invalid`, password: long });
  assert.equal(wrong.status, 401); assert.equal(absent.status, 401); assert.deepEqual(await wrong.json(), await absent.json());
  const token = await request(user.email);
  assert.equal((await call("reset-password", { token, newPassword: replacement })).status, 200);
  assert.match((await admin.query('SELECT password FROM auth.account WHERE "userId"=$1', [user.id])).rows[0].password, /^[a-f0-9]+:[a-f0-9]+$/);
  assert.equal((await call("sign-in/email", { email: user.email, password: replacement })).status, 200);
});

test("unknown and social-only accounts get identical notices; social accounts cannot acquire a credential through reset", async () => {
  const user = await member("social");
  await admin.query('DELETE FROM auth.account WHERE "userId"=$1', [user.id]);
  await admin.query('INSERT INTO auth.account(id,"userId","providerId","accountId","createdAt","updatedAt") VALUES($1,$2,\'kakao\',$3,now(),now())', [randomUUID(), user.id, randomUUID()]);
  const count = resets.length;
  const a = await call("request-password-reset", { email: user.email });
  const b = await call("request-password-reset", { email: `${prefix}-missing@example.invalid` });
  assert.equal(a.status, 200); assert.equal(b.status, 200); assert.deepEqual(await a.json(), await b.json()); assert.equal(resets.length, count);
  const row = (await admin.query('SELECT identifier FROM auth.verification WHERE value=$1 AND identifier LIKE \'reset-password:%\'', [user.id])).rows[0];
  assert.ok(row);
  assert.equal((await call("reset-password", { token: row.identifier.slice(15), newPassword: replacement })).status, 400);
  assert.equal((await admin.query('SELECT count(*)::int n FROM auth.account WHERE "userId"=$1 AND "providerId"=\'credential\'', [user.id])).rows[0].n, 0);
});

test("wrong origin, callback injection, query token, invalid/expired token and weak/overlong passwords are rejected", async () => {
  const user = await member("invalid"), token = await request(user.email);
  assert.equal((await call("request-password-reset", { email: user.email }, { origin: "https://evil.invalid" })).status, 403);
  assert.equal((await call("reset-password", { token, newPassword: replacement }, { origin: "https://evil.invalid" })).status, 403);
  assert.equal((await call("request-password-reset", { email: user.email, redirectTo: "https://evil.invalid" })).status, 400);
  assert.equal((await call(`reset-password?token=${token}`, { newPassword: replacement })).status, 400);
  for (const newPassword of ["short", "onlyletters", "a1" + "x".repeat(127)]) assert.equal((await call("reset-password", { token, newPassword })).status, 400);
  assert.equal((await call("sign-up/email", { email: `${prefix}-long@example.invalid`, name: "Long", password: "a1" + "x".repeat(127) })).status, 400);
  assert.equal((await call("reset-password", { token: "forged", newPassword: replacement })).status, 400);
  await admin.query('UPDATE auth.verification SET "expiresAt"=now()-interval \'1 second\' WHERE identifier=$1', [`reset-password:${token}`]);
  assert.equal((await call("reset-password", { token, newPassword: replacement })).status, 400);
  assert.equal((await call("sign-in/email", { email: user.email, password })).status, 200);
});

test("only one simultaneous use succeeds; unverified users stay unverified after reset", async () => {
  const user = await member("race"), token = await request(user.email);
  const responses = await Promise.all([call("reset-password", { token, newPassword: replacement }), call("reset-password", { token, newPassword: "Other-New-112!" })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
  assert.equal((await admin.query('SELECT "emailVerified" FROM auth."user" WHERE id=$1', [user.id])).rows[0].emailVerified, false);
  assert.equal((await admin.query('SELECT count(*)::int n FROM auth.session WHERE "userId"=$1', [user.id])).rows[0].n, 0);
});

test("mail unavailable and provider errors cannot report success or leak provider data; reset requests are rate limited", async () => {
  const user = await member("mail");
  assert.equal((await call("request-password-reset", { email: user.email }, { ready: false })).status, 503);
  failMail = true;
  try {
    const failed = await call("request-password-reset", { email: user.email });
    assert.equal(failed.status, 503); const body = await failed.json(); assert.equal(body.error.code, "AUTH_EMAIL_UNAVAILABLE");
    assert.equal(JSON.stringify(body).includes("PRIVATE_PROVIDER_ERROR"), false);
  } finally { failMail = false; }
  const statuses = [];
  for (let i = 0; i < 4; i++) statuses.push((await call("request-password-reset", { email: `${prefix}-missing@example.invalid` }, { ip: "198.51.100.112" })).status);
  assert.deepEqual(statuses, [200, 200, 200, 429]);
});
