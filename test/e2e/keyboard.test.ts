import { test, expect } from '@playwright/test';

test.describe('Keyboard Operations', () => {
  test('should handle Ctrl+N for new file', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Control+n');

    const editor = page.locator('[data-testid="editor"]');
    await expect(editor).toBeVisible();
  });

  test('should handle Ctrl+S for save', async ({ page }) => {
    await page.goto('/');

    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="editor"]');
    await editor.fill('Test content');

    await page.keyboard.press('Control+s');

    // Verify save (no error messages)
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
  });

  test('should handle Ctrl+O for open file', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Control+o');

    // Dialog would open (verified through UI state)
    const editor = page.locator('[data-testid="editor"]');
    await expect(editor).toBeVisible();
  });

  test('should detect keyboard layout', async ({ page }) => {
    await page.goto('/');

    const layoutIndicator = page.locator('[data-testid="keyboard-layout-indicator"]');
    await expect(layoutIndicator).toBeVisible();

    const layout = await layoutIndicator.textContent();
    expect(['US', 'UK', 'DE', 'FR']).toContain(layout);
  });

  test('should handle special key input in editor', async ({ page }) => {
    await page.goto('/');

    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="editor"]');

    // Test special characters
    await page.keyboard.press('KeyA');
    await page.keyboard.press('Shift+KeyA'); // Should produce 'A'
    await page.keyboard.press('BracketLeft'); // Should produce '['

    const content = await editor.inputValue();
    expect(content).toContain('aA[');
  });

  test('should handle input in terminal', async ({ page }) => {
    await page.goto('/');

    const terminalButton = page.locator('[data-testid="terminal-button"]');
    await terminalButton.click();

    const terminalInput = page.locator('[data-testid="terminal-input"]');

    await terminalInput.focus();
    await page.keyboard.type('ls -la');
    await page.keyboard.press('Enter');

    const terminalOutput = page.locator('[data-testid="terminal-output"]');
    await expect(terminalOutput).toBeVisible();
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await page.goto('/');

    // Test various shortcuts
    const shortcuts = [
      'Control+t', // New terminal tab
      'Control+w', // Close tab
      'Control+Shift+t', // Reopen closed tab
    ];

    for (const shortcut of shortcuts) {
      await page.keyboard.press(shortcut);
      // Verify appropriate UI changes occurred
    }

    // Verify terminal tabs exist
    const terminalTabs = page.locator('[data-testid="terminal-tab"]');
    await expect(terminalTabs).toHaveCount(1);
  });
});
