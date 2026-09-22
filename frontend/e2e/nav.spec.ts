import { expect, test } from "@playwright/test";

const PAGES = ["/", "/collection", "/custom", "/archive", "/about", "/login"];

test("어느 페이지에서든 머리말로 다른 페이지에 갈 수 있다", async ({ page, isMobile }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "주 메뉴" }).getByRole("link", { name: "Custom" }).click();
  await expect(page).toHaveURL(/\/custom$/);

  await page.getByRole("navigation", { name: "주 메뉴" }).getByRole("link", { name: "Collections" }).click();
  await expect(page).toHaveURL(/\/collection$/);

  if (!isMobile) {
    await page.getByRole("link", { name: "Our Story" }).click();
    await expect(page).toHaveURL(/\/about$/);
    await page.getByRole("link", { name: "Archive" }).click();
    await expect(page).toHaveURL(/\/archive$/);
  }
});

test("푸터에서 모든 페이지로 갈 수 있다", async ({ page }) => {
  await page.goto("/collection");
  const sitemap = page.getByRole("navigation", { name: "페이지 목록" });
  for (const name of ["컬렉션", "커스텀", "제작 기록", "브랜드 소개", "로그인"]) {
    await expect(sitemap.getByRole("link", { name })).toBeVisible();
  }
  await sitemap.getByRole("link", { name: "제작 기록" }).click();
  await expect(page).toHaveURL(/\/archive$/);
});

test("좁은 화면에서 머리말이 한 줄에 들어간다", async ({ page, viewport }) => {
  test.skip(!viewport || viewport.width > 620, "좁은 화면 전용");
  await page.goto("/");
  const header = await page.locator("header").boundingBox();
  // 한 줄이면 머리말 높이가 90px 을 넘지 않는다
  expect(header!.height).toBeLessThan(90);
});

test("모든 페이지에 머리말과 푸터가 있다", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.getByRole("navigation", { name: "주 메뉴" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "페이지 목록" })).toHaveCount(1);
  }
});

test("어느 페이지에서든 로고를 누르면 메인 맨 위로 간다", async ({ page }) => {
  for (const path of ["/collection", "/collection/light-study-01", "/custom", "/archive", "/about"]) {
    await page.goto(path);
    // 아래까지 내려간 상태에서 눌러도 맨 위로 가야 한다
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await page.getByRole("link", { name: "SUNNY 메인으로" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Wear");
    await expect.poll(() => page.evaluate(() => Math.round(scrollY)), { timeout: 4000 }).toBe(0);
  }
});

test("메인에서 로고를 누르면 맨 위로 올라간다", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => scrollTo(0, 2500));
  await page.waitForTimeout(300);
  await page.getByRole("link", { name: "SUNNY 메인으로" }).click();
  await expect.poll(() => page.evaluate(() => Math.round(scrollY)), { timeout: 4000 }).toBe(0);
});
