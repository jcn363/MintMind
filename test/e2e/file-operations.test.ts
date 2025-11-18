import { test, expect } from '@playwright/test';

test.describe('File Operations', () => {
  test('should create new file', async ({ page }) => {
    await page.goto('/');

    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="editor"]');
    await expect(editor).toBeVisible();

    await editor.fill('Hello World');
    await expect(editor).toHaveValue('Hello World');
  });

  test('should save file', async ({ page }) => {
    await page.goto('/');

    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="editor"]');
    await editor.fill('Test content');

    const saveButton = page.locator('[data-testid="save-button"]');
    await saveButton.click();

    // Verify save was successful (no error messages)
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
  });

  test('should open file', async ({ page }) => {
    await page.goto('/');

    const openButton = page.locator('[data-testid="open-file-button"]');
    await openButton.click();

    // Dialog handling would be tested via mock or headless browser setup
    const editor = page.locator('[data-testid="editor"]');
    await expect(editor).toBeVisible();
  });

  test('should edit and save file', async ({ page }) => {
    await page.goto('/');

    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="editor"]');
    await editor.fill('Initial content');
    await editor.fill('Modified content');

    const saveButton = page.locator('[data-testid="save-button"]');
    await saveButton.click();

    await expect(editor).toHaveValue('Modified content');
  });

  test('should delete file', async ({ page }) => {
    await page.goto('/');

    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const deleteButton = page.locator('[data-testid="delete-button"]');
    await deleteButton.click();

    await expect(page.locator('[data-testid="editor"]')).not.toBeVisible();
  });

  test('should rename file', async ({ page }) => {
    await page.goto('/');

    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const renameButton = page.locator('[data-testid="rename-button"]');
    await renameButton.click();

    const renameInput = page.locator('[data-testid="rename-input"]');
    await renameInput.fill('newname.txt');

    const confirmButton = page.locator('[data-testid="confirm-rename"]');
    await confirmButton.click();

    await expect(page.locator('[data-testid="file-name"]')).toContainText('newname.txt');
  });

  test('should copy and paste text', async ({ page }) => {
    await page.goto('/');

    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="editor"]');
    await editor.fill('Text to copy');

    // Simulate copy/paste (actual implementation depends on UI)
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');

    await expect(editor).toHaveValue('Text to copyText to copy');
  });
});
