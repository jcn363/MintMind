/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { test, expect } from '@playwright/test';

/**
 * Tests E2E para flujo completo de integración del terminal en MintMind
 *
 * Estos tests validan el flujo completo de usuario para usar el terminal
 * integrado, incluyendo comandos, gestión de procesos y integración con editor.
 */

test.describe('MintMind - Flujo de Integración del Terminal E2E', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:3000');
    await expect(page).toHaveTitle(/MintMind/);
    await page.waitForSelector('[data-testid="main-content"]', { timeout: 10000 });
  });

  test('debe abrir y usar terminal básico', async ({ page }) => {
    // Abrir panel del terminal
    const terminalToggle = page.locator('[data-testid="terminal-toggle"]');
    await expect(terminalToggle).toBeVisible();
    await terminalToggle.click();

    // Verificar que el terminal se abre
    const terminalPanel = page.locator('[data-testid="terminal-panel"]');
    await expect(terminalPanel).toBeVisible();

    // Verificar elementos básicos del terminal
    const terminalInput = page.locator('[data-testid="terminal-input"]');
    const terminalOutput = page.locator('[data-testid="terminal-output"]');
    await expect(terminalInput).toBeVisible();
    await expect(terminalOutput).toBeVisible();

    // Ejecutar comando básico
    await terminalInput.fill('echo "Hello from MintMind"');
    await page.keyboard.press('Enter');

    // Verificar salida
    await expect(terminalOutput).toContainText('Hello from MintMind');

    // Verificar prompt del terminal
    const terminalPrompt = page.locator('[data-testid="terminal-prompt"]');
    await expect(terminalPrompt).toBeVisible();
  });

  test('debe ejecutar comandos del sistema operativo', async ({ page }) => {
    // Abrir terminal
    const terminalToggle = page.locator('[data-testid="terminal-toggle"]');
    await terminalToggle.click();

    const terminalInput = page.locator('[data-testid="terminal-input"]');

    // Ejecutar comando ls (Unix/Mac) o dir (Windows)
    const listCommand = process.platform === 'win32' ? 'dir' : 'ls -la';
    await terminalInput.fill(listCommand);
    await page.keyboard.press('Enter');

    // Esperar salida y verificar que contiene archivos/directorios
    const terminalOutput = page.locator('[data-testid="terminal-output"]');
    await page.waitForTimeout(1000); // Esperar procesamiento
    const outputText = await terminalOutput.textContent();
    expect(outputText?.length).toBeGreaterThan(0);
  });

  test('debe manejar múltiples sesiones de terminal', async ({ page }) => {
    // Abrir primera sesión de terminal
    const terminalToggle = page.locator('[data-testid="terminal-toggle"]');
    await terminalToggle.click();

    // Crear nueva sesión/pestaña de terminal
    const newTerminalTab = page.locator('[data-testid="new-terminal-tab"]');
    await expect(newTerminalTab).toBeVisible();
    await newTerminalTab.click();

    // Verificar que hay múltiples pestañas
    const terminalTabs = page.locator('[data-testid="terminal-tab"]');
    await expect(terminalTabs).toHaveCount(2);

    // Cambiar entre pestañas
    const secondTab = terminalTabs.nth(1);
    await secondTab.click();

    // Ejecutar comando en segunda pestaña
    const terminalInput = page.locator('[data-testid="terminal-input"]');
    await terminalInput.fill('pwd');
    await page.keyboard.press('Enter');

    // Verificar que funciona independientemente
    const terminalOutput = page.locator('[data-testid="terminal-output"]');
    await expect(terminalOutput).toBeVisible();
  });

  test('debe integrar terminal con sistema de archivos', async ({ page }) => {
    // Abrir terminal
    const terminalToggle = page.locator('[data-testid="terminal-toggle"]');
    await terminalToggle.click();

    const terminalInput = page.locator('[data-testid="terminal-input"]');

    // Crear directorio desde terminal
    const testDir = 'test_terminal_dir';
    await terminalInput.fill(`mkdir ${testDir}`);
    await page.keyboard.press('Enter');

    // Verificar que el directorio aparece en el explorador de archivos
    const fileExplorer = page.locator('[data-testid="file-explorer"]');
    await page.waitForTimeout(500); // Esperar actualización del filesystem
    await expect(fileExplorer).toContainText(testDir);

    // Cambiar al directorio creado
    await terminalInput.fill(`cd ${testDir}`);
    await page.keyboard.press('Enter');

    // Verificar cambio de directorio
    await terminalInput.fill('pwd');
    await page.keyboard.press('Enter');

    const terminalOutput = page.locator('[data-testid="terminal-output"]');
    await expect(terminalOutput).toContainText(testDir);

    // Limpiar: eliminar directorio
    await terminalInput.fill('cd ..');
    await page.keyboard.press('Enter');
    await terminalInput.fill(`rmdir ${testDir}`);
    await page.keyboard.press('Enter');
  });

  test('debe ejecutar comandos de desarrollo comunes', async ({ page }) => {
    // Abrir terminal
    const terminalToggle = page.locator('[data-testid="terminal-toggle"]');
    await terminalToggle.click();

    const terminalInput = page.locator('[data-testid="terminal-input"]');
    const terminalOutput = page.locator('[data-testid="terminal-output"]');

    // Ejecutar comandos de desarrollo comunes
    const devCommands = [
      'node --version',
      'npm --version',
      'git --version'
    ];

    for (const command of devCommands) {
      await terminalInput.fill(command);
      await page.keyboard.press('Enter');

      // Verificar que hay salida (versión o mensaje de error esperado)
      await page.waitForTimeout(1000);
      const outputText = await terminalOutput.textContent();
      expect(outputText?.length).toBeGreaterThan(0);
    }
  });

  test('debe manejar comandos multilinea', async ({ page }) => {
    // Abrir terminal
    const terminalToggle = page.locator('[data-testid="terminal-toggle"]');
    await terminalToggle.click();

    const terminalInput = page.locator('[data-testid="terminal-input"]');

    // Crear script multilinea
    const multilineScript = [
      'cat << \'EOF\' > test_script.sh',
      '#!/bin/bash',
      'echo "Script ejecutado correctamente"',
      'echo "Parámetro recibido: $1"',
      'EOF'
    ];

    // Ejecutar cada línea
    for (const line of multilineScript) {
      await terminalInput.fill(line);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200); // Pequeña pausa entre líneas
    }

    // Ejecutar el script creado
    await terminalInput.fill('chmod +x test_script.sh');
    await page.keyboard.press('Enter');
    await terminalInput.fill('./test_script.sh "Hello World"');
    await page.keyboard.press('Enter');

    // Verificar salida del script
    const terminalOutput = page.locator('[data-testid="terminal-output"]');
    await expect(terminalOutput).toContainText('Script ejecutado correctamente');
    await expect(terminalOutput).toContainText('Parámetro recibido: Hello World');
  });

  test('debe manejar procesos en background', async ({ page }) => {
    // Abrir terminal
    const terminalToggle = page.locator('[data-testid="terminal-toggle"]');
    await terminalToggle.click();

    const terminalInput = page.locator('[data-testid="terminal-input"]');

    // Ejecutar proceso en background simulado
    // Nota: En un entorno de prueba real, usaríamos un servidor simple
    await terminalInput.fill('echo "Background process started" &');
    await page.keyboard.press('Enter');

    // Verificar que el terminal sigue disponible para nuevos comandos
    await terminalInput.fill('echo "Terminal still responsive"');
    await page.keyboard.press('Enter');

    const terminalOutput = page.locator('[data-testid="terminal-output"]');
    await expect(terminalOutput).toContainText('Background process started');
    await expect(terminalOutput).toContainText('Terminal still responsive');
  });

  test('debe integrar con el editor mediante comandos', async ({ page }) => {
    // Abrir editor y crear archivo
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    // Abrir terminal
    const terminalToggle = page.locator('[data-testid="terminal-toggle"]');
    await terminalToggle.click();

    const terminalInput = page.locator('[data-testid="terminal-input"]');

    // Usar comandos que interactúan con archivos del editor
    await terminalInput.fill('echo "Generated from terminal" > generated.txt');
    await page.keyboard.press('Enter');

    await terminalInput.fill('cat generated.txt');
    await page.keyboard.press('Enter');

    // Verificar que el archivo aparece en el explorador
    const fileExplorer = page.locator('[data-testid="file-explorer"]');
    await expect(fileExplorer).toContainText('generated.txt');

    // Verificar contenido mostrado en terminal
    const terminalOutput = page.locator('[data-testid="terminal-output"]');
    await expect(terminalOutput).toContainText('Generated from terminal');
  });

  test('debe manejar errores de comandos', async ({ page }) => {
    // Abrir terminal
    const terminalToggle = page.locator('[data-testid="terminal-toggle"]');
    await terminalToggle.click();

    const terminalInput = page.locator('[data-testid="terminal-input"]');
    const terminalOutput = page.locator('[data-testid="terminal-output"]');

    // Ejecutar comando que no existe
    await terminalInput.fill('nonexistentcommand');
    await page.keyboard.press('Enter');

    // Verificar mensaje de error
    await page.waitForTimeout(1000);
    const outputText = await terminalOutput.textContent();
    expect(outputText?.toLowerCase()).toMatch(/command not found|no such file|error/i);

    // Ejecutar comando con sintaxis inválida
    await terminalInput.fill('ls --invalidflag');
    await page.keyboard.press('Enter');

    // Verificar error de sintaxis
    await page.waitForTimeout(1000);
    const errorOutput = await terminalOutput.textContent();
    expect(errorOutput?.length).toBeGreaterThan(0);
  });

  test('debe personalizar apariencia del terminal', async ({ page }) => {
    // Abrir terminal
    const terminalToggle = page.locator('[data-testid="terminal-toggle"]');
    await terminalToggle.click();

    // Abrir configuración del terminal
    const terminalConfigButton = page.locator('[data-testid="terminal-config-button"]');
    if (await terminalConfigButton.isVisible()) {
      await terminalConfigButton.click();

      // Verificar opciones de configuración
      const fontSizeSelect = page.locator('[data-testid="terminal-font-size"]');
      const themeSelect = page.locator('[data-testid="terminal-theme"]');
      const cursorStyleSelect = page.locator('[data-testid="terminal-cursor-style"]');

      // Cambiar configuración si está disponible
      if (await fontSizeSelect.isVisible()) {
        await fontSizeSelect.selectOption('14');
      }

      if (await themeSelect.isVisible()) {
        await themeSelect.selectOption('dark');
      }

      if (await cursorStyleSelect.isVisible()) {
        await cursorStyleSelect.selectOption('block');
      }

      // Verificar que el terminal refleja los cambios
      const terminalPanel = page.locator('[data-testid="terminal-panel"]');
      await expect(terminalPanel).toBeVisible();
    }
  });

  test('debe manejar atajos de teclado del terminal', async ({ page }) => {
    // Abrir terminal
    const terminalToggle = page.locator('[data-testid="terminal-toggle"]');
    await terminalToggle.click();

    const terminalInput = page.locator('[data-testid="terminal-input"]');

    // Escribir parcialmente un comando
    await terminalInput.fill('ech');

    // Usar autocompletado (Ctrl+Space si está implementado)
    await page.keyboard.press('Control+Space');

    // Verificar que se muestra sugerencias o completa el comando
    const suggestions = page.locator('[data-testid="terminal-suggestions"]');
    if (await suggestions.isVisible()) {
      await expect(suggestions).toContainText('echo');
    }

    // Limpiar línea (Ctrl+C)
    await page.keyboard.press('Control+c');

    // Verificar que la línea está limpia
    const inputValue = await terminalInput.inputValue();
    expect(inputValue).toBe('');
  });

  test('debe mantener historial de comandos', async ({ page }) => {
    // Abrir terminal
    const terminalToggle = page.locator('[data-testid="terminal-toggle"]');
    await terminalToggle.click();

    const terminalInput = page.locator('[data-testid="terminal-input"]');

    // Ejecutar varios comandos
    const commands = ['echo "first"', 'echo "second"', 'ls', 'pwd'];
    for (const command of commands) {
      await terminalInput.fill(command);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
    }

    // Navegar por historial con flecha arriba
    await page.keyboard.press('ArrowUp');
    let inputValue = await terminalInput.inputValue();
    expect(inputValue).toBe('pwd');

    await page.keyboard.press('ArrowUp');
    inputValue = await terminalInput.inputValue();
    expect(inputValue).toBe('ls');

    await page.keyboard.press('ArrowUp');
    inputValue = await terminalInput.inputValue();
    expect(inputValue).toBe('echo "second"');
  });

  test('debe manejar comandos de terminal largos', async ({ page }) => {
    // Abrir terminal
    const terminalToggle = page.locator('[data-testid="terminal-toggle"]');
    await terminalToggle.click();

    const terminalInput = page.locator('[data-testid="terminal-input"]');

    // Crear comando muy largo
    const longCommand = 'echo "' + 'x'.repeat(1000) + '"';
    await terminalInput.fill(longCommand);
    await page.keyboard.press('Enter');

    // Verificar que se ejecuta correctamente
    const terminalOutput = page.locator('[data-testid="terminal-output"]');
    await page.waitForTimeout(1000);
    const outputText = await terminalOutput.textContent();
    expect(outputText?.length).toBeGreaterThan(1000);
  });

  test('debe integrar con herramientas de desarrollo externas', async ({ page }) => {
    // Abrir terminal
    const terminalToggle = page.locator('[data-testid="terminal-toggle"]');
    await terminalToggle.click();

    const terminalInput = page.locator('[data-testid="terminal-input"]');
    const terminalOutput = page.locator('[data-testid="terminal-output"]');

    // Intentar ejecutar herramientas externas comunes
    const externalTools = [
      'docker --version',
      'git status',
      'python --version',
      'java -version'
    ];

    for (const tool of externalTools) {
      await terminalInput.fill(tool);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000); // Esperar herramientas externas

      // Verificar que hay alguna respuesta (versión o error de "no encontrado")
      const outputText = await terminalOutput.textContent();
      expect(outputText?.length).toBeGreaterThan(0);
    }
  });
});