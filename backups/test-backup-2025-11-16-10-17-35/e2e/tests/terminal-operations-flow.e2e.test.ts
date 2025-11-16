/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { test, expect } from '@playwright/test';

/**
 * Tests E2E para flujo completo de operaciones del terminal en MintMind
 *
 * Estos tests validan el flujo completo de usuario para ejecutar comandos,
 * gestionar procesos y usar herramientas de desarrollo desde el terminal.
 */

test.describe('MintMind - Flujo de Operaciones del Terminal E2E', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:3000');
    await expect(page).toHaveTitle(/MintMind/);
    await page.waitForSelector('[data-testid="main-content"]', { timeout: 10000 });
  });

  test('debe permitir abrir y usar terminal básico', async ({ page }) => {
    // Abrir panel del terminal
    const terminalButton = page.locator('[data-testid="terminal-toggle"]');
    await expect(terminalButton).toBeVisible();
    await terminalButton.click();

    // Verificar que el terminal se abre
    const terminalPanel = page.locator('[data-testid="terminal-panel"]');
    await expect(terminalPanel).toBeVisible();

    // Verificar prompt del shell
    const terminalContent = page.locator('[data-testid="terminal-content"]');
    await expect(terminalContent).toBeVisible();

    // Ejecutar comando básico
    await page.keyboard.type('echo "Hello from MintMind"');
    await page.keyboard.press('Enter');

    // Esperar y verificar salida
    await page.waitForTimeout(1000);
    await expect(terminalContent).toContainText('Hello from MintMind');

    // Verificar que el prompt vuelve a aparecer
    const prompt = terminalContent.locator('[data-testid="terminal-prompt"]');
    await expect(prompt).toBeVisible();
  });

  test('debe manejar navegación por directorios', async ({ page }) => {
    // Abrir terminal
    const terminalButton = page.locator('[data-testid="terminal-toggle"]');
    await terminalButton.click();

    const terminalContent = page.locator('[data-testid="terminal-content"]');
    await page.waitForTimeout(500);

    // Verificar directorio actual
    await page.keyboard.type('pwd');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // El directorio actual debería contener algo
    await expect(terminalContent).toContainText('/');

    // Cambiar a directorio home
    await page.keyboard.press('Control+c'); // Limpiar línea
    await page.keyboard.type('cd ~');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Verificar cambio de directorio
    await page.keyboard.type('pwd');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Debería mostrar directorio home
    await expect(terminalContent).toContainText('home');

    // Crear y navegar a un directorio de prueba
    await page.keyboard.type('mkdir test-dir && cd test-dir');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    await page.keyboard.type('pwd');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    await expect(terminalContent).toContainText('test-dir');

    // Limpiar
    await page.keyboard.type('cd .. && rm -rf test-dir');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
  });

  test('debe ejecutar comandos de desarrollo comunes', async ({ page }) => {
    // Abrir terminal
    const terminalButton = page.locator('[data-testid="terminal-toggle"]');
    await terminalButton.click();

    const terminalContent = page.locator('[data-testid="terminal-content"]');
    await page.waitForTimeout(500);

    // Probar comandos de Node.js/npm
    const devCommands = [
      { command: 'node --version', expected: 'v' },
      { command: 'npm --version', expected: /\d+\.\d+\.\d+/ },
      { command: 'echo "Test file" > test.txt', expected: '' },
      { command: 'cat test.txt', expected: 'Test file' },
      { command: 'ls -la', expected: /\w+/ },
    ];

    for (const { command, expected } of devCommands) {
      await page.keyboard.press('Control+c'); // Limpiar línea
      await page.keyboard.type(command);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);

      if (expected) {
        if (typeof expected === 'string') {
          await expect(terminalContent).toContainText(expected);
        } else {
          await expect(terminalContent).toContainText(expected);
        }
      }
    }

    // Limpiar archivo de prueba
    await page.keyboard.type('rm test.txt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
  });

  test('debe manejar múltiples terminales', async ({ page }) => {
    // Abrir primer terminal
    const terminalButton = page.locator('[data-testid="terminal-toggle"]');
    await terminalButton.click();

    const terminalPanel = page.locator('[data-testid="terminal-panel"]');
    await expect(terminalPanel).toBeVisible();

    // Crear nuevo terminal (split)
    const newTerminalButton = page.locator('[data-testid="new-terminal-button"]');
    if (await newTerminalButton.isVisible()) {
      await newTerminalButton.click();

      // Verificar que hay múltiples terminales
      const terminals = page.locator('[data-testid="terminal-instance"]');
      await expect(terminals).toHaveCount(2);

      // Ejecutar comandos diferentes en cada terminal
      const firstTerminal = terminals.nth(0);
      const secondTerminal = terminals.nth(1);

      // Primer terminal
      await firstTerminal.click();
      await page.keyboard.type('echo "Terminal 1"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);

      // Segundo terminal
      await secondTerminal.click();
      await page.keyboard.type('echo "Terminal 2"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);

      // Verificar contenido independiente
      await expect(firstTerminal).toContainText('Terminal 1');
      await expect(secondTerminal).toContainText('Terminal 2');
    }
  });

  test('debe manejar comandos largos y multilinea', async ({ page }) => {
    // Abrir terminal
    const terminalButton = page.locator('[data-testid="terminal-toggle"]');
    await terminalButton.click();

    const terminalContent = page.locator('[data-testid="terminal-content"]');
    await page.waitForTimeout(500);

    // Comando multilinea con \
    const multilineCommand = `echo "Line 1" && \\
echo "Line 2" && \\
echo "Line 3"`;

    await page.keyboard.type(multilineCommand);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Verificar todas las líneas de salida
    await expect(terminalContent).toContainText('Line 1');
    await expect(terminalContent).toContainText('Line 2');
    await expect(terminalContent).toContainText('Line 3');

    // Probar script más complejo
    await page.keyboard.press('Control+c');
    const scriptCommand = `
for i in {1..3}; do
  echo "Iteration \$i"
done
`;
    await page.keyboard.type(scriptCommand);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    await expect(terminalContent).toContainText('Iteration 1');
    await expect(terminalContent).toContainText('Iteration 2');
    await expect(terminalContent).toContainText('Iteration 3');
  });

  test('debe manejar operaciones de archivos desde terminal', async ({ page }) => {
    // Abrir terminal
    const terminalButton = page.locator('[data-testid="terminal-toggle"]');
    await terminalButton.click();

    const terminalContent = page.locator('[data-testid="terminal-content"]');
    await page.waitForTimeout(500);

    // Crear estructura de archivos de prueba
    const fileOperations = [
      'mkdir test-project',
      'cd test-project',
      'touch index.js styles.css README.md',
      'echo \'console.log("Hello World");\' > index.js',
      'echo \'body { color: blue; }\' > styles.css',
      'ls -la',
      'cat index.js',
      'cat styles.css',
      'cd ..',
      'rm -rf test-project'
    ];

    for (const command of fileOperations) {
      await page.keyboard.press('Control+c');
      await page.keyboard.type(command);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Verificar operaciones exitosas
    await expect(terminalContent).toContainText('Hello World');
    await expect(terminalContent).toContainText('color: blue');
    await expect(terminalContent).toContainText('index.js');
    await expect(terminalContent).toContainText('styles.css');
    await expect(terminalContent).toContainText('README.md');
  });

  test('debe manejar control de procesos (foreground/background)', async ({ page }) => {
    // Abrir terminal
    const terminalButton = page.locator('[data-testid="terminal-toggle"]');
    await terminalButton.click();

    const terminalContent = page.locator('[data-testid="terminal-content"]');
    await page.waitForTimeout(500);

    // Probar comando en background
    await page.keyboard.type('sleep 5 &');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Verificar que el prompt vuelve inmediatamente (proceso en background)
    const prompt = page.locator('[data-testid="terminal-prompt"]');
    await expect(prompt).toBeVisible();

    // Probar job control
    await page.keyboard.type('jobs');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Probar Ctrl+C para interrumpir proceso
    await page.keyboard.type('sleep 10');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.press('Control+c');
    await page.waitForTimeout(500);

    // Verificar que se interrumpió y prompt vuelve
    await expect(prompt).toBeVisible();
  });

  test('debe manejar redirección y pipes', async ({ page }) => {
    // Abrir terminal
    const terminalButton = page.locator('[data-testid="terminal-toggle"]');
    await terminalButton.click();

    const terminalContent = page.locator('[data-testid="terminal-content"]');
    await page.waitForTimeout(500);

    // Probar pipes básicos
    await page.keyboard.type('echo "hello world" | tr a-z A-Z');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    await expect(terminalContent).toContainText('HELLO WORLD');

    // Probar redirección de salida
    await page.keyboard.press('Control+c');
    await page.keyboard.type('ls -la > directory_listing.txt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Verificar archivo creado
    await page.keyboard.type('cat directory_listing.txt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    await expect(terminalContent).toContainText(/\w+/); // Contenido del listado

    // Limpiar
    await page.keyboard.type('rm directory_listing.txt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
  });

  test('debe manejar variables de entorno', async ({ page }) => {
    // Abrir terminal
    const terminalButton = page.locator('[data-testid="terminal-toggle"]');
    await terminalButton.click();

    const terminalContent = page.locator('[data-testid="terminal-content"]');
    await page.waitForTimeout(500);

    // Verificar variables de entorno existentes
    await page.keyboard.type('echo $HOME');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    await expect(terminalContent).toContainText('/home');

    // Establecer variable personalizada
    await page.keyboard.press('Control+c');
    await page.keyboard.type('export MY_VAR="MintMind Test"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Verificar variable
    await page.keyboard.type('echo $MY_VAR');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    await expect(terminalContent).toContainText('MintMind Test');

    // Usar variable en comando
    await page.keyboard.type('echo "Project: $MY_VAR" > project.txt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('cat project.txt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    await expect(terminalContent).toContainText('Project: MintMind Test');

    // Limpiar
    await page.keyboard.type('unset MY_VAR && rm project.txt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
  });

  test('debe manejar herramientas de desarrollo (git, npm)', async ({ page }) => {
    // Abrir terminal
    const terminalButton = page.locator('[data-testid="terminal-toggle"]');
    await terminalButton.click();

    const terminalContent = page.locator('[data-testid="terminal-content"]');
    await page.waitForTimeout(500);

    // Probar comandos de git (si está disponible)
    const gitCommands = [
      'git --version',
      'git init test-repo',
      'cd test-repo',
      'echo "# Test Project" > README.md',
      'git add README.md',
      'git -c user.email="test@example.com" -c user.name="Test User" commit -m "Initial commit"',
      'git log --oneline',
      'cd ..',
      'rm -rf test-repo'
    ];

    for (const command of gitCommands) {
      await page.keyboard.press('Control+c');
      await page.keyboard.type(command);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Verificar que git funcionó (al menos la versión)
    await expect(terminalContent).toContainText('git version');

    // Probar comandos de npm (si está disponible)
    const npmCommands = [
      'npm --version',
      'mkdir npm-test && cd npm-test',
      'npm init -y',
      'npm install lodash --save',
      'ls node_modules | head -5',
      'cd .. && rm -rf npm-test'
    ];

    for (const command of npmCommands) {
      await page.keyboard.press('Control+c');
      await page.keyboard.type(command);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }
  });

  test('debe manejar búsqueda y navegación de historial', async ({ page }) => {
    // Abrir terminal
    const terminalButton = page.locator('[data-testid="terminal-toggle"]');
    await terminalButton.click();

    const terminalContent = page.locator('[data-testid="terminal-content"]');
    await page.waitForTimeout(500);

    // Ejecutar varios comandos para poblar historial
    const commands = [
      'echo "command 1"',
      'echo "command 2"',
      'echo "command 3"',
      'ls -la',
      'pwd'
    ];

    for (const command of commands) {
      await page.keyboard.press('Control+c');
      await page.keyboard.type(command);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Navegar historial con flecha arriba
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');

    // El último comando debería aparecer
    await expect(terminalContent).toContainText('pwd');

    // Ejecutar comando del historial
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Verificar que se ejecutó nuevamente
    const outputs = terminalContent.locator('text=pwd');
    await expect(outputs).toHaveCount(2); // Original + desde historial
  });

  test('debe manejar errores y códigos de salida', async ({ page }) => {
    // Abrir terminal
    const terminalButton = page.locator('[data-testid="terminal-toggle"]');
    await terminalButton.click();

    const terminalContent = page.locator('[data-testid="terminal-content"]');
    await page.waitForTimeout(500);

    // Comando que falla
    await page.keyboard.type('nonexistentcommand');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Verificar mensaje de error
    await expect(terminalContent).toContainText(/command not found|not recognized/i);

    // Verificar código de salida
    await page.keyboard.press('Control+c');
    await page.keyboard.type('echo $?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Código de salida debería ser diferente de 0
    await expect(terminalContent).toContainText(/[1-9]/);

    // Comando exitoso
    await page.keyboard.type('echo "success"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    await page.keyboard.type('echo $?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Código de salida debería ser 0
    await expect(terminalContent).toContainText('0');
  });

  test('debe manejar resize y scroll del terminal', async ({ page }) => {
    // Abrir terminal
    const terminalButton = page.locator('[data-testid="terminal-toggle"]');
    await terminalButton.click();

    const terminalPanel = page.locator('[data-testid="terminal-panel"]');
    await expect(terminalPanel).toBeVisible();

    // Generar mucho output para probar scroll
    await page.keyboard.type('for i in {1..50}; do echo "Line $i"; done');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Verificar que hay scroll (últimas líneas visibles)
    const terminalContent = page.locator('[data-testid="terminal-content"]');
    await expect(terminalContent).toContainText('Line 50');

    // Probar scroll manual
    const scrollUpButton = page.locator('[data-testid="terminal-scroll-up"]');
    if (await scrollUpButton.isVisible()) {
      await scrollUpButton.click();
      // Verificar que podemos ver líneas anteriores
      await expect(terminalContent).toContainText('Line 1');
    }

    // Probar resize del panel
    const resizeHandle = page.locator('[data-testid="terminal-resize-handle"]');
    if (await resizeHandle.isVisible()) {
      const originalSize = await terminalPanel.boundingBox();
      await resizeHandle.dragTo(terminalPanel, { targetPosition: { x: 0, y: -50 } });
      const newSize = await terminalPanel.boundingBox();

      // Verificar que el tamaño cambió
      expect(newSize?.height).not.toBe(originalSize?.height);
    }
  });
});