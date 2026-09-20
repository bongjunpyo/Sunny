import { expect, test } from "@playwright/test";

test("드롭다운으로 고른 값이 요약에 반영된다", async ({ page }) => {
  await page.goto("/custom");
  const summary = page.getByRole("complementary", { name: "구성 요약" });

  await page.getByLabel("광변색 반응색").selectOption("blue");
  await expect(summary).toContainText("파랑");

  await page.getByLabel("길이").selectOption("20 cm");
  await expect(summary).toContainText("20 cm");
});

test("제품을 바꾸면 그림과 길이 선택지가 함께 바뀐다", async ({ page }) => {
  await page.goto("/custom");
  const summary = page.getByRole("complementary", { name: "구성 요약" });
  const lengthSelect = page.getByLabel("길이");

  // 팔찌 기준
  await expect(lengthSelect).toHaveValue("18 cm");
  await expect(page.getByRole("img", { name: /팔찌 컬렉션을 위한/ })).toBeVisible();

  await page.getByRole("button", { name: /Light study 02/ }).click();
  await expect(summary).toContainText("목걸이");
  await expect(lengthSelect).toHaveValue("45 cm");
  await expect(page.getByRole("img", { name: /목걸이 컬렉션을 위한/ })).toBeVisible();

  const options = await lengthSelect.locator("option").allInnerTexts();
  expect(options).toEqual(["40 cm", "45 cm", "50 cm"]);
});

test("드롭다운을 키보드로 쓸 수 있다", async ({ page }) => {
  await page.goto("/custom");
  await page.getByLabel("광변색 반응색").focus();
  await expect(page.getByLabel("광변색 반응색")).toBeFocused();
});

test("비즈 배열은 고르지 않고 고정이라고 알린다", async ({ page }) => {
  await page.goto("/custom");
  await expect(page.getByText("균일 배열 고정")).toBeVisible();
  await expect(page.getByRole("button", { name: "포인트 배열" })).toHaveCount(0);
});

test("사진은 선택 사항이고 규격을 알려준다", async ({ page }) => {
  await page.goto("/custom");
  await expect(page.getByText("커스텀 사진 · 선택 사항")).toBeVisible();
  await expect(page.getByText(/JPEG · PNG/)).toBeVisible();
  await expect(page.getByText("회의 전 임시값")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "구성 요약" })).toContainText("넣지 않음");
});

test("형식이 맞지 않는 파일은 이유를 알려준다", async ({ page }) => {
  await page.goto("/custom");
  await page.setInputFiles("input[type=file]", {
    name: "not-a-photo.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
  });
  await expect(page.locator("main").getByRole("alert")).toContainText("형식만");
});

test("해상도가 모자란 사진도 막는다", async ({ page }) => {
  await page.goto("/custom");
  // 1×1 PNG
  const tiny = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  await page.setInputFiles("input[type=file]", {
    name: "tiny.png",
    mimeType: "image/png",
    buffer: tiny,
  });
  await expect(page.locator("main").getByRole("alert")).toContainText("1000×1000px 이상");
});

test("금액을 지어내지 않는다", async ({ page }) => {
  await page.goto("/custom");
  await expect(page.getByRole("complementary", { name: "구성 요약" })).toContainText(
    "서버 연결 전"
  );
  await expect(page.locator("body")).not.toContainText("₩");
});

test("커스텀 화면에 가로 스크롤이 없다", async ({ page }) => {
  await page.goto("/custom");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflow).toBe(false);
});
