// 컨테이너 안에서 실행하는 연기 테스트. 화면 경로·정적 자산·옛 주소·API 존재 여부만 본다.
// 외부 서비스(DB·메일·R2)는 부르지 않는다. 인증 API는 설정이 없으면 503이 정상이다.
const base = process.argv[2] ?? "http://127.0.0.1:3000";
const pages = ["/", "/about", "/collection", "/collection/light-study-01", "/collection/light-study-02",
  "/custom", "/archive", "/archive/sea", "/login", "/signup", "/account", "/cart", "/checkout", "/orders"];
const assets = ["/images/sunny/journal-leaves.png", "/images/sunny/journal-curtain.png",
  "/images/sunny/wrist-sunlight.png", "/videos/sunny-brand-three-scenes.mp4"];
const fail = (m) => { throw new Error(m); };

for (const path of pages) {
  const r = await fetch(base + path);
  if (r.status !== 200) fail(`${path} ${r.status}`);
  const html = await r.text();
  if (!html.includes("sunny") || !html.includes("<h1")) fail(`invalid page ${path}`);
  console.log(`${path} 200`);
}
for (const path of assets) {
  const r = await fetch(base + path, { method: "HEAD" });
  if (r.status !== 200) fail(`missing asset ${path} ${r.status}`);
}
const legacy = await fetch(base + "/archive/sea-yunseul", { redirect: "manual" });
if (![307, 308].includes(legacy.status)) fail(`legacy journal URL ${legacy.status}`);
const session = await fetch(base + "/api/auth/get-session", { headers: { Origin: "http://127.0.0.1:3000" } });
if (![200, 503].includes(session.status)) fail(`auth route ${session.status} (404 = 옛 이미지)`);
const missing = await fetch(base + "/this-page-does-not-exist");
if (missing.status !== 404) fail(`404 page ${missing.status}`);
console.log(`pages, assets, legacy redirect, auth route (${session.status}) passed`);
