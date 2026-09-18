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

test("이야기 구간 문구는 스크롤하면 나타난다", async ({ page }) => {
  await page.goto("/");
  const headline = page.locator("#story [data-reveal]").first();
  // 연출 전에도 글자는 문서에 있다 (검색 · 스크린리더)
  await expect(headline).toContainText("빛은 지나가고");
  await expect(headline).toHaveAttribute("data-reveal", "pending");

  await page.locator("#story").scrollIntoViewIfNeeded();
  await expect(headline).toHaveAttribute("data-reveal", "done", { timeout: 5000 });
});

test("매니페스토 제목도 같은 연출을 쓴다", async ({ page }) => {
  await page.goto("/");
  await page.locator("#manifesto-title").scrollIntoViewIfNeeded();
  await expect(page.locator("#manifesto-title [data-reveal]")).toHaveAttribute(
    "data-reveal",
    "done",
    { timeout: 5000 }
  );
});

test.describe("모션 감소 설정", () => {
  test.use({ reducedMotion: "reduce" });

  test("연출 없이 처음부터 읽힌다", async ({ page }) => {
    await page.goto("/");
    const headline = page.locator("#story [data-reveal]").first();
    await expect(headline).toHaveAttribute("data-reveal", "done", { timeout: 5000 });
    await expect(headline).toBeVisible();
  });
});

test("연출이 없어도 히어로는 그대로다", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("[data-hero-motion]");
  await expect(hero).toHaveAttribute("data-hero-motion", "pending");

  // 문구는 보이고, 덮기·도착 문구는 보이지 않는다
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const arrivalOpacity = await page.evaluate(() => {
    const el = document.querySelector("#top [class*='arrival']");
    return el ? Number(getComputedStyle(el).opacity) : -1;
  });
  expect(arrivalOpacity).toBe(0);
});
