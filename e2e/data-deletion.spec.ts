import { test } from '@playwright/test';

test('data deletion admin flow — requires BOB_ADMIN_USER + BOB_ADMIN_PASS', async () => {
  const adminUser = process.env.BOB_ADMIN_USER;
  const adminPass = process.env.BOB_ADMIN_PASS;

  if (!adminUser || !adminPass) {
    test.skip(true, 'BOB_ADMIN_USER / BOB_ADMIN_PASS not set — skip data deletion E2E');
    return;
  }
});
