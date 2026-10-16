import { test } from "node:test";
import assert from "node:assert/strict";
import { verificationURL, authNotice, kakaoErrorNotice } from "../lib/auth-flow.ts";
const base="http://localhost:3000/api/auth/verify-email";
const token="synthetic.signed.token";
test("normal and once-encoded HTML query keep the same token and callback",()=>{
  const normal=new URL(`${base}?token=${token}&callbackURL=%2Flogin`);
  assert.equal(verificationURL(normal)?.href, normal.href);
  const encoded=new URL(base); encoded.search=encodeURIComponent(normal.search.slice(1).replaceAll("&","&amp;"));
  const nextSerialized=new URL(base); nextSerialized.search=new URLSearchParams(encoded.search).toString();
  assert.equal(verificationURL(nextSerialized)?.searchParams.get("callbackURL"),"/login");
  const fixed=verificationURL(encoded)!;
  assert.equal(fixed.searchParams.get("token"),token); assert.equal(fixed.searchParams.get("callbackURL"),"/login");
  assert.equal(verificationURL(new URL(`${base}?token=${token}&amp;callbackURL=%2Flogin`))?.searchParams.get("callbackURL"),"/login");
});
test("verification rejects duplicate fields, external callbacks, extra keys and double encoding",()=>{
  for(const query of [`token=${token}&token=${token}`,`token=${token}&callbackURL=https://evil.invalid`,
    `token=${token}&callbackURL=/login&callbackURL=/account`,`token=${token}&extra=true`,
    `token=${token}&amp;callbackURL=/login&callbackURL=/account`,"token=not-a-signed-token",
    encodeURIComponent(encodeURIComponent(`token=${token}&callbackURL=/login`))]) {
    assert.equal(verificationURL(new URL(`${base}?${query}`)),null);
  }
});
test("auth feedback uses fixed text; upstream descriptions and arbitrary query values are not displayed",()=>{
  assert.ok(authNotice("email-verified")?.includes("완료"));
  assert.equal(authNotice("<script>private data</script>"),null);
  assert.equal(authNotice("toString"),null);
  assert.equal(kakaoErrorNotice("access_denied"),"kakao-cancelled");
  assert.equal(kakaoErrorNotice("account_not_linked"),"kakao-account-exists");
  assert.equal(kakaoErrorNotice("internal_secret"),"kakao-failed");
});
