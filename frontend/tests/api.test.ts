import test from "node:test";
import assert from "node:assert/strict";
import { apiMode, getProduct, getProducts, getStories, getStory } from "../lib/api.ts";
import { COLOR_HEX } from "../lib/colors.ts";
import { PHOTOCHROMIC_COLORS } from "../lib/types.ts";

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

test("상세에 쓸 이야기와 반응색이 모두 있다", async () => {
  const all = await getProducts();
  for (const product of all) {
    assert.ok(product.story.length >= 1, `${product.slug} 이야기 없음`);
    assert.ok(product.colors.length >= 1, `${product.slug} 반응색 없음`);
    assert.equal(product.status, "planning");
  }
});

test("slug 는 겹치지 않는다", async () => {
  const all = await getProducts();
  assert.equal(new Set(all.map((p) => p.slug)).size, all.length);
});

test("기록은 최신 순서로 나온다", async () => {
  const stories = await getStories();
  assert.ok(stories.length >= 1);
  for (let i = 1; i < stories.length; i += 1) {
    assert.ok(stories[i - 1].order > stories[i].order);
  }
});

test("발색 시험 기록은 조건 세 가지를 모두 갖거나 아예 없다", async () => {
  for (const story of await getStories()) {
    if (!story.test) continue;
    assert.ok(story.test.concentration && story.test.exposure && story.test.weather);
  }
});

test("없는 기록은 null 이다", async () => {
  assert.equal(await getStory("없는-기록"), null);
});

test("반응색 다섯 가지 모두 색값이 있다", () => {
  for (const color of PHOTOCHROMIC_COLORS) {
    assert.match(COLOR_HEX[color], /^#[0-9a-f]{6}$/i);
  }
});
