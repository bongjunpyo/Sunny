import test from "node:test";
import assert from "node:assert/strict";
import {
  validateEmail,
  validateNickname,
  validatePassword,
  validateRequiredTerms,
} from "../lib/validate.ts";

test("이메일 형태를 본다", () => {
  assert.equal(validateEmail("demo@example.com"), null);
  assert.ok(validateEmail(""));
  assert.ok(validateEmail("demo@"));
  assert.ok(validateEmail("demo example.com"));
});

test("비밀번호는 8자 이상 영문+숫자", () => {
  assert.equal(validatePassword("sunny2026"), null);
  assert.ok(validatePassword("short1"));
  assert.ok(validatePassword("onlyletters"));
  assert.ok(validatePassword("12345678"));
});

test("별명은 2~12자, 허용 문자만", () => {
  assert.equal(validateNickname("수희"), null);
  assert.equal(validateNickname("sunny_01"), null);
  assert.ok(validateNickname("가"));
  assert.ok(validateNickname("가".repeat(13)));
  assert.ok(validateNickname("별명!"));
});

test("필수 약관은 동의해야 한다", () => {
  assert.equal(validateRequiredTerms(true), null);
  assert.ok(validateRequiredTerms(false));
});
