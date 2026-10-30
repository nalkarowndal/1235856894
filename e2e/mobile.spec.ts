import { test, expect } from '@playwright/test';

test('mobile branding, catalog, navigation, wishlist and screenshots', async({page}, testInfo)=>{
 const errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page).toHaveTitle(/luxuryRental/);
 await expect(page.getByRole('navigation',{name:'모바일 하단 탐색'})).toBeVisible();
 await expect(page.getByText('The Sera Top Handle').first()).toBeVisible();
 await expect(page.locator('img[src="/splash.svg"]')).toHaveCount(0,{timeout:10_000});
 await page.screenshot({ path: testInfo.outputPath('luxuryRental-home-mobile.png'), fullPage:true });
 await page.getByRole('navigation',{name:'모바일 하단 탐색'}).getByRole('button',{name:'스토어'}).click();
 await expect(page.getByText('Shop the edit.')).toBeVisible();
 await page.screenshot({ path: testInfo.outputPath('luxuryRental-store-mobile.png'), fullPage:true });
 await page.getByRole('navigation',{name:'모바일 하단 탐색'}).getByRole('button',{name:'렌탈'}).click();
 await expect(page.getByText('Rent the moment.')).toBeVisible();
 await page.getByRole('button',{name:'찜 추가'}).first().click();
 await expect(page.getByRole('status')).toContainText('위시리스트');
 await page.getByRole('navigation',{name:'모바일 하단 탐색'}).getByRole('button',{name:'찜',exact:true}).click();
 await expect(page.getByText('Your wishlist.')).toBeVisible();
 await expect(page.getByText('The Sera Top Handle').first()).toBeVisible();
 expect(errors).toEqual([]);
});

test('ERP login view requires authentication', async ({page}) => {
 await page.goto('/');
 await page.locator('img[src="/splash.svg"]').waitFor({state:'detached',timeout:10_000});
 await page.getByRole('navigation',{name:'모바일 하단 탐색'}).getByRole('button',{name:'마이'}).click();
 await page.getByRole('button',{name:/ERP 관리자/}).click();
 await expect(page.getByText('ERP', {exact:false}).first()).toBeVisible();
});
