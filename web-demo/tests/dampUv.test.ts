// 실행: node --test tests/dampUv.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { dampUv } from "../lib/bead.ts";

test("시간 차(dt)가 음수여도 값이 현재값과 목표값 사이를 벗어나지 않는다", () => {
  // 실제로 관측된 첫 프레임: rawDt = -5.318, 현재 8 → 목표 0 에서 958.55로 튀었음
  const next = dampUv(8, 0, -5.318);
  assert.ok(next >= 0 && next <= 8, `got ${next}`);
});

test("dt가 양수면 목표값 쪽으로 다가간다", () => {
  const next = dampUv(8, 0, 0.05);
  assert.ok(next < 8 && next > 0, `got ${next}`);
});

test("발색(올라갈 때)이 복귀(내려갈 때)보다 빠르다", () => {
  const up = dampUv(0, 10, 0.5) - 0;
  const down = 10 - dampUv(10, 0, 0.5);
  assert.ok(up > down, `up ${up} / down ${down}`);
});
