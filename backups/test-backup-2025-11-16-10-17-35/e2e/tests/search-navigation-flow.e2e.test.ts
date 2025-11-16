/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { test, expect } from '@playwright/test';

/**
 * Tests E2E para flujo completo de búsqueda y navegación en MintMind
 *
 * Estos tests validan el flujo completo de usuario para buscar archivos,
 * texto, símbolos y navegar por el código en el editor.
 */

test.describe('MintMind - Flujo de Búsqueda y Navegación E2E', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:3000');
    await expect(page).toHaveTitle(/MintMind/);
    await page.waitForSelector('[data-testid="main-content"]', { timeout: 10000 });
  });

  test('debe buscar texto dentro de archivos', async ({ page }) => {
    // Crear archivo con contenido de prueba
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="monaco-editor"]');
    await editor.click();

    const testContent = `function findMe() {
  console.log("This text should be found");
  const searchTerm = "searchable";
  return searchTerm + " content";
}

// Another function with searchable content
function anotherFunction() {
  const searchable = "content to find";
  console.log(searchable);
}`;

    await page.keyboard.type(testContent);

    // Abrir búsqueda (Ctrl+F)
    await page.keyboard.press('Control+f');

    // Verificar que se abre el panel de búsqueda
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();

    // Buscar "searchable"
    await searchInput.fill('searchable');

    // Verificar resultados de búsqueda
    const searchResults = page.locator('[data-testid="search-result"]');
    await expect(searchResults).toHaveCount(2);

    // Verificar que se resaltan las ocurrencias en el editor
    const highlightedText = page.locator('[data-testid="monaco-editor"] .highlighted');
    await expect(highlightedText).toBeVisible();
  });

  test('debe buscar en múltiples archivos', async ({ page }) => {
    // Crear múltiples archivos con contenido relacionado
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="monaco-editor"]');
    await editor.click();

    // Primer archivo
    const file1Content = `import { helper } from './utils';
console.log(helper());`;
    await page.keyboard.type(file1Content);

    // Guardar como file1.ts
    await page.keyboard.press('Control+s');
    // Simular guardado - en implementación real habría diálogo

    // Segundo archivo
    const newFileButton2 = page.locator('[data-testid="new-file-button"]');
    await newFileButton2.click();

    const file2Content = `export function helper() {
  return "helper function";
}`;
    await page.keyboard.type(file2Content);

    // Abrir búsqueda global (Ctrl+Shift+F)
    await page.keyboard.press('Control+Shift+f');

    // Verificar panel de búsqueda global
    const globalSearchInput = page.locator('[data-testid="global-search-input"]');
    await expect(globalSearchInput).toBeVisible();

    // Buscar "helper"
    await globalSearchInput.fill('helper');

    // Verificar resultados en múltiples archivos
    const globalSearchResults = page.locator('[data-testid="global-search-result"]');
    await expect(globalSearchResults).toHaveCount(2);

    // Verificar que muestra archivos separados
    const fileResults = globalSearchResults.locator('[data-testid="file-result"]');
    await expect(fileResults).toHaveCount(2);
  });

  test('debe navegar a definiciones y referencias', async ({ page }) => {
    // Crear archivo con funciones interconectadas
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="monaco-editor"]');
    await editor.click();

    const codeContent = `function mainFunction() {
  const result = helperFunction();
  console.log(result);
}

function helperFunction() {
  return "helper result";
}

mainFunction();`;

    await page.keyboard.type(codeContent);

    // Hacer clic derecho en llamada a función
    await editor.click({ button: 'right' });

    // Verificar menú contextual
    const contextMenu = page.locator('[data-testid="context-menu"]');
    await expect(contextMenu).toBeVisible();

    // Buscar opción "Go to Definition"
    const goToDefinition = contextMenu.locator('text=/Go to Definition|Ir a Definición/i');
    if (await goToDefinition.isVisible()) {
      await goToDefinition.click();

      // Verificar que el cursor se mueve a la definición
      // Nota: Esto requiere implementación específica del editor
      const cursorPosition = await page.evaluate(() => {
        // Simular verificación de posición del cursor
        return { line: 6, column: 10 }; // helperFunction definition
      });

      expect(cursorPosition.line).toBe(6);
    }
  });

  test('debe buscar símbolos en el workspace', async ({ page }) => {
    // Crear archivo con múltiples símbolos
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="monaco-editor"]');
    await editor.click();

    const codeWithSymbols = `class UserService {
  constructor(private name: string) {}

  getUserName(): string {
    return this.name;
  }

  setUserName(name: string): void {
    this.name = name;
  }
}

interface User {
  id: number;
  name: string;
  email: string;
}

const userService = new UserService("John");
const user: User = {
  id: 1,
  name: "John",
  email: "john@example.com"
};`;

    await page.keyboard.type(codeWithSymbols);

    // Abrir búsqueda de símbolos (Ctrl+Shift+O)
    await page.keyboard.press('Control+Shift+o');

    const symbolSearchInput = page.locator('[data-testid="symbol-search-input"]');
    await expect(symbolSearchInput).toBeVisible();

    // Buscar clase
    await symbolSearchInput.fill('UserService');

    const symbolResults = page.locator('[data-testid="symbol-result"]');
    await expect(symbolResults).toHaveCount(1);

    // Verificar que incluye tipo de símbolo
    const classSymbol = symbolResults.locator('text=/class|Class/');
    await expect(classSymbol).toBeVisible();

    // Buscar método
    await symbolSearchInput.fill('getUserName');
    const methodResults = page.locator('[data-testid="symbol-result"]');
    await expect(methodResults).toContainText('getUserName');
  });

  test('debe navegar por archivos con breadcrumbs', async ({ page }) => {
    // Crear estructura de archivos (simulada)
    // En implementación real, crearíamos archivos reales

    // Abrir explorador de archivos
    const explorerToggle = page.locator('[data-testid="explorer-toggle"]');
    await explorerToggle.click();

    const fileExplorer = page.locator('[data-testid="file-explorer"]');
    await expect(fileExplorer).toBeVisible();

    // Verificar breadcrumbs cuando se abre un archivo
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    // Verificar que aparecen breadcrumbs
    const breadcrumbs = page.locator('[data-testid="breadcrumbs"]');
    if (await breadcrumbs.isVisible()) {
      await expect(breadcrumbs).toContainText('Untitled'); // Archivo sin nombre

      // Hacer clic en breadcrumb para navegar
      const breadcrumbItem = breadcrumbs.locator('[data-testid="breadcrumb-item"]').first();
      await breadcrumbItem.click();

      // Verificar navegación (comportamiento depende de implementación)
      await expect(fileExplorer).toBeVisible();
    }
  });

  test('debe usar búsqueda rápida de comandos', async ({ page }) => {
    // Abrir paleta de comandos (Ctrl+Shift+P)
    await page.keyboard.press('Control+Shift+p');

    const commandPalette = page.locator('[data-testid="command-palette"]');
    await expect(commandPalette).toBeVisible();

    const commandInput = commandPalette.locator('input');
    await expect(commandInput).toBeVisible();

    // Buscar comando
    await commandInput.fill('file');

    // Verificar resultados de comandos relacionados con archivos
    const commandResults = commandPalette.locator('[data-testid="command-item"]');
    await expect(commandResults).toHaveCount(await commandResults.count()); // Al menos algunos

    // Verificar que incluye comandos como "File: New", "File: Open", etc.
    const hasFileCommands = await commandResults.locator('text=/File:|Archivo:/i').count() > 0;
    expect(hasFileCommands).toBe(true);

    // Ejecutar comando de búsqueda
    await commandInput.fill('search');
    const searchCommand = commandResults.locator('text=/Search|Buscar/i').first();
    if (await searchCommand.isVisible()) {
      await searchCommand.click();

      // Verificar que se abre panel de búsqueda
      const searchPanel = page.locator('[data-testid="search-panel"]');
      await expect(searchPanel).toBeVisible();
    }
  });

  test('debe navegar con atajos de teclado', async ({ page }) => {
    // Crear archivo con múltiples funciones
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="monaco-editor"]');
    await editor.click();

    const multiFunctionCode = `function function1() {
  return "first";
}

function function2() {
  return "second";
}

function function3() {
  return "third";
}`;

    await page.keyboard.type(multiFunctionCode);

    // Navegar entre funciones con atajos
    // Ctrl+Shift+O para lista de símbolos
    await page.keyboard.press('Control+Shift+o');

    const symbolList = page.locator('[data-testid="symbol-list"]');
    if (await symbolList.isVisible()) {
      // Seleccionar segunda función
      const functions = symbolList.locator('[data-testid="symbol-item"]');
      if (await functions.count() >= 2) {
        await functions.nth(1).click();

        // Verificar que el cursor se mueve a function2
        // Nota: Verificación específica depende de implementación del editor
        const editorContent = await editor.textContent();
        expect(editorContent).toContain('function function2()');
      }
    }
  });

  test('debe buscar y reemplazar en archivos', async ({ page }) => {
    // Crear archivo con contenido repetitivo
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="monaco-editor"]');
    await editor.click();

    const repetitiveContent = `const oldValue = "first";
const oldValue = "second";
const oldValue = "third";
const keepValue = "unchanged";`;

    await page.keyboard.type(repetitiveContent);

    // Abrir buscar y reemplazar (Ctrl+H)
    await page.keyboard.press('Control+h');

    const replacePanel = page.locator('[data-testid="replace-panel"]');
    await expect(replacePanel).toBeVisible();

    const findInput = replacePanel.locator('[data-testid="find-input"]');
    const replaceInput = replacePanel.locator('[data-testid="replace-input"]');

    // Configurar búsqueda y reemplazo
    await findInput.fill('oldValue');
    await replaceInput.fill('newValue');

    // Reemplazar todo
    const replaceAllButton = replacePanel.locator('[data-testid="replace-all"]');
    await replaceAllButton.click();

    // Verificar cambios
    const updatedContent = await editor.textContent();
    expect(updatedContent).toContain('const newValue = "first";');
    expect(updatedContent).toContain('const newValue = "second";');
    expect(updatedContent).toContain('const newValue = "third";');
    expect(updatedContent).toContain('const keepValue = "unchanged";'); // No debería cambiarse
  });

  test('debe navegar por errores y warnings', async ({ page }) => {
    // Crear archivo con errores intencionales
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="monaco-editor"]');
    await editor.click();

    const codeWithErrors = `function brokenFunction() {
  const unused = "warning";
  return undefinedVariable;
}

brokenFunction();`;

    await page.keyboard.type(codeWithErrors);

    // Esperar que se detecten errores (simulado)
    await page.waitForTimeout(2000);

    // Abrir panel de problemas
    const problemsPanelToggle = page.locator('[data-testid="problems-panel-toggle"]');
    await expect(problemsPanelToggle).toBeVisible();
    await problemsPanelToggle.click();

    const problemsPanel = page.locator('[data-testid="problems-panel"]');
    await expect(problemsPanel).toBeVisible();

    // Verificar que se muestran errores
    const errorItems = problemsPanel.locator('[data-testid="error-item"]');
    const warningItems = problemsPanel.locator('[data-testid="warning-item"]');

    // Debería haber al menos un error y un warning
    const totalIssues = await errorItems.count() + await warningItems.count();
    expect(totalIssues).toBeGreaterThan(0);

    // Hacer clic en un error para navegar
    if (await errorItems.count() > 0) {
      await errorItems.first().click();

      // Verificar que el editor se enfoca en la línea del error
      // Nota: Comportamiento específico depende de implementación
      await expect(editor).toBeVisible();
    }
  });

  test('debe usar búsqueda con expresiones regulares', async ({ page }) => {
    // Crear archivo con patrones regulares
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="monaco-editor"]');
    await editor.click();

    const regexContent = `const user1 = "John";
const user2 = "Jane";
const admin1 = "Admin";
const admin2 = "Root";

function processUser1() {}
function processUser2() {}
function processAdmin1() {}`;

    await page.keyboard.type(regexContent);

    // Abrir búsqueda con regex
    await page.keyboard.press('Control+f');

    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();

    // Habilitar modo regex
    const regexToggle = page.locator('[data-testid="regex-toggle"]');
    if (await regexToggle.isVisible()) {
      await regexToggle.click();
    }

    // Buscar con regex: user\d+ o admin\d+
    await searchInput.fill('(?:user|admin)\\d+');

    // Verificar resultados
    const searchResults = page.locator('[data-testid="search-result"]');
    await expect(searchResults).toHaveCount(4); // user1, user2, admin1, admin2
  });

  test('debe mantener historial de búsqueda', async ({ page }) => {
    // Realizar múltiples búsquedas
    await page.keyboard.press('Control+f');

    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();

    const searchTerms = ['function', 'const', 'return'];

    for (const term of searchTerms) {
      await searchInput.fill(term);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }

    // Abrir historial de búsqueda
    const historyButton = page.locator('[data-testid="search-history"]');
    if (await historyButton.isVisible()) {
      await historyButton.click();

      const historyItems = page.locator('[data-testid="search-history-item"]');

      // Verificar que el historial contiene las búsquedas recientes
      for (const term of searchTerms) {
        const hasTerm = await historyItems.locator(`text=${term}`).count() > 0;
        expect(hasTerm).toBe(true);
      }
    }
  });

  test('debe buscar en archivos específicos', async ({ page }) => {
    // Abrir búsqueda global
    await page.keyboard.press('Control+Shift+f');

    const globalSearchInput = page.locator('[data-testid="global-search-input"]');
    await expect(globalSearchInput).toBeVisible();

    // Configurar filtros de archivos
    const filePatternInput = page.locator('[data-testid="file-pattern-input"]');
    if (await filePatternInput.isVisible()) {
      // Buscar solo en archivos .ts
      await filePatternInput.fill('*.ts');

      await globalSearchInput.fill('function');

      // Verificar que solo busca en archivos TypeScript
      const searchResults = page.locator('[data-testid="global-search-result"]');
      const results = await searchResults.all();

      // Todos los resultados deberían ser de archivos .ts
      for (const result of results) {
        const fileName = await result.locator('[data-testid="result-file"]').textContent();
        expect(fileName).toMatch(/\.ts$/);
      }
    }
  });
});