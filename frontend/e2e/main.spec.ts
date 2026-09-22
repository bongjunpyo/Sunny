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

test("히어로 맨 위에서는 문구가 보이고 덮기·도착 문구는 숨어 있다", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("[data-hero-motion]");
  // 연출이 붙으면 on, 아직 안 붙었으면 pending — 어느 쪽이든 화면은 읽혀야 한다
  await expect(hero).toHaveAttribute("data-hero-motion", /on|pending/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const opacity = await page.evaluate(() => {
    const read = (sel: string) => {
      const el = document.querySelector(sel);
      return el ? Number(getComputedStyle(el).opacity) : -1;
    };
    return { arrival: read("#top [class*='arrival']"), wash: read("#top [class*='wash']") };
  });
  expect(opacity.arrival).toBe(0);
  expect(opacity.wash).toBe(0);
});

test("스크롤 끝에서 태양이 가운데로 오고 종이색이 덮는다", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("[data-hero-motion]");
  const state = await hero.getAttribute("data-hero-motion");
  test.skip(state !== "on", "연출이 붙지 않은 환경");

  const height = await hero.evaluate((el) => el.getBoundingClientRect().height);
  await page.evaluate((y) => scrollTo(0, y), height);
  await page.waitForTimeout(700);

  const vars = await hero.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      x: cs.getPropertyValue("--sun-x").trim(),
      scale: Number(cs.getPropertyValue("--sun-scale")),
      wash: Number(cs.getPropertyValue("--wash-opacity")),
      arrival: Number(cs.getPropertyValue("--arrival-opacity")),
    };
  });
  expect(vars.x).toBe("50%");
  expect(vars.scale).toBeGreaterThan(6);
  expect(vars.wash).toBeGreaterThan(0.9);
  expect(vars.arrival).toBeGreaterThan(0.9);
});

test.describe("모션 감소 설정에서는 히어로가 멈춘다", () => {
  test.use({ reducedMotion: "reduce" });

  test("연출이 켜지지 않고 문구가 읽힌다", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-hero-motion]")).toHaveAttribute(
      "data-hero-motion",
      "pending"
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /컬렉션 살펴보기/ })).toBeVisible();
  });
});

test.describe("좁은 폭에서 겹치지 않는다", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("히어로 문구와 아래 줄이 겹치지 않는다", async ({ page }) => {
    await page.goto("/");
    const copy = await page.locator("#top h1").boundingBox();
    const bottom = await page.locator("#top [class*='bottom']").boundingBox();
    expect(copy && bottom).toBeTruthy();
    // 문구 아래쪽이 아래 줄 위쪽보다 위에 있어야 한다
    expect(copy!.y + copy!.height).toBeLessThanOrEqual(bottom!.y);
  });

  test("가장 좁은 화면에서도 가로 스크롤이 없다", async ({ page }) => {
    for (const path of ["/", "/collection", "/collection/light-study-01", "/login", "/signup"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow, `${path} 에서 가로 스크롤`).toBe(false);
    }
  });
});

test.describe("넓은 폭에서 빈 공간을 쓴다", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("로그인은 두 칸으로 벌어진다", async ({ page }) => {
    await page.goto("/login");
    const intro = await page.getByRole("heading", { level: 1 }).boundingBox();
    const emailBox = await page.getByLabel("이메일").boundingBox();
    // 제목과 입력칸이 좌우로 나뉜다
    expect(emailBox!.x).toBeGreaterThan(intro!.x + intro!.width * 0.5);
  });

  test("본문 글자가 너무 작지 않다", async ({ page }) => {
    await page.goto("/collection");
    const size = await page.evaluate(() => {
      const el = document.querySelector("main p");
      return el ? parseFloat(getComputedStyle(el).fontSize) : 0;
    });
    expect(size).toBeGreaterThanOrEqual(13);
  });
});
