import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { createAuth } from "../../../frontend/lib/server/auth-core.ts";
import { createRuntimePool, verifyRuntimePool, withUserTransaction } from "../../../frontend/lib/server/postgres.ts";
import { handleAuth } from "../../../frontend/lib/server/auth-handler.ts";

const require = createRequire(new URL("../../../frontend/package.json", import.meta.url));
const { Pool } = require("pg");
const baseURL = "http://localhost:4300";
const ids = new Set<string>();
const mail: {email:string; url:string}[] = [];
const prefix = `auth-it-${randomUUID()}`;
const password = "Synthetic-Auth-Test-Only-92!";
const parseEnv = (text: string) => Object.fromEntries(text.split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#"))
  .map(l => [l.slice(0,l.indexOf("=")).trim(), l.slice(l.indexOf("=")+1).trim()]));
let auth: ReturnType<typeof createAuth>;
let admin: InstanceType<typeof Pool>;
let pool: ReturnType<typeof createRuntimePool>;
let app: ReturnType<typeof createRuntimePool>;

before(async () => {
  const env = parseEnv(await readFile(new URL("../../.env.local", import.meta.url), "utf8"));
  const port = env.SUNNY_PG_PORT || "5434";
  const url = (role:string, key:string) => `postgresql://${role}:${encodeURIComponent(env[key])}@127.0.0.1:${port}/sunny`;
  admin = new Pool({ connectionString: url("sunny_admin", "SUNNY_PG_ADMIN_PASSWORD"), max:1 });
  const identity = await admin.query("SELECT current_database() AS db, session_user AS role");
  assert.equal(identity.rows[0].db, "sunny"); assert.equal(identity.rows[0].role, "sunny_admin");
  pool = createRuntimePool(url("sunny_auth", "SUNNY_PG_AUTH_PASSWORD"), "sunny_auth");
  app = createRuntimePool(url("sunny_app", "SUNNY_PG_APP_PASSWORD"), "sunny_app");
  auth = createAuth(pool, { baseURL, secret:randomBytes(48).toString("base64url"), mailer:async m => { mail.push(m); } });
});
after(async () => {
  if (admin && ids.size) await admin.query('DELETE FROM auth."user" WHERE id = ANY($1::uuid[])', [[...ids]]);
  if (admin) await admin.query('DELETE FROM auth.verification WHERE identifier LIKE $1', [`%${prefix}%`]);
  await Promise.all([pool?.end(),app?.end(),admin?.end()]);
});
function jar(response:Response) { return response.headers.getSetCookie().map(c => c.split(";",1)[0]).join("; "); }
async function call(path:string, body?:unknown, cookie?:string, options:{origin?:string; method?:string; emailReady?:boolean}={}) {
  const h = new Headers({ origin:options.origin ?? baseURL, "content-type":"application/json" });
  if (cookie) h.set("cookie",cookie);
  const method=options.method ?? (body === undefined ? "GET":"POST");
  return handleAuth(new Request(`${baseURL}/api/auth/${path}`, { method, headers:h,
    ...(body === undefined ? {} : {body:JSON.stringify(body)}) }), auth, {baseURL,emailReady:options.emailReady ?? true});
}
function assertPrivate(value:unknown) {
  const text=JSON.stringify(value);
  assert.equal(/"(?:token|password|accessToken|refreshToken|userId|ipAddress|userAgent)"\s*:/.test(text),false,"Private fields in API JSON");
}
async function signup(suffix:string, cookie?:string) {
  const email=`${prefix}-${suffix}@example.invalid`;
  const result=await call("sign-up/email", {name:"TestMember",email,password}, cookie);
  assert.equal(result.status,200); assert.deepEqual(await result.json(),{verificationPending:true,message:"메일함에서 인증을 마쳐 주세요."});
  const found=await admin.query('SELECT id FROM auth."user" WHERE email=$1',[email]);
  ids.add(found.rows[0].id);
  return {email,id:found.rows[0].id};
}
async function verify(email:string) {
  const sent=mail.find(m=>m.email===email); assert.ok(sent,"Verification mail was not awaited");
  const target=new URL(sent.url);
  const response=await handleAuth(new Request(target),auth,{baseURL,emailReady:true});
  assert.equal(response.status,303,"Verification failed");
  assert.equal(new URL(response.headers.get("location")!).searchParams.get("auth"),"email-verified");
  assert.equal(response.headers.getSetCookie().length,0,"Verification must not auto-login");
}

test("schema matches UUID model and both runtime roles reject privilege escalation", async()=>{
  await verifyRuntimePool(pool,"sunny_auth"); await verifyRuntimePool(app,"sunny_app");
  const tables=await admin.query(`SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='auth' ORDER BY tablename`);
  assert.deepEqual(tables.rows.map((r:{tablename:string})=>r.tablename),["account","session","user","verification"]);
  assert.ok(tables.rows.every((r:{rowsecurity:boolean})=>r.rowsecurity));
  const columns=await admin.query(`SELECT table_name,column_name,udt_name FROM information_schema.columns WHERE table_schema='auth'`);
  for (const c of columns.rows.filter((c:{column_name:string})=>["id","userId"].includes(c.column_name))) assert.equal(c.udt_name,"uuid");
  for (const statement of ['SELECT * FROM auth.session','CREATE TABLE app.auth_probe(id int)','SET ROLE sunny_owner']) await assert.rejects(app.query(statement));
  for (const statement of ['CREATE TABLE auth.auth_probe(id int)','SELECT * FROM sunny_meta.schema_migrations','SET ROLE sunny_owner']) await assert.rejects(pool.query(statement));
});

test("unverified signup is sessionless; verified member can log in, fetch DB session, and log out",async()=>{
  const member=await signup("member");
  assert.equal(await (await call("get-session")).json(),null);
  const denied=await call("sign-in/email",{email:member.email,password});
  assert.equal(denied.status,403); assert.equal((await denied.json()).error.code,"EMAIL_NOT_VERIFIED");
  await verify(member.email);
  const wrong=await call("sign-in/email",{email:member.email,password:"Wrong-synthetic-password!"}); assert.equal(wrong.status,401);
  const login=await call("sign-in/email",{email:member.email,password}); assert.equal(login.status,200);
  assert.equal(login.headers.get("cache-control"),"no-store");
  assert.ok(login.headers.getSetCookie().some(c=>/HttpOnly/i.test(c)&&/SameSite=Lax/i.test(c)));
  const cookie=jar(login); const dto=await login.json(); assertPrivate(dto);
  assert.equal(dto.user.id,member.id); assert.equal(dto.user.isAnonymous,false);
  assert.ok(dto.session.expiresAt);
  const session=await call("get-session",undefined,cookie); const body=await session.json(); assertPrivate(body); assert.equal(body.user.id,member.id);
  const out=await call("sign-out",{},cookie); assert.equal(out.status,200); assert.ok(out.headers.getSetCookie().some(c=>/Max-Age=0/i.test(c)));
  assert.equal(await (await call("get-session",undefined,cookie)).json(),null);
});

test("guest UUID/session is reused; member login preserves guest identity without ownership transfer",async()=>{
  const guest=await call("sign-in/anonymous",{}); assert.equal(guest.status,200);
  const dto=await guest.json(); ids.add(dto.user.id); assertPrivate(dto); assert.equal(dto.user.isAnonymous,true); assert.equal(dto.user.email,undefined);
  assert.match(dto.user.id,/^[a-f0-9-]{36}$/); const cookie=jar(guest);
  const again=await call("sign-in/anonymous",{},cookie); assert.equal((await again.json()).user.id,dto.user.id);
  const member=await signup("from-guest",cookie); await verify(member.email);
  const login=await call("sign-in/email",{email:member.email,password},cookie); assert.equal(login.status,200);
  const logged=await login.json(); assert.notEqual(logged.user.id,dto.user.id);
  assert.equal((await admin.query('SELECT "isAnonymous" FROM auth."user" WHERE id=$1',[dto.user.id])).rows[0].isAnonymous,true);
  const blocked=await call("sign-in/anonymous",{},jar(login)); assert.equal(blocked.status,409);
});

test("DB-revoked/expired sessions and forged cookies are rejected",async()=>{
  const guest=await call("sign-in/anonymous",{}); assert.equal(guest.status,200);
  const dto=await guest.json(); ids.add(dto.user.id); const cookie=jar(guest);
  await admin.query('UPDATE auth.session SET "expiresAt"=now()-interval \'1 second\' WHERE "userId"=$1',[dto.user.id]);
  assert.equal(await (await call("get-session?disableCookieCache=false",undefined,cookie)).json(),null);
  assert.equal(await (await call("get-session",undefined,"sunny.session_token=forged")).json(),null);
});

test("origin, mass assignment, native token/delete endpoints, and unconfigured mail are blocked",async()=>{
  assert.equal((await call("sign-in/anonymous",{},undefined,{origin:"https://evil.example.invalid"})).status,403);
  assert.equal((await call("sign-in/anonymous",{ownerId:randomUUID()})).status,400);
  assert.equal((await call("delete-anonymous-user",{})).status,404);
  assert.equal((await call("token")).status,404);
  assert.equal((await call("verify-email?token=EXAMPLE&callbackURL=https://evil.example.invalid")).status,303);
  assert.equal((await call("sign-up/email",{name:"Synthetic",email:`${prefix}-disabled@example.invalid`,password},undefined,{emailReady:false})).status,503);
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM auth."user" WHERE email=$1',[`${prefix}-disabled@example.invalid`])).rows[0].n,0);
});

test("same app pool client uses transaction-local identity and clears it after commit/rollback",async()=>{
  const id=randomUUID();
  assert.equal(await withUserTransaction(app,id,async client=>(await client.query("SELECT current_setting('app.user_id',true) AS id")).rows[0].id),id);
  await assert.rejects(withUserTransaction(app,id,async()=>{throw new Error("Synthetic rollback");}));
  const state=await app.query("SELECT NULLIF(current_setting('app.user_id',true),'') AS id"); assert.equal(state.rows[0].id,null);
});

test("installed adapter reports no missing tables, columns, or unsafe type differences",async()=>{
  const {getMigrations}=await import(require.resolve("better-auth/db/migration"));
  const migration=await getMigrations(auth.options);
  assert.equal(migration.toBeCreated.length,0); assert.equal(migration.toBeAdded.length,0);
  assert.deepEqual(migration.unsafeChanges,[]); assert.deepEqual(migration.schemaProblems,[]);
});

test("signup/resend does not expose whether an email already exists",async()=>{
  const member=await signup("duplicate");
  const first=await call("sign-up/email",{name:"TestMember",email:member.email,password});
  assert.equal(first.status,200); assert.equal((await first.json()).verificationPending,true);
  const existing=await call("send-verification-email",{email:member.email});
  const missing=await call("send-verification-email",{email:`${prefix}-missing@example.invalid`});
  assert.equal(existing.status,missing.status); assert.deepEqual(await existing.json(),await missing.json());
});

test("HTTPS base URL issues Secure HttpOnly cookies without exposing guest token/email",async()=>{
  const secureURL="https://sunny.example.invalid";
  const secure=createAuth(pool,{baseURL:secureURL,secret:randomBytes(48).toString("base64url"),mailer:async()=>{}});
  const response=await handleAuth(new Request(`${secureURL}/api/auth/sign-in/anonymous`,{method:"POST",
    headers:{origin:secureURL,"content-type":"application/json"},body:"{}"}),secure,{baseURL:secureURL,emailReady:false});
  assert.equal(response.status,200);const data=await response.json(); ids.add(data.user.id); assertPrivate(data);
  assert.ok(response.headers.getSetCookie().some(c=>/; Secure/i.test(c)&&/HttpOnly/i.test(c)));
});


test("encoded HTML-preview query verifies the original signed token and strips it from the redirect", async () => {
  const member = await signup("encoded");
  const { createEmailVerificationToken } = await import(require.resolve("better-auth/api"));
  const expired = await createEmailVerificationToken((await auth.$context).secret, member.email, undefined, -60);
  const expiredURL = new URL(`${baseURL}/api/auth/verify-email`); expiredURL.searchParams.set("token",expired);
  const expiredResponse = await handleAuth(new Request(expiredURL), auth, {baseURL,emailReady:true});
  assert.equal(expiredResponse.headers.get("location"),`${baseURL}/login?auth=verification-expired`);
  assert.equal((await admin.query('SELECT "emailVerified" FROM auth."user" WHERE id=$1',[member.id])).rows[0].emailVerified,false);
  const sent = mail.find(message => message.email === member.email)!;
  const original = new URL(sent.url); original.searchParams.set("callbackURL", "/login");
  const broken = new URL(original); broken.search = encodeURIComponent(original.search.slice(1).replaceAll("&", "&amp;"));
  const response = await handleAuth(new Request(broken), auth, {baseURL, emailReady:true});
  assert.equal(response.status,303);
  assert.equal(response.headers.get("location"), `${baseURL}/login?auth=email-verified`);
  assert.equal(response.headers.getSetCookie().length,0);
  assert.equal((await admin.query('SELECT "emailVerified" FROM auth."user" WHERE id=$1',[member.id])).rows[0].emailVerified,true);
  const token = original.searchParams.get("token")!;
  const parts=token.split("."); parts[2]=(parts[2].startsWith("x")?"y":"x")+parts[2].slice(1);
  original.searchParams.set("token",parts.join("."));
  const denied=await handleAuth(new Request(original),auth,{baseURL,emailReady:true});
  assert.equal(denied.headers.get("location"),`${baseURL}/login?auth=verification-invalid`);
});
