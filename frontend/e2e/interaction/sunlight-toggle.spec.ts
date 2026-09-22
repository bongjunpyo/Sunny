import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "no-preference", video: "on" });

test.beforeEach(async ({ page }) => {
  await page.goto("/collection/light-study-01");
  await page.locator("[data-lit]").scrollIntoViewIfNeeded();
});

test("처음에는 실내 모습이고 버튼이 꺼져 있다", async ({ page }) => {
  const toggle = page.locator("[data-lit]");
  await expect(toggle).toHaveAttribute("data-lit", "off");
  await expect(toggle.getByRole("button", { name: "햇빛 비추기", exact: true }))
    .toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toContainText("연출입니다. 실제 발색 속도·색과 다릅니다.");
  await expect(toggle.locator('[class*="indoor"]')).toHaveCSS("opacity", "1");
});

test("햇빛이 서서히 들어오고 완료 후 버튼이 바뀐다", async ({ page }) => {
  const toggle = page.locator("[data-lit]");
  const button = toggle.getByRole("button");
  await button.click({ timeout: 5000 });
  await expect(toggle).toHaveAttribute("data-lit", "off");
  await expect.poll(() => toggle.locator('[class*="indoor"]').evaluate(
    (element) => Number(getComputedStyle(element).opacity) > 0 &&
      Number(getComputedStyle(element).opacity) < 1,
  )).toBe(true);
  await expect(toggle).toHaveAttribute("data-lit", "on", { timeout: 5000 });
  await expect(toggle.locator('[class*="indoor"]')).toHaveCSS("opacity", "0");
  await expect(button).toHaveText("그늘로 돌아가기");
  await expect(button).toHaveAttribute("aria-pressed", "true");
});

test("다시 누르면 더 천천히 실내로 돌아온다", async ({ page }, testInfo) => {
  const toggle = page.locator("[data-lit]");
  const button = toggle.getByRole("button");
  await button.click({ timeout: 5000 });
  await expect(toggle).toHaveAttribute("data-lit", "on", { timeout: 5000 });
  await toggle.screenshot({ path: testInfo.outputPath("sunlight.png") });
  await button.click();
  await expect(toggle).toHaveAttribute("data-lit", "on");
  await expect(toggle).toHaveAttribute("data-lit", "off", { timeout: 7000 });
  await expect(button).toHaveText("햇빛 비추기");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(toggle.locator('[class*="indoor"]')).toHaveCSS("opacity", "1");
  await toggle.screenshot({ path: testInfo.outputPath("indoor.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("모션 감소에서는 양방향 모두 즉시 바뀐다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const toggle = page.locator("[data-lit]");
  const button = toggle.getByRole("button");
  await expect(button).toBeEnabled();
  for (const lit of ["on", "off"]) {
    const result = await button.evaluate(async (element) => {
      (element as HTMLButtonElement).click();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      return element.closest("[data-lit]")?.getAttribute("data-lit");
    });
    expect(result).toBe(lit);
    await expect(button).toHaveAttribute("aria-pressed", String(lit === "on"));
    await expect(toggle.locator('[class*="indoor"]')).toHaveCSS("opacity", lit === "on" ? "0" : "1");
    await expect(toggle.locator('[class*="stage"] > div').last()).toHaveCSS("opacity", "0");
  }
});
