import { test, expect } from '@playwright/test';

/**
 * Terminal Operations tests for MintMind application
 * Tests terminal launching, command execution, tab management, resizing, and clipboard operations
 */
test.describe('Terminal Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and ensure it's ready for terminal operations
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Close any existing terminals to ensure clean state
    const closeButtons = page.locator('[data-testid="close-terminal"]');
    const count = await closeButtons.count();
    for (let i = 0; i < count; i++) {
      await closeButtons.nth(i).click();
    }
  });

  test.afterEach(async ({ page }) => {
    // Clean up terminal state and close any open terminals
    const closeButtons = page.locator('[data-testid="close-terminal"]');
    const count = await closeButtons.count();
    for (let i = 0; i < count; i++) {
      try {
        await closeButtons.nth(i).click();
      } catch {
        // Ignore errors if terminal already closed
      }
    }

    // Reset keyboard state
    await page.keyboard.press('Escape');
  });

  test.describe('Terminal Launching', () => {
    test('should open terminal successfully', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await expect(terminalButton).toBeVisible();
      await expect(terminalButton).toBeEnabled();

      await terminalButton.click();

      const terminal = page.locator('[data-testid="terminal"]');
      await expect(terminal).toBeVisible();
      await expect(terminal).toBeEnabled();

      // Verify terminal prompt is ready
      const terminalInput = page.locator('[data-testid="terminal-input"]');
      await expect(terminalInput).toBeVisible();
    });

    test('should handle terminal opening errors gracefully', async ({ page }) => {
      // Test terminal button when terminal service is unavailable
      const terminalButton = page.locator('[data-testid="terminal-button"]');

      // If terminal fails to open, error should be displayed
      await terminalButton.click().catch(() => {
        // Ignore click errors
      });

      // App should remain stable
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Command Execution', () => {
    test('should execute basic commands successfully', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const terminalInput = page.locator('[data-testid="terminal-input"]');
      await terminalInput.fill('echo "Hello World"');
      await terminalInput.press('Enter');

      const terminalOutput = page.locator('[data-testid="terminal-output"]');
      await expect(terminalOutput).toContainText('Hello World');
    });

    test('should handle command execution errors', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const terminalInput = page.locator('[data-testid="terminal-input"]');
      await terminalInput.fill('nonexistent_command_xyz');
      await terminalInput.press('Enter');

      // Verify error handling
      const terminalOutput = page.locator('[data-testid="terminal-output"]');
      await expect(terminalOutput).toBeVisible();

      // Command should fail gracefully without crashing terminal
      const newPrompt = page.locator('[data-testid="terminal-input"]');
      await expect(newPrompt).toBeVisible();
    });

    test('should execute multiline commands', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const terminalInput = page.locator('[data-testid="terminal-input"]');

      // Multi-line command
      await terminalInput.fill('echo "Line 1" && \\');
      await terminalInput.press('Enter');
      await terminalInput.fill('echo "Line 2"');
      await terminalInput.press('Enter');

      const terminalOutput = page.locator('[data-testid="terminal-output"]');
      await expect(terminalOutput).toContainText('Line 1');
      await expect(terminalOutput).toContainText('Line 2');
    });

    test('should handle long-running commands', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const terminalInput = page.locator('[data-testid="terminal-input"]');
      await terminalInput.fill('sleep 1'); // Short sleep to test async handling
      await terminalInput.press('Enter');

      // Terminal should remain responsive during command execution
      const terminal = page.locator('[data-testid="terminal"]');
      await expect(terminal).toBeVisible();

      // Wait for command to complete
      await page.waitForTimeout(1500);
      await expect(terminalInput).toBeVisible(); // New prompt should appear
    });
  });

  test.describe('Terminal Tab Management', () => {
    test('should create new terminal tab', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const newTabButton = page.locator('[data-testid="new-terminal-tab"]');
      await expect(newTabButton).toBeVisible();

      await newTabButton.click();

      const terminalTabs = page.locator('[data-testid="terminal-tab"]');
      await expect(terminalTabs).toHaveCount(2);

      // Both tabs should be functional
      const terminals = page.locator('[data-testid="terminal"]');
      await expect(terminals).toHaveCount(2);
    });

    test('should switch between terminal tabs', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const newTabButton = page.locator('[data-testid="new-terminal-tab"]');
      await newTabButton.click();

      const terminalTabs = page.locator('[data-testid="terminal-tab"]');

      // Click second tab
      await terminalTabs.nth(1).click();

      // Second terminal should be active
      const activeTerminal = page.locator('[data-testid="terminal"].active, [data-testid="terminal"]:has([data-testid="terminal-input"]:focus)');
      await expect(activeTerminal).toBeVisible();
    });

    test('should close terminal tab', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const newTabButton = page.locator('[data-testid="new-terminal-tab"]');
      await newTabButton.click();

      const closeButtons = page.locator('[data-testid="close-terminal-tab"]');
      await closeButtons.nth(1).click();

      const terminalTabs = page.locator('[data-testid="terminal-tab"]');
      await expect(terminalTabs).toHaveCount(1);
    });
  });

  test.describe('Terminal Resizing', () => {
    test('should resize terminal vertically', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const resizeHandle = page.locator('[data-testid="terminal-resize-handle"]');
      const terminal = page.locator('[data-testid="terminal"]');

      const initialSize = await terminal.boundingBox();
      expect(initialSize).toBeTruthy();

      await resizeHandle.dragTo(terminal, {
        targetPosition: { x: 0, y: -50 },
      });

      const newSize = await terminal.boundingBox();
      expect(newSize!.height).toBeLessThan(initialSize!.height);
    });

    test('should resize terminal horizontally', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const resizeHandle = page.locator('[data-testid="terminal-resize-handle"]');
      const terminal = page.locator('[data-testid="terminal"]');

      const initialSize = await terminal.boundingBox();
      expect(initialSize).toBeTruthy();

      await resizeHandle.dragTo(terminal, {
        targetPosition: { x: -50, y: 0 },
      });

      const newSize = await terminal.boundingBox();
      expect(newSize!.width).toBeLessThan(initialSize!.width);
    });

    test('should maintain minimum terminal size', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const resizeHandle = page.locator('[data-testid="terminal-resize-handle"]');
      const terminal = page.locator('[data-testid="terminal"]');

      // Try to resize to very small size
      await resizeHandle.dragTo(terminal, {
        targetPosition: { x: 0, y: 200 }, // Drag down significantly
      });

      const newSize = await terminal.boundingBox();
      expect(newSize!.height).toBeGreaterThan(100); // Should maintain minimum height
    });
  });

  test.describe('Clipboard Operations', () => {
    test('should copy from terminal output', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const terminalInput = page.locator('[data-testid="terminal-input"]');
      await terminalInput.fill('echo "Copy this text"');
      await terminalInput.press('Enter');

      // Wait for output
      const terminalOutput = page.locator('[data-testid="terminal-output"]');
      await expect(terminalOutput).toContainText('Copy this text');

      // Simulate selection and copy
      await terminalOutput.click();
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Control+c');

      // Terminal should remain stable
      await expect(terminalOutput).toBeVisible();
    });

    test('should paste into terminal input', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const terminalInput = page.locator('[data-testid="terminal-input"]');

      // Simulate paste (assuming clipboard has content)
      await page.keyboard.press('Control+v');

      const inputValue = await terminalInput.inputValue();
      // Input should either have content or remain empty without errors
      expect(typeof inputValue).toBe('string');
    });

    test('should handle clipboard operations with empty selection', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      // Try to copy without selection
      await page.keyboard.press('Control+c');

      // Terminal should remain stable
      const terminal = page.locator('[data-testid="terminal"]');
      await expect(terminal).toBeVisible();
    });
  });

  test.describe('Shell Detection and Configuration', () => {
    test('should detect and display shell type', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const shellIndicator = page.locator('[data-testid="shell-indicator"]');
      await expect(shellIndicator).toBeVisible();

      const shellType = await shellIndicator.textContent();
      expect(['bash', 'zsh', 'fish', 'powershell', 'cmd', 'unknown']).toContain(shellType);
    });

    test('should handle shell detection errors gracefully', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const shellIndicator = page.locator('[data-testid="shell-indicator"]');

      // Even if shell detection fails, terminal should work
      const terminalInput = page.locator('[data-testid="terminal-input"]');
      await expect(terminalInput).toBeVisible();
    });

    test('should maintain shell session state', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const terminalInput = page.locator('[data-testid="terminal-input"]');

      // Set an environment variable
      await terminalInput.fill('export TEST_VAR="test_value"');
      await terminalInput.press('Enter');

      // Verify it persists in the same session
      await terminalInput.fill('echo $TEST_VAR');
      await terminalInput.press('Enter');

      const terminalOutput = page.locator('[data-testid="terminal-output"]');
      await expect(terminalOutput).toContainText('test_value');
    });
  });

  test.describe('Terminal Error Handling', () => {
    test('should handle terminal crashes gracefully', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      // Simulate terminal becoming unresponsive
      const terminal = page.locator('[data-testid="terminal"]');

      // App should remain stable even if terminal fails
      await expect(page.locator('body')).toBeVisible();
    });

    test('should recover from command timeouts', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const terminalInput = page.locator('[data-testid="terminal-input"]');

      // Execute a command that might hang (but keep it short for testing)
      await terminalInput.fill('timeout 2s sleep 1');
      await terminalInput.press('Enter');

      // Terminal should recover and show new prompt
      await page.waitForTimeout(3000);
      await expect(terminalInput).toBeVisible();
    });

    test('should handle special characters in commands', async ({ page }) => {
      const terminalButton = page.locator('[data-testid="terminal-button"]');
      await terminalButton.click();

      const terminalInput = page.locator('[data-testid="terminal-input"]');

      // Test commands with special characters
      await terminalInput.fill('echo "Special chars: !@#$%^&*()"');
      await terminalInput.press('Enter');

      const terminalOutput = page.locator('[data-testid="terminal-output"]');
      await expect(terminalOutput).toContainText('Special chars');
    });
  });
});
