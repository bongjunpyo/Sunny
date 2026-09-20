import { expect, test } from "@playwright/test";

test("기록 목록에 첫 기록이 있다", async ({ page }) => {
  await page.goto("/archive");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("빛을 입는 기록");
  await expect(page.getByRole("heading", { name: "바다가 빛을 입다" })).toBeVisible();
  await expect(page.getByText("윤슬", { exact: true })).toBeVisible();
  await expect(page.getByText(/코드로 그린 분위기 시안/)).toBeVisible();
});

test("목록에서 기록 상세로 간다", async ({ page }) => {
  await page.goto("/archive");
  await page.getByRole("heading", { name: "바다가 빛을 입다" }).click();
  await expect(page).toHaveURL(/\/archive\/sea-yunseul$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("바다가 빛을 입다");
});

test("발색 시험이 없으면 조건과 함께 적는다고 알린다", async ({ page }) => {
  await page.goto("/archive/sea-yunseul");
  const test = page.getByRole("heading", { name: "발색 시험 기록" }).locator("..");
  await expect(test).toContainText("농도");
  await expect(test).toContainText("노출 시간");
  await expect(test).toContainText("날씨");
});

test("없는 기록은 404 다", async ({ page }) => {
  const res = await page.goto("/archive/없는-기록");
  expect(res?.status()).toBe(404);
});

test("기록 화면에 가로 스크롤이 없다", async ({ page }) => {
  for (const path of ["/archive", "/archive/sea-yunseul"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  }
});
