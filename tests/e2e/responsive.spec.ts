import { test, expect } from './fixtures';
import { login } from './helpers';

const viewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 780 },
];

for (const viewport of viewports) {
  test(`inventory layouts at ${viewport.width}px`, async ({ page }, testInfo) => {
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') failures.push(message.text());
    });
    await page.setViewportSize(viewport);
    await login(page);
    for (const route of ['orders', 'products', 'analytics']) {
      await page.goto(`/ru/${route}`);
      await expect(page.locator('h1')).toBeVisible();
      if (route === 'analytics')
        await expect(page.locator('.analytics-table tbody tr')).toHaveCount(3);
      const issues = await page.evaluate((width) => {
        const result: string[] = [];
        if (document.documentElement.scrollWidth > innerWidth + 1)
          result.push(
            `Horizontal page overflow: ${document.documentElement.scrollWidth} > ${innerWidth}`,
          );
        for (const input of document.querySelectorAll(
          'input:not([type="checkbox"]), select, textarea',
        )) {
          const bounds = input.getBoundingClientRect();
          if (
            bounds.width &&
            bounds.height &&
            width <= 1024 &&
            parseFloat(getComputedStyle(input).fontSize) < 16
          ) {
            result.push(`Input smaller than 16px: ${input.id}`);
          }
        }
        for (const image of document.images) {
          if (image.complete && image.naturalWidth === 0)
            result.push(`Broken image: ${image.getAttribute('src')}`);
        }
        const clock = document.querySelector('.top-menu__clock')?.getBoundingClientRect();
        if (!clock || clock.width === 0 || clock.height === 0)
          result.push('Live date and time are hidden');
        return result;
      }, viewport.width);
      expect(issues, `${route} at ${viewport.width}px`).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`${route}-${viewport.width}.png`),
        fullPage: true,
      });
    }
    expect(failures).toEqual([]);
  });
}
