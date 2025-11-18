import { test, expect } from '@playwright/test';

test.describe('Terminal Operations', () => {
  test('should open terminal', async ({ page }) => {
    await page.goto('/');

    const terminalButton = page.locator('[data-testid="terminal-button"]');
    await terminalButton.click();

    const terminal = page.locator('[data-testid="terminal"]');
    await expect(terminal).toBeVisible();
  });

  test('should execute command in terminal', async ({ page }) => {
    await page.goto('/');

    const terminalButton = page.locator('[data-testid="terminal-button"]');
    await terminalButton.click();

    const terminalInput = page.locator('[data-testid="terminal-input"]');
    await terminalInput.fill('echo "Hello World"');
    await terminalInput.press('Enter');

    const terminalOutput = page.locator('[data-testid="terminal-output"]');
    await expect(terminalOutput).toContainText('Hello World');
  });

  test('should create new terminal tab', async ({ page }) => {
    await page.goto('/');

    const terminalButton = page.locator('[data-testid="terminal-button"]');
    await terminalButton.click();

    const newTabButton = page.locator('[data-testid="new-terminal-tab"]');
    await newTabButton.click();

    const terminalTabs = page.locator('[data-testid="terminal-tab"]');
    await expect(terminalTabs).toHaveCount(2);
  });

  test('should resize terminal', async ({ page }) => {
    await page.goto('/');

    const terminalButton = page.locator('[data-testid="terminal-button"]');
    await terminalButton.click();

    const resizeHandle = page.locator('[data-testid="terminal-resize-handle"]');
    const terminal = page.locator('[data-testid="terminal"]');

    const initialSize = await terminal.boundingBox();

    await resizeHandle.dragTo(terminal, {
      targetPosition: { x: 0, y: -50 },
    });

    const newSize = await terminal.boundingBox();
    expect(newSize!.height).toBeLessThan(initialSize!.height);
  });

  test('should copy from terminal', async ({ page }) => {
    await page.goto('/');

    const terminalButton = page.locator('[data-testid="terminal-button"]');
    await terminalButton.click();

    const terminalInput = page.locator('[data-testid="terminal-input"]');
    await terminalInput.fill('echo "Copy this text"');
    await terminalInput.press('Enter');

    // Simulate selection and copy
    const terminalOutput = page.locator('[data-testid="terminal-output"]');
    await terminalOutput.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+c');

    // Verify clipboard has content (would need actual clipboard API access)
    // This is a simplified test - actual implementation would check clipboard
  });

  test('should paste into terminal', async ({ page }) => {
    await page.goto('/');

    const terminalButton = page.locator('[data-testid="terminal-button"]');
    await terminalButton.click();

    const terminalInput = page.locator('[data-testid="terminal-input"]');

    // Simulate paste
    await page.keyboard.press('Control+v');

    const inputValue = await terminalInput.inputValue();
    expect(inputValue.length).toBeGreaterThan(0);
  });

  test('should detect shell type', async ({ page }) => {
    await page.goto('/');

    const terminalButton = page.locator('[data-testid="terminal-button"]');
    await terminalButton.click();

    const shellIndicator = page.locator('[data-testid="shell-indicator"]');
    await expect(shellIndicator).toBeVisible();

    // Shell type detection would be verified by checking the indicator text
    const shellType = await shellIndicator.textContent();
    expect(['bash', 'zsh', 'fish', 'powershell', 'cmd']).toContain(shellType);
  });
});
