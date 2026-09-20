import test from "node:test";
import assert from "node:assert/strict";
import { LEGAL_DOCS, PRIVACY, TERMS } from "../lib/legal.ts";

test("두 문서가 모두 있다", () => {
  assert.equal(Object.keys(LEGAL_DOCS).length, 2);
  assert.equal(LEGAL_DOCS.terms.title, "이용약관");
  assert.equal(LEGAL_DOCS.privacy.title, "개인정보 처리방침");
});

test("버전과 작성일이 있고, 초안이라고 알린다", () => {
  for (const doc of Object.values(LEGAL_DOCS)) {
    assert.match(doc.version, /^\d+\.\d+/);
    assert.match(doc.writtenAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(doc.notice.includes("초안"));
    assert.ok(doc.sections.length >= 5);
    for (const section of doc.sections) assert.ok(section.paragraphs.length >= 1);
  }
});

test("개인정보 문서는 수집 항목 · 보관 기간 · 권리를 담는다", () => {
  const headings = PRIVACY.sections.map((s) => s.heading).join(" ");
  assert.ok(headings.includes("수집하는 항목"));
  assert.ok(headings.includes("보관 기간"));
  assert.ok(headings.includes("권리"));
});

test("실제 연락처 · 학번이 들어 있지 않다", () => {
  const all = JSON.stringify(LEGAL_DOCS);
  assert.doesNotMatch(all, /01[016789][-\s]?\d{3,4}[-\s]?\d{4}/);
  assert.doesNotMatch(all, /@(gmail|naver|daum|hanmail)\./);
  assert.doesNotMatch(all, /\d{8,10}\s*학번|학번\s*\d{6,}/);
});

test("광변색을 건강 효과로 말하지 않는다", () => {
  assert.ok(TERMS.sections.some((s) => s.heading.includes("광변색")));

  // "자외선 차단"이 나오는 문장은 반드시 부인하는 문장이어야 한다
  const sentences = Object.values(LEGAL_DOCS)
    .flatMap((doc) => doc.sections.flatMap((section) => section.paragraphs))
    .flatMap((paragraph) => paragraph.split(/(?<=\.)\s+/));

  for (const sentence of sentences) {
    if (!/자외선\s*차단|건강/.test(sentence)) continue;
    assert.match(
      sentence,
      /(주장하지 않|보장하지 않|아닙니다)/,
      `효과를 약속하는 문장: ${sentence}`
    );
  }
});
