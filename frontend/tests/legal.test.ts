import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTACT_EMAIL,
  LEGAL_DOCS,
  LEGAL_EFFECTIVE_AT,
  LEGAL_VERSION,
  PRIVACY,
  TERMS,
} from "../lib/legal.ts";

const allText = () =>
  Object.values(LEGAL_DOCS)
    .flatMap((doc) => [doc.notice, ...doc.sections.flatMap((s) => [s.heading, ...s.paragraphs])])
    .join("\n");

test("두 문서가 모두 있다", () => {
  assert.equal(Object.keys(LEGAL_DOCS).length, 2);
  assert.equal(LEGAL_DOCS.terms.title, "이용약관");
  assert.equal(LEGAL_DOCS.privacy.title, "개인정보 처리방침");
});

test("정식 버전 1.x 이고 시행일이 있으며, 초안 표시가 없다", () => {
  assert.match(LEGAL_VERSION, /^1\.\d+$/);
  assert.match(LEGAL_EFFECTIVE_AT, /^\d{4}-\d{2}-\d{2}$/);
  for (const doc of Object.values(LEGAL_DOCS)) {
    assert.equal(doc.version, LEGAL_VERSION);
    assert.equal(doc.effectiveAt, LEGAL_EFFECTIVE_AT);
    assert.match(doc.writtenAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(doc.writtenAt <= doc.effectiveAt, "작성일은 시행일보다 늦을 수 없다");
    assert.ok(!doc.notice.includes("초안"));
    assert.ok(doc.sections.length >= 5);
    for (const section of doc.sections) assert.ok(section.paragraphs.length >= 1);
    assert.ok(doc.sections.at(-1)?.heading === "부칙");
  }
  // "확정 뒤 적는다" 류의 빈 자리가 남아 있으면 안 된다
  assert.doesNotMatch(allText(), /확정(된|한)? (뒤|후)|이 자리에 적|미정|초안/);
});

test("개인정보 문서는 법이 요구하는 항목을 담는다", () => {
  const headings = PRIVACY.sections.map((s) => s.heading).join(" ");
  for (const required of [
    "수집하는 항목",
    "목적",
    "보관 기간",
    "제3자 제공",
    "처리 위탁",
    "국외 이전",
    "파기",
    "권리",
    "안전 조치",
    "쿠키",
    "보호책임자",
    "변경",
  ]) {
    assert.ok(headings.includes(required), `빠진 항목: ${required}`);
  }
});

test("실제로 저장하는 것과 문서가 맞는다", () => {
  const text = allText();
  // auth.session 에 IP · 브라우저 정보가 남는다
  assert.match(text, /IP 주소/);
  assert.match(text, /브라우저 정보/);
  // 시연용 주문 — 받는 사람 · 주소 · 결제 정보는 받지 않는다
  assert.match(text, /받는 사람 이름·연락처·주소·결제 정보는 수집하지 않습니다/);
  // 카카오 · 게스트 · EXIF 제거
  assert.match(text, /카카오/);
  assert.match(text, /게스트/);
  assert.match(text, /EXIF/);
  // 보관 기간 숫자
  assert.match(text, /7일 이내에 파기/);
  assert.match(text, /90일/);
  assert.match(text, /3개월/);
});

test("책임자 · 고충처리 · 문의처가 있고, 연락처는 팀 공용 메일 하나다", () => {
  const text = allText();
  assert.match(text, /개인정보 보호책임자: 봉준표/);
  assert.match(text, /고충처리/);
  assert.ok(text.includes(CONTACT_EMAIL));
  assert.match(CONTACT_EMAIL, /@mail\.stdrd\.store$/);
  assert.ok(TERMS.sections.some((s) => s.heading.includes("문의")));
});

test("개인 전화번호 · 개인 메일 · 학번이 들어 있지 않다", () => {
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

test("실제 결제 · 판매를 하지 않는다고 밝힌다", () => {
  assert.match(TERMS.notice, /실제 결제·판매·배송을 하지 않습니다/);
  assert.match(allText(), /시연용/);
});
