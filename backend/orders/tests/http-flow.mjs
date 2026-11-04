// Owned disposable PG and synthetic HTTP fixtures only. Optional CLI visual check.
import assert from "node:assert/strict";
import { readFile, open, writeFile, rm, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("../../../",import.meta.url));
const config=JSON.parse(await readFile(process.env.SUNNY_ORDER_TEST_CONFIG,"utf8"));
assert.match(config.container,/^sunny-order-test-[a-f0-9]{12}$/);assert.notEqual(config.port,5434);
const socket=net.createServer();await new Promise(r=>socket.listen(0,"127.0.0.1",r));
const port=socket.address().port;await new Promise(r=>socket.close(r));const base=`http://127.0.0.1:${port}`;
const log=await open(path.join(config.privateDirectory,"next.log"),"w",0o600);
const env={...process.env,AUTH_ENABLED:"true",ORDER_DEMO_ENABLED:"true",BETTER_AUTH_URL:base,
  BETTER_AUTH_SECRET:randomBytes(48).toString("base64url"),AUTH_DATABASE_URL:config.auth,DATABASE_URL:config.app,
  NEXT_PUBLIC_API_MODE:"mock",NEXT_TELEMETRY_DISABLED:"1",RESEND_API_KEY:"",KAKAO_CLIENT_ID:"",KAKAO_CLIENT_SECRET:"",
  AUTH_DEV_LOCAL_MAIL:"false",PHOTO_UPLOAD_ENABLED:"false"};
const child=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--hostname","127.0.0.1","--port",String(port)],
  {cwd:path.join(root,"frontend"),env,stdio:["ignore",log.fd,log.fd]});
let jar="";
const readyFile=process.env.SUNNY_ORDER_UI_STATE??"/private/tmp/sunny-orders-ui-ready-20261103.json";
const releaseFile=path.join(config.privateDirectory,"ui-finished");
async function request(route,body,key,authenticated=true){
  const r=await fetch(base+route,{method:body?"POST":"GET",headers:{...(body?{origin:base,"content-type":"application/json"}:{}),
    ...(key?{"Idempotency-Key":key}:{}),...(authenticated&&jar?{cookie:jar}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const cookies=r.headers.getSetCookie();if(authenticated&&cookies.length)jar=cookies.map(c=>c.split(";",1)[0]).join("; ");
  return r;
}
try{
  let ready=false;
  for(let i=0;i<120;i++){
    if(child.exitCode!==null)throw new Error("Isolated Next server stopped");
    try{const r=await fetch(base+"/api/orders");if(r.status===401){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,300));
  }
  assert.ok(ready,"Isolated Next server did not become ready");
  let r=await request("/api/auth/sign-in/anonymous",{});assert.equal(r.status,200);
  const input={items:[{productSlug:"light-study-01",productKind:"bracelet",color:"mixed",lengthCm:18,quantity:2,
    beadLayout:{squareCount:7,beads:Array.from({length:7},(_,index)=>({index,photoAssetId:null}))},previewConfirmed:true},
    {productSlug:"light-study-02",productKind:"necklace",color:"blue",lengthCm:45,quantity:1,beadLayout:{moonCount:1,roundCount:2},previewConfirmed:true}]};
  // Confirmation is synthetic input; this does not verify a 3D scene.
  const key=randomUUID();r=await request("/api/orders",input,key);assert.equal(r.status,201);
  const d=await r.json();assert.equal(d.order.status,"REQUESTED");assert.equal(d.order.items[0].color,"mixed");
  const invalid=structuredClone(input);invalid.items[1].color="mixed";assert.equal((await request("/api/orders",invalid,randomUUID())).status,400);
  r=await request("/api/orders",input,key);assert.equal(r.status,200);assert.equal((await r.json()).order.orderId,d.order.orderId);
  assert.equal((await request(`/api/orders/${d.order.orderId}`,undefined,undefined,false)).status,401);
  r=await request("/api/orders");assert.equal(r.status,200);assert.equal((await r.json()).items.length,1);
  r=await request(`/api/orders/${d.order.orderId}`);assert.equal(r.status,200);assert.equal((await r.json()).order.items[0].beadLayout.beads.length,7);
  if(process.env.SUNNY_ORDER_UI_HOLD==="1"){
    await writeFile(readyFile,JSON.stringify({base,releaseFile}),{mode:0o600});
    console.log(`UI_READY ${base} — isolated synthetic context; no cookies printed.`);
    let released=false;
    for(let i=0;i<1200;i++){try{await access(releaseFile);released=true;break;}catch{}await new Promise(r=>setTimeout(r,500));}
    assert.ok(released,"CLI visual check timed out");
  }
  r=await request("/api/auth/sign-out",{});assert.equal(r.status,200);
  assert.equal((await request(`/api/orders/${d.order.orderId}`)).status,401);
  console.log("PASS: live Next HTTP guest -> create/replay -> own list/detail -> logout, no external services.");
}finally{
  await rm(readyFile,{force:true});
  if(child.exitCode===null){child.kill("SIGTERM");await new Promise(resolve=>{child.once("exit",resolve);setTimeout(()=>{child.kill("SIGKILL");resolve();},5000).unref();});}
  await log.close();
}
