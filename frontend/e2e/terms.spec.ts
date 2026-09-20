import { expect, test } from "@playwright/test";

test("가입 화면에서 약관 이름을 누르면 그 자리에서 열린다", async ({ page }) => {
  await page.goto("/signup");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeHidden();

  await page.locator("form").getByRole("button", { name: "이용약관" }).click();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("heading", { name: "이용약관" })).toBeVisible();
  await expect(dialog).toContainText("법률 검토를 받지 않은 초안");
  // 페이지는 그대로다
  await expect(page).toHaveURL(/\/signup$/);
});

test("다른 문서로 바로 넘어갈 수 있다", async ({ page }) => {
  await page.goto("/signup");
  await page.locator("form").getByRole("button", { name: "개인정보 처리방침" }).click();
  await expect(page.getByRole("heading", { name: "개인정보 처리방침" })).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("보관 기간");

  await page.getByRole("button", { name: /이용약관 보기/ }).click();
  await expect(page.getByRole("heading", { name: "이용약관" })).toBeVisible();
});

test("Esc 로 닫히고 눌렀던 자리로 돌아온다", async ({ page }) => {
  await page.goto("/signup");
  const opener = page.locator("form").getByRole("button", { name: "이용약관" });
  await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(opener).toBeFocused();
});

test("닫기 버튼으로도 닫힌다", async ({ page }) => {
  await page.goto("/signup");
  await page.locator("form").getByRole("button", { name: "이용약관" }).click();
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("푸터에서도 열 수 있다", async ({ page }) => {
  await page.goto("/collection");
  await page.getByRole("contentinfo").getByRole("button", { name: "개인정보 처리방침" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("창이 열려도 가로 스크롤이 생기지 않는다", async ({ page }) => {
  await page.goto("/signup");
  await page.locator("form").getByRole("button", { name: "이용약관" }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflow).toBe(false);
});
