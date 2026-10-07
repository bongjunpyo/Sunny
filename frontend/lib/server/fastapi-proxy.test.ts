import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Next의 서버 전용 마커를 테스트 런타임에서도 같은 빈 모듈로 해석한다.
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === "server-only"
      ? "next/dist/compiled/server-only/empty.js" : specifier, context);
  },
});
const { proxyFastApi } = await import("./fastapi-proxy.ts");

test("미설정·잘못된 원점은 네트워크 호출 없이 실패한다", async (t) => {
  const network = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("호출하면 안 됨");
  });
  for (const value of [undefined, "not-a-url", "https://api.example.com/api", "https://user:secret@api.example.com"]) {
    if (value === undefined) delete process.env.FASTAPI_URL;
    else process.env.FASTAPI_URL = value;
    const response = await proxyFastApi(new Request("https://sunny.example/api/health"));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "API_NOT_CONFIGURED");
  }
  assert.equal(network.mock.callCount(), 0);
});

test("POST 본문·쿼리·쿠키와 실패 응답·복수 Set-Cookie를 보존한다", async (t) => {
  process.env.FASTAPI_URL = "https://api.example.com";
  const body = JSON.stringify({ nickname: "test" });
  t.mock.method(globalThis, "fetch", async (url: URL, init: RequestInit) => {
    assert.equal(url.href, "https://api.example.com/api/auth/session?next=%2Faccount");
    assert.equal(init.method, "POST");
    assert.equal(new TextDecoder().decode(init.body as ArrayBuffer), body);
    const headers = new Headers(init.headers);
    assert.equal(headers.get("cookie"), "session=test");
    assert.equal(headers.get("origin"), "https://sunny.example");
    assert.equal(headers.get("x-forwarded-host"), null);
    assert.equal(headers.get("host"), null);
    assert.equal(headers.get("x-remove"), null);
    assert.equal(init.redirect, "manual");
    assert.equal(init.cache, "no-store");
    const outgoing = new Headers({ "content-type": "application/json" });
    outgoing.append("set-cookie", "access=a; HttpOnly; Path=/; Secure");
    outgoing.append("set-cookie", "refresh=r; HttpOnly; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT");
    return new Response('{"error":{"code":"UNAUTHORIZED"}}', { status: 401, headers: outgoing });
  });
  const response = await proxyFastApi(new Request("https://sunny.example/api/auth/session?next=%2Faccount", {
    method: "POST", body,
    headers: {
      cookie: "session=test", origin: "https://sunny.example", host: "spoof.example",
      "x-forwarded-host": "spoof.example", connection: "x-remove", "x-remove": "spoof",
    },
  }));
  assert.equal(response.status, 401);
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.match(response.headers.getSetCookie()[1], /Expires=Wed, 21 Oct/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error.code, "UNAUTHORIZED");
});

test("백엔드 리다이렉트는 브라우저의 동일 출처 경로로 돌아온다", async (t) => {
  process.env.FASTAPI_URL = "https://api.example.com";
  t.mock.method(globalThis, "fetch", async () => new Response(null, {
    status: 307, headers: { location: "https://api.example.com/api/auth/callback?code=test" },
  }));
  const response = await proxyFastApi(new Request("https://sunny.example/api/auth/start"));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/api/auth/callback?code=test");
});

test("HEAD·204는 응답 본문이 없고 외부 OAuth 리다이렉트는 유지한다", async (t) => {
  process.env.FASTAPI_URL = "https://api.example.com";
  const network = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));
  const response = await proxyFastApi(new Request("https://sunny.example/api/health", { method: "HEAD" }));
  assert.equal(response.status, 204);
  assert.equal(response.body, null);
  network.mock.mockImplementation(async () => new Response(null, {
    status: 302, headers: { location: "https://accounts.example/authorize?state=test" },
  }));
  const redirect = await proxyFastApi(new Request("https://sunny.example/api/auth/start"));
  assert.equal(redirect.headers.get("location"), "https://accounts.example/authorize?state=test");
});

test("연결 실패의 상세 오류나 서버 주소를 사용자 응답에 노출하지 않는다", async (t) => {
  process.env.FASTAPI_URL = "https://api.example.com";
  t.mock.method(globalThis, "fetch", async () => { throw new Error("sensitive internal error"); });
  const response = await proxyFastApi(new Request("https://sunny.example/api/health"));
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.equal(JSON.parse(body).error.code, "API_UNAVAILABLE");
  assert.ok(!body.includes("sensitive") && !body.includes("api.example.com"));
});

test("운영에서는 localhost HTTP 대상을 허용하지 않는다", async () => {
  const environment: Record<string, string | undefined> = process.env;
  const old = environment.NODE_ENV;
  environment.NODE_ENV = "production";
  process.env.FASTAPI_URL = "http://127.0.0.1:8000";
  try {
    const response = await proxyFastApi(new Request("https://sunny.example/api/health"));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "API_NOT_CONFIGURED");
  } finally {
    if (old === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = old;
  }
});
