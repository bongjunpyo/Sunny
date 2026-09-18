import { expect, test } from "@playwright/test";

const firstHeading = "빛은 지나가고, 감각은 머뭅니다.";

test("스크롤 전에도 RevealText 문구가 문서에 존재한다", async ({ page }) => {
  await page.goto("/lab");

  await expect(page.getByRole("heading", { name: firstHeading })).toHaveText(
    firstHeading,
  );
});

test("문구가 화면에 들어오면 reveal 상태가 done이 된다", async ({ page }) => {
  await page.goto("/lab");
  const heading = page.getByRole("heading", { name: firstHeading });

  await heading.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 200);

  await expect(heading).toHaveAttribute("data-reveal", "done");
});

test("모션 감소 설정에서는 문구가 처음부터 보인다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/lab");
  const heading = page.getByRole("heading", { name: firstHeading });

  await expect(heading).toBeVisible();
  await expect(heading).toHaveAttribute("data-reveal", "done");
});
