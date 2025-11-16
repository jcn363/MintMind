/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { test, expect } from '@playwright/test';

/**
 * Tests E2E for Rust File I/O integration in MintMind
 *
 * These tests validate the full user flow for the Rust File I/O feature,
 * including spawning VS Code, enabling the setting, and performing file operations.
 */

test.describe('MintMind - Rust File I/O E2E Integration', () => {

  test('should spawn VS Code, enable Rust File I/O setting, and perform file operations without errors', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://127.0.0.1:3000');

    // Wait for the application to load completely
    await expect(page).toHaveTitle(/MintMind/);
    await page.waitForSelector('[data-testid="main-content"]', { timeout: 10000 });

    // Open settings (VS Code settings UI)
    const settingsButton = page.locator('[data-testid="settings-button"]');
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    // Navigate to files settings section
    const filesSettingsTab = page.locator('[data-testid="files-settings-tab"]');
    await expect(filesSettingsTab).toBeVisible();
    await filesSettingsTab.click();

    // Enable the Rust File I/O setting
    const rustFileIOSetting = page.locator('[data-testid="files.useRustFileIO-setting"]');
    await expect(rustFileIOSetting).toBeVisible();

    // Check if it's already enabled (should be by default in dev builds)
    const checkbox = rustFileIOSetting.locator('input[type="checkbox"]');
    const isChecked = await checkbox.isChecked();

    if (!isChecked) {
      await checkbox.check();
    }

    // Verify setting is enabled
    await expect(checkbox).toBeChecked();

    // Save settings
    const saveSettingsButton = page.locator('[data-testid="save-settings-button"]');
    await expect(saveSettingsButton).toBeVisible();
    await saveSettingsButton.click();

    // Wait for settings to be saved
    const settingsSavedNotification = page.locator('[data-testid="settings-saved-notification"]');
    await expect(settingsSavedNotification).toBeVisible();

    // Now perform file operations to test Rust File I/O functionality

    // Create a new file
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await expect(newFileButton).toBeVisible();
    await newFileButton.click();

    // Write some content to the file
    const editor = page.locator('[data-testid="monaco-editor"]');
    await expect(editor).toBeVisible();
    await editor.click();

    const testContent = `// Test file for Rust File I/O
function testRustFileIO() {
  console.log("Testing Rust-based file operations");
  return "success";
}

export { testRustFileIO };`;

    await page.keyboard.type(testContent, { delay: 10 });

    // Save the file
    await page.keyboard.press('Control+s');

    // Verify file was saved successfully
    const saveNotification = page.locator('[data-testid="save-notification"]');
    await expect(saveNotification).toBeVisible();
    await expect(saveNotification).toContainText('Archivo guardado');

    // Open file explorer and verify file appears
    const explorerButton = page.locator('[data-testid="explorer-toggle"]');
    await expect(explorerButton).toBeVisible();
    await explorerButton.click();

    const fileExplorer = page.locator('[data-testid="file-explorer"]');
    await expect(fileExplorer).toBeVisible();
    await expect(fileExplorer).toContainText('Untitled-1.ts');

    // Read the file content back to verify it was written correctly
    const fileItem = fileExplorer.locator('text=Untitled-1.ts').first();
    await fileItem.click();

    // Verify content is still there
    await expect(editor).toContainText('function testRustFileIO()');
    await expect(editor).toContainText('Testing Rust-based file operations');

    // Test file operations (create directory, etc.)
    // Create a new directory
    const newFolderButton = page.locator('[data-testid="new-folder-button"]');
    await expect(newFolderButton).toBeVisible();
    await newFolderButton.click();

    // Type folder name
    await page.keyboard.type('test-folder');
    await page.keyboard.press('Enter');

    // Verify folder was created
    await expect(fileExplorer).toContainText('test-folder');

    // Move file into folder (drag and drop simulation)
    const fileToMove = fileExplorer.locator('text=Untitled-1.ts');
    const targetFolder = fileExplorer.locator('text=test-folder');

    // Simulate drag and drop
    await fileToMove.dragTo(targetFolder);

    // Verify file was moved
    await expect(fileExplorer.locator('[data-testid="test-folder"]').locator('text=Untitled-1.ts')).toBeVisible();

    // Delete the test folder
    const deleteButton = page.locator('[data-testid="delete-button"]');
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Confirm deletion
    const confirmDeleteButton = page.locator('[data-testid="confirm-delete-button"]');
    await expect(confirmDeleteButton).toBeVisible();
    await confirmDeleteButton.click();

    // Verify folder was deleted
    await expect(fileExplorer).not.toContainText('test-folder');

    // Check that no errors occurred during the entire flow
    const errorMessages = page.locator('[data-testid="error-message"]');
    await expect(errorMessages).toHaveCount(0);

    // Check console for any errors
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });

    // Wait a moment to catch any async errors
    await page.waitForTimeout(1000);

    // Assert no console errors
    expect(logs.length).toBe(0);
  });
});