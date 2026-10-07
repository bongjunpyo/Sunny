import "server-only";

const HOP_HEADERS = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade", "host", "content-length",
]);

function copyHeaders(source: Headers): Headers {
  const excluded = new Set(HOP_HEADERS);
  for (const name of (source.get("connection") ?? "").split(",")) {
    excluded.add(name.trim().toLowerCase());
  }
  const headers = new Headers();
  source.forEach((value, name) => {
    if (!excluded.has(name) && name !== "set-cookie") headers.set(name, value);
  });
  for (const cookie of source.getSetCookie()) headers.append("set-cookie", cookie);
  return headers;
}

function unavailable(code: string, message: string): Response {
  return Response.json({ error: { code, message } }, {
    status: 503, headers: { "cache-control": "no-store" },
  });
}

export async function proxyFastApi(request: Request): Promise<Response> {
  const configured = process.env.FASTAPI_URL;
  if (!configured) {
    return unavailable("API_NOT_CONFIGURED", "서버 API 연결이 설정되지 않았습니다.");
  }

  let origin: URL;
  try {
    origin = new URL(configured);
    const localHttp = origin.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) &&
      process.env.NODE_ENV !== "production";
    if ((origin.protocol !== "https:" && !localHttp) || origin.username ||
        origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
      throw new Error("Invalid API origin");
    }
  } catch {
    return unavailable("API_NOT_CONFIGURED", "서버 API 연결 설정을 확인해 주세요.");
  }

  const incoming = new URL(request.url);
  const target = new URL(origin.origin);
  // 문자열을 상대 URL로 해석하지 않아 요청 경로가 원점을 바꾸지 못한다.
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const headers = copyHeaders(request.headers);
  for (const name of [...headers.keys()]) {
    if (name === "forwarded" || name === "x-real-ip" || name.startsWith("x-forwarded-")) headers.delete(name);
  }
  // fetch가 압축 응답을 해제하므로 인코딩을 직접 협상하지 않는다.
  headers.set("accept-encoding", "identity");

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
    });
    const outgoing = copyHeaders(response.headers);
    outgoing.delete("content-encoding");
    // 인증 쿠키를 포함하는 응답이 공유 캐시에 들어가지 않도록 한다.
    outgoing.set("cache-control", "no-store");
    const location = outgoing.get("location");
    if (location) {
      const redirect = new URL(location, target);
      if (redirect.origin === target.origin) {
        outgoing.set("location", `${redirect.pathname}${redirect.search}${redirect.hash}`);
      }
    }
    return new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outgoing,
    });
  } catch {
    return unavailable("API_UNAVAILABLE", "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }
}
