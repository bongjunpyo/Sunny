import test from "node:test";
import assert from "node:assert/strict";
import { SUN_START_X, sunTransform } from "../components/scene/sunTransform.ts";

test("시작에는 오른쪽에 있고 배율이 1이다", () => {
  assert.equal(sunTransform(0).xPercent, SUN_START_X.desktop);
  assert.equal(sunTransform(0).scale, 1);
  assert.equal(sunTransform(0, true).xPercent, SUN_START_X.mobile);
});

test("0.38 을 지나면 가운데에 선다", () => {
  assert.equal(sunTransform(0.38).xPercent, 50);
  assert.equal(sunTransform(1).xPercent, 50);
});

test("가운데로 오는 동안 배율은 1 이다", () => {
  assert.equal(sunTransform(0.3).scale, 1);
});

test("끝에서 7배까지 커진다", () => {
  // 부동소수점 오차가 있어 자릿수를 정해 비교한다
  assert.ok(Math.abs(sunTransform(0.82).scale - 7) < 1e-9);
  assert.ok(Math.abs(sunTransform(1).scale - 7) < 1e-9);
});

test("범위를 벗어난 값도 안전하다", () => {
  assert.equal(sunTransform(-5).xPercent, SUN_START_X.desktop);
  assert.ok(Math.abs(sunTransform(9).scale - 7) < 1e-9);
});
