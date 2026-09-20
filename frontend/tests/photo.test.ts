import test from "node:test";
import assert from "node:assert/strict";
import { PHOTO_RULES, checkPhotoFile, checkPhotoSize, describeRules, formatBytes } from "../lib/photo.ts";

const ok = { type: "image/jpeg", size: 2 * 1024 * 1024, name: "photo.jpg" };

test("맞는 파일은 통과한다", () => {
  assert.equal(checkPhotoFile(ok), null);
});

test("형식이 다르면 알려준다", () => {
  const message = checkPhotoFile({ ...ok, type: "image/svg+xml", name: "a.svg" });
  assert.ok(message?.includes("형식만"));
});

test("너무 크거나 빈 파일을 막는다", () => {
  assert.ok(checkPhotoFile({ ...ok, size: PHOTO_RULES.maxBytes + 1 }));
  assert.ok(checkPhotoFile({ ...ok, size: 0 }));
});

test("해상도가 모자라면 지금 크기까지 알려준다", () => {
  assert.equal(checkPhotoSize(1200, 1600), null);
  const message = checkPhotoSize(640, 480);
  assert.ok(message?.includes("640×480"));
});

test("규칙 설명과 용량 표기", () => {
  assert.equal(formatBytes(10 * 1024 * 1024), "10MB");
  assert.ok(describeRules().includes("JPEG"));
  assert.ok(describeRules().includes("1000×1000"));
});

test("규격은 아직 임시값이라고 표시한다", () => {
  assert.equal(PHOTO_RULES.provisional, true);
});
