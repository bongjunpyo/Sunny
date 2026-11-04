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
let requestNumber = 0;

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
async function call(path:string, body?:unknown, cookie?:string, options:{origin?:string; method?:string; emailReady?:boolean; ip?:string}={}) {
  const h = new Headers({ origin:options.origin ?? baseURL, "content-type":"application/json",
    "x-forwarded-for":options.ip ?? `192.0.2.${++requestNumber}` });
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
  assert.equal(result.status,200); assert.deepEqual(await result.json(),{registered:true,message:"가입을 완료했습니다. 로그인해 주세요."});
  const found=await admin.query('SELECT id FROM auth."user" WHERE email=$1',[email]);
  ids.add(found.rows[0].id);
  return {email,id:found.rows[0].id};
}

test("schema matches UUID model and both runtime roles reject privilege escalation", async()=>{
  await verifyRuntimePool(pool,"sunny_auth"); await verifyRuntimePool(app,"sunny_app");
  for (const [client,schema] of [[pool,"auth"],[app,"app"]] as const) {
    const path=(await client.query("SHOW search_path")).rows[0].search_path;
    assert.deepEqual(path.split(",").map((part:string)=>part.trim()),["pg_catalog",schema]);
  }
  const tables=await admin.query(`SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='auth' ORDER BY tablename`);
  assert.deepEqual(tables.rows.map((r:{tablename:string})=>r.tablename),["account","session","user","verification"]);
  assert.ok(tables.rows.every((r:{rowsecurity:boolean})=>r.rowsecurity));
  const columns=await admin.query(`SELECT table_name,column_name,udt_name FROM information_schema.columns WHERE table_schema='auth'`);
  for (const c of columns.rows.filter((c:{column_name:string})=>["id","userId"].includes(c.column_name))) assert.equal(c.udt_name,"uuid");
  for (const statement of ['SELECT * FROM auth.session','CREATE TABLE app.auth_probe(id int)','SET ROLE sunny_owner']) await assert.rejects(app.query(statement));
  for (const statement of ['CREATE TABLE auth.auth_probe(id int)','SELECT * FROM sunny_meta.schema_migrations','SET ROLE sunny_owner']) await assert.rejects(pool.query(statement));
});

test("signup needs no mail, stays honestly unverified and can log in, fetch session, and log out",async()=>{
  const member=await signup("member");
  assert.equal(await (await call("get-session")).json(),null);
  const denied=await call("sign-in/email",{email:member.email,password});
  assert.equal(denied.status,200);
  assert.equal((await admin.query('SELECT "emailVerified" FROM auth."user" WHERE id=$1',[member.id])).rows[0].emailVerified,false);
  assert.equal(mail.length,0);
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
  const member=await signup("from-guest",cookie); const login=await call("sign-in/email",{email:member.email,password},cookie); assert.equal(login.status,200);
  const logged=await login.json(); assert.notEqual(logged.user.id,dto.user.id);
  assert.equal((await admin.query('SELECT "isAnonymous" FROM auth."user" WHERE id=$1',[dto.user.id])).rows[0].isAnonymous,true);
  const blocked=await call("sign-in/anonymous",{},jar(login)); assert.equal(blocked.status,409);
});

test("reusing an aged guest session forwards its renewed HttpOnly cookie",async()=>{
  const guest=await call("sign-in/anonymous",{}); assert.equal(guest.status,200);
  const dto=await guest.json(); ids.add(dto.user.id); const cookie=jar(guest);
  await admin.query('UPDATE auth.session SET "expiresAt"=now()+interval \'2 days\', "updatedAt"=now()-interval \'5 days\' WHERE "userId"=$1',[dto.user.id]);
  const again=await call("sign-in/anonymous",{},cookie); assert.equal(again.status,200);
  const renewed=await again.json(); assertPrivate(renewed);
  assert.equal(renewed.user.id,dto.user.id);
  assert.ok(again.headers.getSetCookie().some(value=>value.startsWith("sunny.session_token=")&&/HttpOnly/i.test(value)),"Renewed cookie was dropped");
  assert.ok(Date.parse(renewed.session.expiresAt)>Date.now()+6*86400000);
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM auth.session WHERE "userId"=$1',[dto.user.id])).rows[0].n,1);
});

test("native login throttling exposes a bounded Retry-After and safe error",async()=>{
  for (let attempt=0;attempt<10;attempt++) {
    const response=await call("sign-in/email",{email:`${prefix}-rate@example.invalid`,password},undefined,{ip:"198.51.100.92"});
    assert.equal(response.status,401);
  }
  const limited=await call("sign-in/email",{email:`${prefix}-rate@example.invalid`,password},undefined,{ip:"198.51.100.92"});
  assert.equal(limited.status,429);
  const retry=Number(limited.headers.get("Retry-After"));
  assert.ok(retry>=1&&retry<=60,"Missing or invalid standard retry header");
  const result=await limited.json(); assertPrivate(result); assert.equal(result.error.code,"AUTH_RATE_LIMITED");
  assert.equal(limited.headers.get("cache-control"),"no-store");
});

test("signup and login work without a mail provider and never call the old signup mailer",async()=>{
  const email=`${prefix}-no-mail@example.invalid`; let calls=0;
  const standalone=createAuth(pool,{baseURL,secret:randomBytes(48).toString("base64url"),mailer:async()=>{calls++;throw new Error("NOT_CALLED");}});
  const response=await handleAuth(new Request(`${baseURL}/api/auth/sign-up/email`,{method:"POST",headers:{origin:baseURL,"content-type":"application/json"},body:JSON.stringify({name:"NoMail",email,password})}),standalone,{baseURL,emailReady:false});
  assert.equal(response.status,200); assert.equal(response.headers.getSetCookie().length,0); assert.equal(calls,0);
  const user=(await admin.query('SELECT id,"emailVerified" FROM auth."user" WHERE email=$1',[email])).rows[0];ids.add(user.id);assert.equal(user.emailVerified,false);
  assert.equal((await call("sign-in/email",{email,password},undefined,{emailReady:false})).status,200);
});

test("only explicit auth paths and methods are advertised",async()=>{
  for(const path of ["toString","constructor","__proto__"]) assert.equal((await call(path)).status,404);
  const wrong=await call("sign-in/email");
  assert.equal(wrong.status,405); assert.equal(wrong.headers.get("Allow"),"POST");
});

test("DB-revoked/expired sessions and forged cookies are rejected",async()=>{
  const guest=await call("sign-in/anonymous",{}); assert.equal(guest.status,200);
  const dto=await guest.json(); ids.add(dto.user.id); const cookie=jar(guest);
  await admin.query('UPDATE auth.session SET "expiresAt"=now()-interval \'1 second\' WHERE "userId"=$1',[dto.user.id]);
  assert.equal(await (await call("get-session?disableCookieCache=false",undefined,cookie)).json(),null);
  assert.equal(await (await call("get-session",undefined,"sunny.session_token=forged")).json(),null);
});

test("origin, mass assignment, native token/delete and retired verification endpoints are blocked",async()=>{
  assert.equal((await call("sign-in/anonymous",{},undefined,{origin:"https://evil.example.invalid"})).status,403);
  assert.equal((await call("sign-in/anonymous",{ownerId:randomUUID()})).status,400);
  assert.equal((await call("delete-anonymous-user",{})).status,404);
  assert.equal((await call("token")).status,404);
  assert.equal((await call("verify-email?token=EXAMPLE&callbackURL=https://evil.example.invalid")).status,404);
  assert.equal((await call("request-password-reset",{email:`${prefix}-disabled@example.invalid`},undefined,{emailReady:false})).status,503);
});

test("same app pool client uses transaction-local identity and clears it after commit/rollback",async()=>{
  const id=randomUUID();
  assert.equal(await withUserTransaction(app,id,async client=>(await client.query("SELECT current_setting('app.user_id',true) AS id")).rows[0].id),id);
  await assert.rejects(withUserTransaction(app,id,async()=>{throw new Error("Synthetic rollback");}));
  const state=await app.query("SELECT NULLIF(current_setting('app.user_id',true),'') AS id"); assert.equal(state.rows[0].id,null);
});

test("installed adapter reports no missing tables, columns, or unsafe type differences",async()=>{
  const {getMigrations}=await import(require.resolve("better-auth/db/migration"));
  const adapterRequire=createRequire(require.resolve("better-auth/db/migration"));
  const {createKyselyAdapter}=await import(adapterRequire.resolve("@better-auth/kysely-adapter"));
  const {kysely}=await createKyselyAdapter(auth.options);
  // CLI planning otherwise uses current_schema() = pg_catalog with the hardened
  // runtime search path. Explicitly inspect auth; never execute the returned DDL.
  const migration=await getMigrations({...auth.options,database:{db:kysely,type:"postgres",schemaName:"auth",transaction:true}});
  assert.equal(migration.toBeCreated.length,0); assert.equal(migration.toBeAdded.length,0);
  assert.deepEqual(migration.unsafeChanges,[]); assert.deepEqual(migration.schemaProblems,[]);
});

test("duplicate signup keeps the same public result without changing the original credential",async()=>{
  const member=await signup("duplicate");
  const first=await call("sign-up/email",{name:"TestMember",email:member.email,password});
  assert.equal(first.status,200); assert.equal((await first.json()).registered,true);
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


test("retired signup verification paths cannot mark a user verified or issue a session", async () => {
 const user=await signup("retired");
 for(const path of ["verify-email?token=synthetic-only","send-verification-email"]){const result=await call(path,path.includes("?")?undefined:{email:user.email});assert.equal(result.status,404);assert.equal(result.headers.getSetCookie().length,0);}
 assert.equal((await admin.query('SELECT "emailVerified" FROM auth."user" WHERE id=$1',[user.id])).rows[0].emailVerified,false);
});
