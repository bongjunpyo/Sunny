import test from "node:test";
import assert from "node:assert/strict";
import { apiMode, getProduct, getProducts } from "../lib/api.ts";

test("환경변수가 없으면 mock 모드다", () => {
  delete process.env.NEXT_PUBLIC_API_MODE;
  assert.equal(apiMode(), "mock");
});

test("api 로 적어야만 api 모드다", () => {
  process.env.NEXT_PUBLIC_API_MODE = "api";
  assert.equal(apiMode(), "api");
  process.env.NEXT_PUBLIC_API_MODE = "mock";
  assert.equal(apiMode(), "mock");
});

test("mock 상품은 팔찌와 목걸이를 모두 담는다", async () => {
  process.env.NEXT_PUBLIC_API_MODE = "mock";
  const all = await getProducts();
  assert.ok(all.length >= 2);
  assert.ok(all.some((p) => p.kind === "bracelet"));
  assert.ok(all.some((p) => p.kind === "necklace"));
});

test("종류로 거르면 그 종류만 남는다", async () => {
  const necklaces = await getProducts("necklace");
  assert.ok(necklaces.every((p) => p.kind === "necklace"));
});

test("없는 slug 는 null 이다", async () => {
  assert.equal(await getProduct("없는-상품"), null);
});
