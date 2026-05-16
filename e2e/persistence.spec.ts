import { test } from '@playwright/test';

const BOB_TEST_USER = process.env.BOB_TEST_USER;
const BOB_TEST_PASS = process.env.BOB_TEST_PASS;

test('persistence after reload — requires BOB_TEST_USER + BOB_TEST_PASS', async ({ page }) => {
  if (!BOB_TEST_USER || !BOB_TEST_PASS) {
    test.skip(true, 'BOB_TEST_USER / BOB_TEST_PASS not set — skip persistence E2E');
    return;
  }

  await page.goto('/login');
  await page.fill('[name="email"]', BOB_TEST_USER);
  await page.fill('[name="password"]', BOB_TEST_PASS);
  await page.click('[type="submit"]');
  await page.waitForURL('**/');

  await page.reload();
  await page.waitForSelector('[data-testid="bob-root"]', { timeout: 5000 });
});
