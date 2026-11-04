import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
test('팔찌 믹스는 5색을 사용하고 카트·주문서에 유지된다',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/custom');const picker=page.getByRole('group',{name:'반응색 선택'});await expect(picker.getByRole('button')).toHaveCount(6);
 await page.getByRole('button',{name:'전체 색상 믹스',exact:true}).click();await expect(page.getByRole('button',{name:'전체 색상 믹스',exact:true})).toHaveAttribute('aria-pressed','true');
 const fills=()=>page.locator('linearGradient[id*="-bead-"] stop[offset="1"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('stop-color')));
 expect(new Set(await fills()).size).toBe(5);await expect(page.getByText('전체 색상 믹스',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'◯ 실내',exact:true}).click();expect(new Set(await fills()).size).toBe(1);await page.getByRole('button',{name:'☼ 햇빛',exact:true}).click();expect(new Set(await fills()).size).toBe(5);
 await mkdir('/Users/bongjunpyo/Sunny/output/design-review/color-mix/review',{recursive:true});await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();window.scrollTo({top:0,behavior:'instant'})});await page.screenshot({path:`/Users/bongjunpyo/Sunny/output/design-review/color-mix/review/custom-${info.project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'비즈 목걸이',exact:true}).click();await expect(picker.getByRole('button')).toHaveCount(5);await expect(page.getByRole('button',{name:'라벤더',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('button',{name:'전체 색상 믹스',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'비즈 팔찌',exact:true}).click();await page.getByRole('button',{name:'전체 색상 믹스',exact:true}).click();await page.getByRole('button',{name:'이 구성 장바구니에 담기'}).click();await expect(page).toHaveURL(/\/cart$/);await expect(page.getByText('전체 색상 믹스',{exact:false})).toBeVisible();await page.reload();await expect(page.getByText('전체 색상 믹스',{exact:false})).toBeVisible();expect(new Set(await fills()).size).toBe(5);
 await page.getByRole('link',{name:'주문서 화면 보기'}).click();await expect(page.getByText('전체 색상 믹스',{exact:false})).toBeVisible();
 await page.goto('/collection/light-study-01');await expect(page.getByRole('group',{name:'반응색 선택'}).getByRole('button')).toHaveCount(6);await page.getByRole('button',{name:'전체 색상 믹스',exact:true}).click();await page.getByRole('button',{name:'하늘빛',exact:true}).click();expect(new Set(await page.locator('main section').first().locator('linearGradient[id*="-bead-"] stop[offset="1"]').evaluateAll(ns=>ns.map(n=>n.getAttribute('stop-color')))).size).toBe(1);
 await page.goto('/collection/light-study-02');await expect(page.getByRole('group',{name:'반응색 선택'}).getByRole('button')).toHaveCount(5);expect(errors).toEqual([]);
});
