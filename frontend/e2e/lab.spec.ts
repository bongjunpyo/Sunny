import { expect, test } from "@playwright/test";

test("연습 화면이 열리고 문구가 읽힌다", async ({ page }) => {
  await page.goto("/lab");
  await expect(page.getByRole("heading", { name: "빛은 지나가고, 감각은 머뭅니다." })).toBeVisible();
  await expect(page.getByText("창가를 가로지르는 오후의 빛")).toBeVisible();
});

test("연습 화면에서 가로 스크롤이 생기지 않는다", async ({ page }) => {
  await page.goto("/lab");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflow).toBe(false);
});
