import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";
import { randomBytes, randomUUID, randomInt } from "node:crypto";
import { createAuth } from "../../../frontend/lib/server/auth-core.ts";
import { kakaoOptions } from "../../../frontend/lib/server/auth-kakao.ts";
import { createRuntimePool } from "../../../frontend/lib/server/postgres.ts";
import { handleAuth } from "../../../frontend/lib/server/auth-handler.ts";

const require=createRequire(new URL("../../../frontend/package.json",import.meta.url));
const {Pool}=require("pg");
const baseURL="http://localhost:4320";
const prefix=`kakao-it-${randomUUID()}`;
const ids=new Set<string>(); const states=new Set<string>();
const mail: {email:string;url:string}[]=[];
let admin: InstanceType<typeof Pool>; let pool: ReturnType<typeof createRuntimePool>; let auth: ReturnType<typeof createAuth>;
let sequence=0;
const options=kakaoOptions({KAKAO_ENABLED:"true",KAKAO_CLIENT_ID:"synthetic-client",KAKAO_CLIENT_SECRET:"synthetic-secret"})!;
before(async()=>{
 const env=parseEnv(await readFile(new URL("../../.env.local",import.meta.url),"utf8"));
 const url=(role:string,key:string)=>`postgresql://${role}:${encodeURIComponent(env[key])}@127.0.0.1:${env.SUNNY_PG_PORT||5434}/sunny`;
 admin=new Pool({connectionString:url("sunny_admin","SUNNY_PG_ADMIN_PASSWORD"),max:1});
 pool=createRuntimePool(url("sunny_auth","SUNNY_PG_AUTH_PASSWORD"),"sunny_auth");
 auth=createAuth(pool,{baseURL,secret:randomBytes(48).toString("base64url"),mailer:async message=>{mail.push(message);},kakao:options});
});
after(async()=>{
 if(admin&&ids.size) await admin.query('DELETE FROM auth."user" WHERE id=ANY($1::uuid[])',[[...ids]]);
 if(admin&&states.size) await admin.query('DELETE FROM auth.verification WHERE identifier=ANY($1::text[])',[[...states].map(s=>`auth-state:${s}`)]);
 await Promise.all([pool?.end(),admin?.end()]);
});
const cookie=(response:Response)=>response.headers.getSetCookie().map(value=>value.split(";",1)[0]).join("; ");
async function call(path:string,body?:unknown,jar?:string,ready=true) {
 const headers=new Headers({origin:baseURL,"content-type":"application/json","x-forwarded-for":`192.0.2.${++sequence}`});
 if(jar)headers.set("cookie",jar);
 return handleAuth(new Request(`${baseURL}/api/auth/${path}`,{method:body===undefined?"GET":"POST",headers,...(body===undefined?{}:{body:JSON.stringify(body)})}),auth,{baseURL,emailReady:true,kakaoReady:ready});
}
async function begin(jar?:string) {
 const response=await call("sign-in/social",{provider:"kakao"},jar);
 assert.equal(response.status,200); const data=await response.json(); assert.deepEqual(Object.keys(data),["url"]);
 const target=new URL(data.url); assert.equal(target.origin,"https://kauth.kakao.com");
 assert.equal(target.searchParams.get("redirect_uri"),`${baseURL}/api/auth/callback/kakao`);
 assert.deepEqual(target.searchParams.get("scope")!.split(" ").sort(),["account_email","profile_nickname"]);
 const state=target.searchParams.get("state")!; assert.ok(state); states.add(state);
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM auth.verification WHERE identifier=$1',[`auth-state:${state}`])).rows[0].n,1);
 return {state,jar:[jar,cookie(response)].filter(Boolean).join("; ")};
}
function mockProvider(t:Parameters<Parameters<typeof test>[1]>[0], profile:Record<string,unknown>) {
 const code=`synthetic-code-${randomUUID()}`; const token=`synthetic-access-${randomUUID()}`;
 const realFetch=globalThis.fetch;
 t.mock.method(globalThis,"fetch",async(input: string|URL|Request,init?:RequestInit)=>{
   const target=new URL(input instanceof Request?input.url:String(input));
   if(target.origin==="https://kauth.kakao.com"&&target.pathname==="/oauth/token") {
     const params=new URLSearchParams(String(init?.body));
     assert.equal(params.get("code"),code); assert.equal(params.get("client_secret"),"synthetic-secret");
     return Response.json({access_token:token,refresh_token:"synthetic-refresh",token_type:"bearer",expires_in:3600,scope:"account_email profile_nickname"});
   }
   if(target.origin==="https://kapi.kakao.com"&&target.pathname==="/v2/user/me") {
     assert.equal(new Headers(init?.headers).get("authorization"),`Bearer ${token}`);
     return Response.json(profile);
   }
   throw new Error("Unexpected outbound fetch in isolated Kakao test");
 });
 return {code,token,restore:()=>{globalThis.fetch=realFetch;}};
}
const profile=(email:string,verified=true)=>({id:randomInt(100000000,2000000000),kakao_account:{email,is_email_valid:true,is_email_verified:verified,profile:{nickname:"KakaoTest"}}});
async function track(email:string) {
 const result=await admin.query('SELECT id FROM auth."user" WHERE email=$1',[email]);
 if(result.rows[0]) ids.add(result.rows[0].id);
 return result.rows[0]?.id as string|undefined;
}

test("kakao is opt-in and incomplete credentials do not enable it",()=>{
 assert.equal(kakaoOptions({}),undefined);
 assert.equal(kakaoOptions({KAKAO_ENABLED:"true",KAKAO_CLIENT_ID:"only-one"}),undefined);
 assert.equal(options.requireEmailVerification,true);
});
test("only Kakao, fixed callbacks and redirect code flow are accepted",async()=>{
 assert.equal((await call("sign-in/social",{provider:"kakao"},undefined,false)).status,503);
 assert.equal((await call("sign-in/social",{provider:"google"})).status,400);
 for(const extra of [{callbackURL:"https://evil.invalid"},{idToken:{token:"forged"}},{scopes:["phone_number"]},{additionalData:{link:{userId:randomUUID()}}}])
  assert.equal((await call("sign-in/social",{provider:"kakao",...extra})).status,400);
 assert.equal((await call("callback/google?code=synthetic")).status,404);
});
test("valid Kakao callback creates UUID member + encrypted provider account + cookie session; repeat login reuses UUID",async t=>{
 const email=`${prefix}-member@example.invalid`; const identity=profile(email);
 const remote=mockProvider(t,identity);
 const first=await begin();
 const response=await call(`callback/kakao?code=${remote.code}&state=${first.state}`,undefined,first.jar);
 assert.equal(response.headers.get("location"),`${baseURL}/account`);
 const id=await track(email); assert.ok(id);
 const session=await (await call("get-session",undefined,cookie(response))).json(); assert.equal(session.user.id,id);
 assert.equal(session.user.isAnonymous,false); assert.equal(session.user.nickname,"KakaoTest");
 assert.equal(JSON.stringify(session).includes(remote.token),false);
 const account=(await admin.query('SELECT "providerId","accountId","accessToken",password FROM auth.account WHERE "userId"=$1',[id])).rows[0];
 assert.equal(account.providerId,"kakao"); assert.equal(account.accountId,String(identity.id)); assert.equal(account.password,null);
 assert.ok(account.accessToken); assert.notEqual(account.accessToken,remote.token);
 const again=await begin(); const second=await call(`callback/kakao?code=${remote.code}&state=${again.state}`,undefined,again.jar);
 assert.equal((await (await call("get-session",undefined,cookie(second))).json()).user.id,id);
 await call("sign-out",{},cookie(second)); assert.equal(await (await call("get-session",undefined,cookie(second))).json(),null);
});
test("missing email is rejected; unverified email stays sessionless until email verification",async t=>{
 const missing=mockProvider(t,{id:randomInt(100000000,2000000000),kakao_account:{profile:{nickname:"NoEmail"}}});
 const first=await begin(); const denied=await call(`callback/kakao?code=${missing.code}&state=${first.state}`,undefined,first.jar);
 assert.equal(denied.headers.get("location"),`${baseURL}/login?auth=kakao-email-required`); missing.restore();
 const email=`${prefix}-unverified@example.invalid`; const remote=mockProvider(t,profile(email,false));
 const flow=await begin(); const response=await call(`callback/kakao?code=${remote.code}&state=${flow.state}`,undefined,flow.jar);
 const id=await track(email); assert.ok(id);
 assert.equal(response.headers.get("location"),`${baseURL}/login?auth=kakao-email-unverified`);
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM auth.session WHERE "userId"=$1',[id])).rows[0].n,0);
 assert.ok(mail.find(message=>message.email===email));
 const verification=await handleAuth(new Request(mail.find(message=>message.email===email)!.url),auth,{baseURL,emailReady:true,kakaoReady:true});
 assert.equal(verification.headers.get("location"),`${baseURL}/login?auth=email-verified`);
 const retry=await begin(); const logged=await call(`callback/kakao?code=${remote.code}&state=${retry.state}`,undefined,retry.jar);
 assert.equal(logged.headers.get("location"),`${baseURL}/account`);
});
test("existing credential email cannot be silently linked to Kakao",async t=>{
 const email=`${prefix}-existing@example.invalid`;
 assert.equal((await call("sign-up/email",{name:"Existing",email,password:"Synthetic123!"})).status,200);
 const id=await track(email); assert.ok(id);
 const remote=mockProvider(t,profile(email)); const flow=await begin();
 const response=await call(`callback/kakao?code=${remote.code}&state=${flow.state}`,undefined,flow.jar);
 assert.equal(response.headers.get("location"),`${baseURL}/login?auth=kakao-account-exists`);
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM auth.account WHERE "userId"=$1 AND "providerId"=\'kakao\'',[id])).rows[0].n,0);
});
test("cancel, forged/missing/replayed state or cookie cannot create a session; errors do not leak descriptions",async()=>{
 const flow=await begin();
 const cancelled=await call(`callback/kakao?error=access_denied&error_description=PRIVATE&state=${flow.state}`,undefined,flow.jar);
 assert.equal(cancelled.headers.get("location"),`${baseURL}/login?auth=kakao-cancelled`);
 const replay=await call(`callback/kakao?code=synthetic&state=${flow.state}`,undefined,flow.jar);
 assert.equal(replay.headers.get("location"),`${baseURL}/login?auth=kakao-failed`);
 const expired=await begin();
 await admin.query(`UPDATE auth.verification SET "expiresAt"=now()-interval '1 second', value=jsonb_set(value::jsonb,'{expiresAt}',to_jsonb(0))::text WHERE identifier=$1`,[`auth-state:${expired.state}`]);
 assert.equal((await call(`callback/kakao?code=synthetic&state=${expired.state}`,undefined,expired.jar)).headers.get("location"),`${baseURL}/login?auth=kakao-failed`);
 const next=await begin();
 const missing=await call(`callback/kakao?code=synthetic&state=${next.state}`);
 assert.equal(missing.headers.get("location"),`${baseURL}/login?auth=kakao-failed`);
 assert.equal((await call("callback/kakao?code=synthetic&state=forged")).headers.get("location"),`${baseURL}/login?auth=kakao-failed`);
 assert.equal((await call("callback/kakao?code=synthetic")).headers.get("location"),`${baseURL}/login?auth=kakao-failed`);
});
test("Kakao sign-in from a guest preserves the guest UUID and ownership boundary",async t=>{
 const guestResponse=await call("sign-in/anonymous",{}); const guest=await guestResponse.json(); ids.add(guest.user.id);
 const email=`${prefix}-from-guest@example.invalid`; const remote=mockProvider(t,profile(email));
 const flow=await begin(cookie(guestResponse));
 const response=await call(`callback/kakao?code=${remote.code}&state=${flow.state}`,undefined,flow.jar);
 const id=await track(email); assert.ok(id); assert.notEqual(id,guest.user.id);
 assert.equal(response.headers.get("location"),`${baseURL}/account`);
 assert.equal((await admin.query('SELECT "isAnonymous" FROM auth."user" WHERE id=$1',[guest.user.id])).rows[0].isAnonymous,true);
});
