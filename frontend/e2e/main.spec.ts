import { expect, test } from "@playwright/test";

const SECTIONS = ["#top", "#story", "#collections", "#journal"];

test("메인의 모든 구간이 있다", async ({ page }) => {
  await page.goto("/");
  for (const id of SECTIONS) {
    await expect(page.locator(id)).toHaveCount(1);
  }
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Wear");
  await expect(page.getByRole("heading", { name: /Forms of light/ })).toBeVisible();
});

test("컬렉션은 팔찌와 목걸이를 함께 보여준다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Light study 01" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Light study 02" })).toBeVisible();
  await expect(page.locator("#collections")).toContainText("팔찌 컬렉션 / 기획 중");
  await expect(page.locator("#collections")).toContainText("목걸이 컬렉션 / 기획 중");
});

test("관측 자료가 없으면 없다고 말한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#journal")).toContainText("관측 자료 연결 전");
  await expect(page.locator("#journal")).toContainText("Courtesy of NASA/SDO");
});

test("가로 스크롤이 생기지 않는다", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflow).toBe(false);
});

test("키보드 첫 탭에서 컬렉션 바로가기에 닿는다", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "컬렉션으로 바로 가기" })).toBeFocused();
});
