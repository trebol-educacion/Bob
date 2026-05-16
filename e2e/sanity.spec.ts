import { test, expect } from '@playwright/test';

test('home page responds with a document', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBeLessThan(500);
});
