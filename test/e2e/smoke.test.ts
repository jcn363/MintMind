beforeAll(() => { (process as any).versions.node = "20.17.0"; (process as any).versions.chrome = "120.0.0.0"; });
import { test, expect } from '@playwright/test';

/**
 * Smoke tests for MintMind application
 * Tests basic functionality to ensure the app launches and core features work
 */
test.describe('Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and wait for it to be ready
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async ({ page }) => {
    // Clean up any open dialogs or menus
    await page.keyboard.press('Escape');
  });

  test('should launch app successfully', async ({ page }) => {
    // Verify the app title is correct
    await expect(page).toHaveTitle(/MintMind/);

    // Verify essential UI elements are present
    await expect(page.locator('body')).toBeVisible();
  });

  test('should open menu', async ({ page }) => {
    const menuButton = page.locator('[data-testid="menu-button"]');
    await expect(menuButton).toBeVisible();

    await menuButton.click();

    const menu = page.locator('[data-testid="menu"]');
    await expect(menu).toBeVisible();
    await expect(menu).toBeEnabled();
  });

  test('should create new file', async ({ page }) => {
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await expect(newFileButton).toBeVisible();
    await expect(newFileButton).toBeEnabled();

    await newFileButton.click();

    const editor = page.locator('[data-testid="editor"]');
    await expect(editor).toBeVisible();
    await expect(editor).toBeEnabled();

    // Verify editor is ready for input
    await expect(editor).toHaveAttribute('contenteditable', 'true');
  });

  test('should open terminal', async ({ page }) => {
    const terminalButton = page.locator('[data-testid="terminal-button"]');
    await expect(terminalButton).toBeVisible();
    await expect(terminalButton).toBeEnabled();

    await terminalButton.click();

    const terminal = page.locator('[data-testid="terminal"]');
    await expect(terminal).toBeVisible();
    await expect(terminal).toBeEnabled();
  });

  test('should handle app errors gracefully', async ({ page }) => {
    // Test error handling when a non-existent element is accessed
    const nonExistentElement = page.locator('[data-testid="non-existent"]');
    await expect(nonExistentElement).not.toBeVisible();

    // Verify app remains stable
    await expect(page).toHaveTitle(/MintMind/);
  });

  test('should handle network connectivity issues', async ({ page }) => {
    // Simulate offline state
    await page.context().setOffline(true);

    // App should still be responsive (basic functionality)
    await expect(page.locator('body')).toBeVisible();

    // Restore connectivity
    await page.context().setOffline(false);
  });
});
