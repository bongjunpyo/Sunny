import { expect, test } from "@playwright/test";

test("메인 페이지가 열리고 브랜드 문구가 보인다", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/SUNNY/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Wear");
});

test("가로 스크롤이 생기지 않는다", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflow).toBe(false);
});
