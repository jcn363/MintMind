import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('should launch app successfully', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/MintMind/);
  });

  test('should open menu', async ({ page }) => {
    await page.goto('/');

    const menuButton = page.locator('[data-testid="menu-button"]');
    await menuButton.click();

    await expect(page.locator('[data-testid="menu"]')).toBeVisible();
  });

  test('should create new file', async ({ page }) => {
    await page.goto('/');

    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    await expect(page.locator('[data-testid="editor"]')).toBeVisible();
  });

  test('should open terminal', async ({ page }) => {
    await page.goto('/');

    const terminalButton = page.locator('[data-testid="terminal-button"]');
    await terminalButton.click();

    await expect(page.locator('[data-testid="terminal"]')).toBeVisible();
  });
});
