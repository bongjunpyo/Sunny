 import { expect, test } from "@playwright/test";

  test("처음에는 히어로 문구가 보인다", async ({ page }) => {
    await page.goto("/");

    const hero = page.locator("[data-hero-motion]");

    await expect(hero).toHaveAttribute("data-hero-motion", "on");
    await expect(hero).toHaveCSS("--copy-opacity", "1");
  });

  test("절반쯤 내리면 태양이 화면 가운데로 온다", async ({ page }) => {
    await page.goto("/");

    const hero = page.locator("[data-hero-motion]");
    await expect(hero).toHaveAttribute("data-hero-motion", "on");

    await hero.evaluate((element) => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      const distance = element.scrollHeight - window.innerHeight;

      window.scrollTo(0, top + distance * 0.5);
    });

    await expect
      .poll(async () => {
        const value = await hero.evaluate((element) =>
          getComputedStyle(element).getPropertyValue("--sun-x"),
        );

        return Number(value.replace("%", "").trim());
      })
      .toBeCloseTo(50, 0);
  });

  test("끝까지 내리면 종이색 화면이 덮인다", async ({ page }) => {
    await page.goto("/");

    const hero = page.locator("[data-hero-motion]");
    await expect(hero).toHaveAttribute("data-hero-motion", "on");

    await hero.evaluate((element) => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      const distance = element.scrollHeight - window.innerHeight;

      window.scrollTo(0, top + distance);
    });

    await expect
      .poll(async () => {
        const value = await hero.evaluate((element) =>
          getComputedStyle(element).getPropertyValue("--wash-opacity"),
        );

        return Number(value.trim());
      })
      .toBeCloseTo(1, 1);
  });

  test("모션 감소 설정에서는 정지 화면과 문구를 유지한다", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const hero = page.locator("[data-hero-motion]");

    await expect(hero).toHaveAttribute("data-hero-motion", "pending");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });