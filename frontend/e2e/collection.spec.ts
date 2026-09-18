import { expect, test } from "@playwright/test";

test("컬렉션 목록에 팔찌와 목걸이가 모두 있다", async ({ page }) => {
  await page.goto("/collection");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Forms of light");
  await expect(page.getByRole("heading", { name: "Light study 01" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Light study 02" })).toBeVisible();
});

test("종류로 거를 수 있다", async ({ page }) => {
  await page.goto("/collection?kind=necklace");
  await expect(page.getByRole("heading", { name: "Light study 02" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Light study 01" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "목걸이", exact: true })).toHaveAttribute(
    "aria-current",
    "true"
  );
});

test("목록에서 상세로 간다", async ({ page }) => {
  await page.goto("/collection");
  await page.getByRole("heading", { name: "Light study 01" }).click();
  await expect(page).toHaveURL(/\/collection\/light-study-01$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Light study 01");
});

test("상세에 반응색과 발색 비교 자리가 있다", async ({ page }) => {
  await page.goto("/collection/light-study-01");
  await expect(page.getByText("보라", { exact: true })).toBeVisible();
  await expect(page.getByText("색이 드러나는 정도는 농도")).toBeVisible();
  await expect(page.getByRole("heading", { name: "실내 / 햇빛 비교" })).toBeVisible();
  // 광변색 주장 범위를 넘지 않는다
  await expect(page.locator("body")).not.toContainText("자외선 차단");
});

test("없는 제품은 404 다", async ({ page }) => {
  const res = await page.goto("/collection/없는-제품");
  expect(res?.status()).toBe(404);
});

test("컬렉션 화면에 가로 스크롤이 없다", async ({ page }) => {
  for (const path of ["/collection", "/collection/light-study-02"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  }
});
