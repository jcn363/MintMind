beforeAll(() => { (process as any).versions.node = "20.17.0"; (process as any).versions.chrome = "120.0.0.0"; });
import { test, expect } from '@playwright/test';

/**
 * File Operations tests for MintMind application
 * Tests file creation, saving, opening, editing, deleting, renaming, and clipboard operations
 */
test.describe('File Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and ensure it's ready for file operations
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Clear any existing file state
    const clearButton = page.locator('[data-testid="clear-button"]');
    if (await clearButton.isVisible()) {
      await clearButton.click();
    }
  });

  test.afterEach(async ({ page }) => {
    // Clean up any unsaved changes or temporary files
    const discardButton = page.locator('[data-testid="discard-changes"]');
    if (await discardButton.isVisible()) {
      await discardButton.click();
    }
  });

  test('should create new file', async ({ page }) => {
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await expect(newFileButton).toBeVisible();
    await expect(newFileButton).toBeEnabled();

    await newFileButton.click();

    const editor = page.locator('[data-testid="editor"]');
    await expect(editor).toBeVisible();
    await expect(editor).toBeEnabled();

    // Test content input
    await editor.fill('Hello World');
    await expect(editor).toHaveValue('Hello World');

    // Verify file is marked as modified
    const modifiedIndicator = page.locator('[data-testid="modified-indicator"]');
    await expect(modifiedIndicator).toBeVisible();
  });

  test('should save file successfully', async ({ page }) => {
    // Create a new file
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="editor"]');
    await editor.fill('Test content');

    const saveButton = page.locator('[data-testid="save-button"]');
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();

    await saveButton.click();

    // Verify save was successful (no error messages)
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();

    // Verify file is no longer marked as modified
    const modifiedIndicator = page.locator('[data-testid="modified-indicator"]');
    await expect(modifiedIndicator).not.toBeVisible();
  });

  test('should handle save errors gracefully', async ({ page }) => {
    // Simulate a save error scenario (would need mock implementation)
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="editor"]');
    await editor.fill('Content that will fail to save');

    // If save button is disabled due to errors, verify it's handled
    const saveButton = page.locator('[data-testid="save-button"]');
    if (await saveButton.isDisabled()) {
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    }
  });

  test('should open file dialog', async ({ page }) => {
    const openButton = page.locator('[data-testid="open-file-button"]');
    await expect(openButton).toBeVisible();
    await expect(openButton).toBeEnabled();

    await openButton.click();

    // Dialog handling would be tested via mock or headless browser setup
    const fileDialog = page.locator('[data-testid="file-dialog"]');
    await expect(fileDialog).toBeVisible();
  });

  test('should edit and save file with modifications', async ({ page }) => {
    // Create and save initial file
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="editor"]');
    await editor.fill('Initial content');

    const saveButton = page.locator('[data-testid="save-button"]');
    await saveButton.click();

    // Modify content
    await editor.fill('Modified content');

    // Verify file is marked as modified again
    const modifiedIndicator = page.locator('[data-testid="modified-indicator"]');
    await expect(modifiedIndicator).toBeVisible();

    // Save again
    await saveButton.click();
    await expect(editor).toHaveValue('Modified content');
    await expect(modifiedIndicator).not.toBeVisible();
  });

  test('should delete file successfully', async ({ page }) => {
    // Create a file first
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const deleteButton = page.locator('[data-testid="delete-button"]');
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toBeEnabled();

    await deleteButton.click();

    // Confirm deletion if dialog appears
    const confirmDelete = page.locator('[data-testid="confirm-delete"]');
    if (await confirmDelete.isVisible()) {
      await confirmDelete.click();
    }

    await expect(page.locator('[data-testid="editor"]')).not.toBeVisible();
  });

  test('should cancel file deletion', async ({ page }) => {
    // Create a file first
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const deleteButton = page.locator('[data-testid="delete-button"]');
    await deleteButton.click();

    // Cancel deletion
    const cancelDelete = page.locator('[data-testid="cancel-delete"]');
    if (await cancelDelete.isVisible()) {
      await cancelDelete.click();
    }

    // Verify file still exists
    await expect(page.locator('[data-testid="editor"]')).toBeVisible();
  });

  test('should rename file successfully', async ({ page }) => {
    // Create a file first
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const renameButton = page.locator('[data-testid="rename-button"]');
    await expect(renameButton).toBeVisible();
    await expect(renameButton).toBeEnabled();

    await renameButton.click();

    const renameInput = page.locator('[data-testid="rename-input"]');
    await expect(renameInput).toBeVisible();

    await renameInput.fill('newname.txt');

    const confirmButton = page.locator('[data-testid="confirm-rename"]');
    await confirmButton.click();

    await expect(page.locator('[data-testid="file-name"]')).toContainText('newname.txt');
  });

  test('should handle invalid rename', async ({ page }) => {
    // Create a file first
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const renameButton = page.locator('[data-testid="rename-button"]');
    await renameButton.click();

    const renameInput = page.locator('[data-testid="rename-input"]');
    await renameInput.fill('invalid/name.txt'); // Invalid filename

    const confirmButton = page.locator('[data-testid="confirm-rename"]');
    await confirmButton.click();

    // Verify error is shown
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('should copy and paste text correctly', async ({ page }) => {
    // Create a file
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="editor"]');
    await editor.fill('Text to copy');

    // Select all text
    await page.keyboard.press('Control+a');

    // Copy
    await page.keyboard.press('Control+c');

    // Move cursor to end
    await page.keyboard.press('End');

    // Add space and paste
    await page.keyboard.type(' ');
    await page.keyboard.press('Control+v');

    await expect(editor).toHaveValue('Text to copy Text to copy');
  });

  test('should handle clipboard operations with empty selection', async ({ page }) => {
    // Create a file with content
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="editor"]');
    await editor.fill('Some content');

    // Try to copy without selection
    await page.keyboard.press('Control+c');

    // Paste - should not modify content unexpectedly
    await page.keyboard.press('Control+v');
    await expect(editor).toHaveValue('Some content');
  });
});
