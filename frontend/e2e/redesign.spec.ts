import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const shots = 'output/design-review/app-redesign/review';
test('시안 화면과 제품·구매·Q&A 흐름', async ({ page }, testInfo) => {
    await mkdir(shots, { recursive: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const path of ['/', '/about', '/collection', '/collection/light-study-01', '/collection/light-study-02', '/custom', '/archive', '/archive/sea', '/archive/leaves', '/archive/fabric', '/login', '/signup', '/account', '/cart', '/checkout', '/checkout/result']) {
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await expect(page.locator('h1')).toHaveCount(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
        if (['/', '/collection', '/collection/light-study-02', '/custom', '/login'].includes(path)) {
            await page.locator('img').evaluateAll(imgs => imgs.forEach(i => { if (i instanceof HTMLImageElement)
                i.loading = 'eager'; }));
            await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
            await page.screenshot({ path: `${shots}/${path === '/' ? 'home' : path.replaceAll('/', '-')}-${testInfo.project.name}.png`, fullPage: true });
        }
    }
    await page.goto('/collection/light-study-01');
    await expect(page.locator('[data-bead="square"]').first()).toBeVisible();
    expect(await page.locator('main section').first().locator('[data-bead="square"]').count()).toBe(7);
    expect(await page.locator('main section').first().locator('[data-bead="round"]').count()).toBe(7);
    await page.getByRole('link', { name: '제품 문의 · Q&A' }).click();
    await page.getByText('비즈는 어떻게 배열되나요?', { exact: true }).click();
    await expect(page.getByText('네모 비즈와 원형 비즈가 하나씩 번갈아 이어집니다. 그림은 네모 7개와 원형 7개 구성입니다.')).toBeVisible();
    await page.getByLabel('문의 유형').selectOption({ label: '사이즈·구성' });
    await page.getByLabel('제목', { exact: true }).fill('배열 <b>확인</b>');
    await page.getByLabel('내용', { exact: true }).fill('구성을 확인하고 싶습니다.');
    await page.getByRole('button', { name: '문의하기' }).click();
    await expect(page.getByRole('status')).toContainText('실제 접수되지 않았습니다.');
    expect(await page.locator('b').filter({ hasText: '확인' }).count()).toBe(0);
    await page.getByRole('button', { name: '장바구니 담기' }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole('heading', { name: '오후의 조각' })).toBeVisible();
    await page.getByLabel('수량').fill('2');
    await page.reload();
    await expect(page.getByLabel('수량')).toHaveValue('2');
    await page.getByRole('link', { name: '주문서 화면 보기' }).click();
    await expect(page.getByRole('button', { name: '결제하기', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '게스트로 계속', exact: true })).toBeVisible();
    await expect(page.getByText('1품목 · 총 2개', { exact: true })).toBeVisible();
    await page.goto('/checkout/result');
    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByRole('heading', { name: '내 주문 요청', exact: true })).toBeVisible();
    await page.route('**/api/uploads/photo-rules', route => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({photoRules: {
            accept: ['image/png'], maxBytes: 2097152, minWidth: 1200, minHeight: 1300, aspectRatio: null, provisional: true,
        }}),
    }));
    await page.goto('/custom');
    await page.getByRole('button', { name: '비즈 목걸이', exact: true }).click();
    await expect(page.getByLabel('1번 비즈', { exact: true })).toHaveCount(0);
    await expect(page.locator('[data-bead="moon"]')).toHaveCount(1);
    await expect(page.locator('[data-bead="round"]')).toHaveCount(2);
    await page.getByRole('button', { name: '비즈 팔찌', exact: true }).click();
    await expect(page.getByLabel('1번 비즈', { exact: true })).toBeVisible();
    await expect(page.getByText('PNG · 2MB 이하 · 1200×1300px 이상', { exact: false })).toBeVisible();
    await expect(page.locator('#memory-photo')).toHaveAttribute('accept', 'image/png');
    await expect(page.locator('#memory-photo')).toBeDisabled();
    await expect(page.getByRole('button', { name: '게스트로 사진 올리기', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '이 구성 장바구니에 담기' }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByLabel('수량 · 오후의 조각', { exact: true })).toHaveValue('3');
    if (testInfo.project.name === 'mobile') {
        await page.getByRole('button', { name: '전체 메뉴 열기' }).click();
        await page.getByRole('dialog').getByRole('link', { name: '장바구니' }).click();
        await expect(page).toHaveURL(/\/cart$/);
        await expect(page.getByRole('dialog')).not.toBeVisible();
    }
    expect(errors).toEqual([]);
});
