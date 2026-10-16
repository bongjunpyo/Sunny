// Explicit local-only smoke test. Creates a NEW synthetic member; never consumes existing users' mail links.
// Run from repository root: Node 24 backend/auth/tests/http-flow.mjs
// Leaves one synthetic EmailProof account + a private /tmp fixture for browser verification.
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {randomUUID,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const root=new URL('../../../',import.meta.url);
const require=createRequire(new URL('frontend/package.json',root));
const {Pool}=require('pg');
let pool; let phase='configuration';
try {
 const app=parseEnv(await readFile(new URL('frontend/.env.local',root),'utf8'));
 const db=parseEnv(await readFile(new URL('backend/.env.local',root),'utf8'));
 const base=new URL(app.BETTER_AUTH_URL);
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(base.hostname));
 assert.equal(base.protocol,'http:'); assert.equal(app.AUTH_DEV_LOCAL_MAIL,'true'); assert.equal(app.AUTH_ENABLED,'true');
 pool=new Pool({connectionString:`postgresql://sunny_admin:${encodeURIComponent(db.SUNNY_PG_ADMIN_PASSWORD)}@127.0.0.1:${db.SUNNY_PG_PORT||5434}/sunny`,max:1});
 const email=`auth-http-${randomUUID()}@example.invalid`; const password=`Synthetic1!${randomBytes(18).toString('base64url')}`;
 const call=(path,body,cookie)=>fetch(new URL(`/api/auth/${path}`,base),{method:body===undefined?'GET':'POST',redirect:'manual',
   headers:{origin:base.origin,'content-type':'application/json',...(cookie?{cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const jar=response=>response.headers.getSetCookie().map(item=>item.split(';',1)[0]).join('; ');
 const snapshot=async()=> (await pool.query(`SELECT u.id,u."emailVerified",(SELECT count(*)::int FROM auth.account a WHERE a."userId"=u.id AND a.password IS NOT NULL) AS passwords,(SELECT count(*)::int FROM auth.session s WHERE s."userId"=u.id) AS sessions FROM auth."user" u WHERE email=$1`,[email])).rows[0];
 phase='signup and persistence';
 const signup=await call('sign-up/email',{name:'EmailProof',email,password});
 assert.equal(signup.status,200); assert.equal((await signup.json()).verificationDelivery,'local');
 const created=await snapshot(); assert.ok(created.id); assert.equal(created.emailVerified,false); assert.equal(created.passwords,1); assert.equal(created.sessions,0);
 phase='unverified login rejected'; assert.equal((await call('sign-in/email',{email,password})).status,403);
 phase='new synthetic text mail'; let verification;
 for (const file of (await readdir(new URL('frontend/.sunny-auth-mail/',root))).filter(name=>name.endsWith('.txt'))) {
   const text=await readFile(new URL(`frontend/.sunny-auth-mail/${file}`,root),'utf8');
   if(text.includes(email)) verification=text.split(/\r?\n/).find(line=>line.startsWith(base.origin+'/api/auth/verify-email?'));
 }
 assert.ok(verification); const url=new URL(verification); assert.equal(url.origin,base.origin); assert.equal(url.pathname,'/api/auth/verify-email');
 phase='encoded-query signature verification';
 const encoded=new URL(url); encoded.search=encodeURIComponent(url.search.slice(1).replaceAll('&','&amp;'));
 const verified=await fetch(encoded,{redirect:'manual'});
 assert.equal(verified.status,303); assert.equal(verified.headers.get('location'),`${base.origin}/login?auth=email-verified`);
 assert.equal(verified.headers.getSetCookie().length,0); assert.equal((await snapshot()).emailVerified,true);
 phase='normal-query handling';
 assert.equal((await fetch(url,{redirect:'manual'})).headers.get('location'),`${base.origin}/login?auth=email-verified`);
 phase='verified login and DB session';
 const login=await call('sign-in/email',{email,password}); assert.equal(login.status,200); const data=await login.json();
 assert.equal(data.user.id,created.id); assert.equal(JSON.stringify(data).includes('"token"'),false);
 assert.ok(login.headers.getSetCookie().some(value=>/HttpOnly/i.test(value)&&/SameSite=Lax/i.test(value)));
 const cookie=jar(login); assert.equal((await (await call('get-session',undefined,cookie)).json()).user.id,created.id);
 assert.ok((await snapshot()).sessions>=1);
 phase='logout invalidates persisted session'; assert.equal((await call('sign-out',{},cookie)).status,200);
 assert.equal(await (await call('get-session',undefined,cookie)).json(),null); assert.equal((await snapshot()).sessions,0);
 const fixture=join(tmpdir(),'sunny-auth-flow-fixture.json');
 await writeFile(fixture,JSON.stringify({baseURL:base.origin,email,password,id:created.id}),{mode:0o600});
 console.log('PASS: website Next HTTP signup -> DB -> encoded/normal email verification -> login -> DB session -> logout.');
 console.log('One synthetic EmailProof member retained for browser/DBeaver checks; private fixture in OS temp; secrets not displayed.');
} catch {
 console.error(`FAIL: local auth flow at ${phase}; secret values suppressed.`); process.exitCode=1;
} finally {await pool?.end();}
