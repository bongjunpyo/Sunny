import { expect, test } from "@playwright/test";

test("로그인 화면은 실제 개인정보를 넣지 말라고 알린다", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("실제 개인정보를 입력하지 마세요")).toBeVisible();
});

test("잘못된 입력은 각각 오류를 보여준다", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("이메일").fill("demo@");
  await page.getByLabel("비밀번호").fill("123");
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page.getByText("이메일 형태가 아닙니다.")).toBeVisible();
  await expect(page.getByText("비밀번호는 8자 이상이어야 합니다.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("가입은 필수 약관 동의가 있어야 한다", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("이메일").fill("demo@example.com");
  await page.getByLabel(/비밀번호/).fill("sunny2026");
  await page.getByLabel(/별명/).fill("데모");
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page.getByText("필수 약관에 동의해야 가입할 수 있습니다.")).toBeVisible();
});

test("mock 로그인을 하면 마이페이지가 열리고 머리말이 바뀐다", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("이메일").fill("demo@example.com");
  await page.getByLabel("비밀번호").fill("sunny2026");
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("demo 님");
  await expect(page.getByText("아직 주문이 없습니다.")).toBeVisible();
  await expect(page.getByRole("link", { name: "demo 님" })).toBeVisible();

  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("navigation", { name: "회원 메뉴" }).getByRole("link", { name: "로그인" })
  ).toBeVisible();
});

test("로그인하지 않으면 마이페이지가 로그인을 안내한다", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByText("로그인이 필요한 화면입니다.")).toBeVisible();
});

test("회원 화면에 가로 스크롤이 없다", async ({ page }) => {
  for (const path of ["/login", "/signup", "/account"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  }
});
