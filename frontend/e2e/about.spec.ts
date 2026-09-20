import { expect, test } from "@playwright/test";

test("브랜드 소개의 구간이 모두 있다", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("빛에 따라 드러나는");
  for (const heading of ["태양에서 시작했다", "광변색이란", "만드는 방식", "약속", "팀"]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("광변색을 조건과 함께 설명하고 효과를 약속하지 않는다", async ({ page }) => {
  await page.goto("/about");
  const body = page.locator("main");
  await expect(body).toContainText("햇빛(자외선)에 반응해 색이 변합니다");
  await expect(body).toContainText("농도 · 노출 시간 · 날씨");
  await expect(body).toContainText("자외선을 막아 주거나 건강에 도움을 주지 않습니다");
});

test("제작 단계 여섯 개가 순서대로 있다", async ({ page }) => {
  await page.goto("/about");
  const steps = page.locator("main li", { hasText: /^0\d /});
  await expect(steps).toHaveCount(6);
  await expect(steps.first()).toContainText("모델링");
  await expect(steps.last()).toContainText("조립");
});

test("개인 연락처나 학번이 없다", async ({ page }) => {
  await page.goto("/about");
  const text = (await page.locator("body").innerText()).replace(/\s/g, "");
  expect(text).not.toMatch(/01[016789]\d{7,8}/);
  expect(text).not.toMatch(/학번/);
  expect(text).not.toMatch(/@(gmail|naver|daum)\./);
});

test("기록으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("link", { name: /빛을 입는 기록 보기/ }).click();
  await expect(page).toHaveURL(/\/archive$/);
});

test("소개 화면에 가로 스크롤이 없다", async ({ page }) => {
  await page.goto("/about");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflow).toBe(false);
});
