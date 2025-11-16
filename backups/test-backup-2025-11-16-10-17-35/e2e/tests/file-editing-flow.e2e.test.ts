/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { test, expect } from '@playwright/test';

/**
 * Tests E2E para flujo completo de apertura y edición de archivos en MintMind
 *
 * Estos tests validan el flujo completo de usuario desde la apertura
 * de archivos hasta la edición y guardado, simulando interacciones reales.
 */

test.describe('MintMind - Flujo de Edición de Archivos E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Navegar a la aplicación antes de cada test
    await page.goto('http://127.0.0.1:3000');

    // Esperar que la aplicación cargue completamente
    await expect(page).toHaveTitle(/MintMind/);
    await page.waitForSelector('[data-testid="main-content"]', { timeout: 10000 });
  });

  test('debe permitir crear archivo nuevo y editarlo', async ({ page }) => {
    // Verificar que podemos crear un nuevo archivo
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await expect(newFileButton).toBeVisible();

    // Hacer clic en nuevo archivo
    await newFileButton.click();

    // Verificar que se abre un editor vacío
    const editor = page.locator('[data-testid="monaco-editor"]');
    await expect(editor).toBeVisible();

    // Verificar que el editor está vacío inicialmente
    const editorContent = await editor.textContent();
    expect(editorContent?.trim()).toBe('');

    // Simular escritura de código TypeScript
    const codeToType = `interface User {
  name: string;
  age: number;
  email: string;
}

const createUser = (name: string, age: number): User => {
  return {
    name,
    age,
    email: \`\${name.toLowerCase()}@example.com\`
  };
};

export { User, createUser };`;

    // Usar el teclado virtual de Playwright para escribir
    await editor.click(); // Enfocar el editor
    await page.keyboard.type(codeToType, { delay: 10 }); // Delay para simular escritura humana

    // Verificar que el contenido se escribió correctamente
    await expect(editor).toContainText('interface User');
    await expect(editor).toContainText('createUser');
    await expect(editor).toContainText('export { User, createUser }');

    // Verificar syntax highlighting (elementos coloreados)
    const keywordElements = page.locator('[data-testid="monaco-editor"] .mtk-keyword');
    await expect(keywordElements.first()).toBeVisible();

    // Guardar el archivo
    const saveButton = page.locator('[data-testid="save-file-button"]');
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Verificar notificación de guardado exitoso
    const saveNotification = page.locator('[data-testid="save-notification"]');
    await expect(saveNotification).toBeVisible();
    await expect(saveNotification).toContainText('Archivo guardado');

    // Verificar que el archivo aparece en el explorador
    const fileExplorer = page.locator('[data-testid="file-explorer"]');
    await expect(fileExplorer).toContainText('Untitled-1.ts'); // Archivo sin nombre guardado
  });

  test('debe permitir abrir archivo existente y editarlo', async ({ page }) => {
    // Abrir el explorador de archivos
    const explorerButton = page.locator('[data-testid="explorer-toggle"]');
    await expect(explorerButton).toBeVisible();
    await explorerButton.click();

    // Verificar que se muestra el explorador
    const fileExplorer = page.locator('[data-testid="file-explorer"]');
    await expect(fileExplorer).toBeVisible();

    // Buscar y hacer clic en un archivo existente (asumiendo que existe un README.md)
    const readmeFile = fileExplorer.locator('text=README.md').first();
    await expect(readmeFile).toBeVisible();
    await readmeFile.click();

    // Verificar que el archivo se abre en el editor
    const editor = page.locator('[data-testid="monaco-editor"]');
    await expect(editor).toBeVisible();

    // Verificar que contiene contenido
    await expect(editor).not.toHaveText('');

    // Seleccionar una porción de texto y reemplazarla
    await page.keyboard.press('Control+a'); // Seleccionar todo
    await page.keyboard.press('Delete'); // Borrar todo

    // Escribir nuevo contenido
    const newContent = `# MintMind Editor

Una poderosa herramienta de edición de código con capacidades avanzadas.

## Características

- Editor Monaco integrado
- Soporte para múltiples lenguajes
- Extensiones personalizables
- Terminal integrado
- Control de versiones Git

## Uso

\`\`\`typescript
const editor = new MintMindEditor();
editor.openFile('example.ts');
\`\`\``;

    await page.keyboard.type(newContent, { delay: 5 });

    // Verificar el contenido nuevo
    await expect(editor).toContainText('# MintMind Editor');
    await expect(editor).toContainText('## Características');
    await expect(editor).toContainText('```typescript');

    // Verificar que el syntax highlighting funciona para Markdown
    const headingElements = page.locator('[data-testid="monaco-editor"] .mtk-heading');
    await expect(headingElements.first()).toBeVisible();

    // Guardar cambios
    await page.keyboard.press('Control+s');

    // Verificar guardado automático
    const dirtyIndicator = page.locator('[data-testid="file-dirty-indicator"]');
    await expect(dirtyIndicator).not.toBeVisible(); // Indicador de cambios pendientes debería desaparecer
  });

  test('debe manejar edición colaborativa básica', async ({ browser }) => {
    // Crear dos contextos de navegador para simular edición colaborativa
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Ambos usuarios navegan a la aplicación
      await page1.goto('http://127.0.0.1:3000');
      await page2.goto('http://127.0.0.1:3000');

      await expect(page1).toHaveTitle(/MintMind/);
      await expect(page2).toHaveTitle(/MintMind/);

      // Usuario 1 crea un nuevo archivo
      const newFileButton1 = page1.locator('[data-testid="new-file-button"]');
      await newFileButton1.click();

      // Usuario 1 escribe código inicial
      const editor1 = page1.locator('[data-testid="monaco-editor"]');
      await editor1.click();
      await page1.keyboard.type('function hello() {\n  return "Hello World";\n}', { delay: 10 });

      // Usuario 2 abre el mismo archivo (simulado - en implementación real sería compartido)
      // En este test básico, solo verificamos que ambos pueden editar independientemente

      const newFileButton2 = page2.locator('[data-testid="new-file-button"]');
      await newFileButton2.click();

      const editor2 = page2.locator('[data-testid="monaco-editor"]');
      await editor2.click();
      await page2.keyboard.type('console.log("Test");', { delay: 10 });

      // Verificar que ambos editores funcionan independientemente
      await expect(editor1).toContainText('function hello()');
      await expect(editor2).toContainText('console.log');
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('debe manejar operaciones de deshacer/rehacer', async ({ page }) => {
    // Crear nuevo archivo
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="monaco-editor"]');
    await editor.click();

    // Escribir texto inicial
    const initialText = 'Hello World';
    await page.keyboard.type(initialText);
    await expect(editor).toContainText(initialText);

    // Agregar más texto
    const additionalText = ' from MintMind';
    await page.keyboard.type(additionalText);
    await expect(editor).toContainText('Hello World from MintMind');

    // Deshacer la última escritura
    await page.keyboard.press('Control+z');
    await expect(editor).toContainText('Hello World');
    await expect(editor).not.toContainText('from MintMind');

    // Deshacer nuevamente
    await page.keyboard.press('Control+z');
    expect(await editor.textContent()).toBe('');

    // Rehacer
    await page.keyboard.press('Control+y');
    await expect(editor).toContainText('Hello World');

    // Rehacer nuevamente
    await page.keyboard.press('Control+y');
    await expect(editor).toContainText('Hello World from MintMind');
  });

  test('debe manejar búsqueda y reemplazo', async ({ page }) => {
    // Crear archivo con contenido de prueba
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="monaco-editor"]');
    await editor.click();

    const testContent = `const oldName = "value1";
const oldName = "value2";
const oldName = "value3";
const newName = "different";`;

    await page.keyboard.type(testContent);

    // Abrir diálogo de búsqueda (Ctrl+F)
    await page.keyboard.press('Control+f');

    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();

    // Buscar "oldName"
    await searchInput.fill('oldName');

    // Verificar que se encontraron 3 ocurrencias
    const matchCount = page.locator('[data-testid="search-match-count"]');
    await expect(matchCount).toContainText('3');

    // Abrir reemplazo (Ctrl+H)
    await page.keyboard.press('Control+h');

    const replaceInput = page.locator('[data-testid="replace-input"]');
    await expect(replaceInput).toBeVisible();

    // Reemplazar todas las ocurrencias
    await replaceInput.fill('updatedName');
    const replaceAllButton = page.locator('[data-testid="replace-all-button"]');
    await replaceAllButton.click();

    // Verificar que el contenido se actualizó
    await expect(editor).toContainText('const updatedName = "value1";');
    await expect(editor).toContainText('const updatedName = "value2";');
    await expect(editor).toContainText('const updatedName = "value3";');
    await expect(editor).toContainText('const newName = "different";'); // Esta no debería cambiarse
  });

  test('debe manejar múltiples pestañas de archivos', async ({ page }) => {
    // Crear primer archivo
    const newFileButton1 = page.locator('[data-testid="new-file-button"]');
    await newFileButton1.click();

    const editor1 = page.locator('[data-testid="monaco-editor"]');
    await editor1.click();
    await page.keyboard.type('console.log("Archivo 1");');

    // Crear segundo archivo
    const newFileButton2 = page.locator('[data-testid="new-file-button"]');
    await newFileButton2.click();

    const editor2 = page.locator('[data-testid="monaco-editor"]');
    await editor2.click();
    await page.keyboard.type('console.log("Archivo 2");');

    // Verificar pestañas
    const tabs = page.locator('[data-testid="editor-tab"]');
    await expect(tabs).toHaveCount(2);

    // Cambiar entre pestañas
    const tab1 = tabs.nth(0);
    const tab2 = tabs.nth(1);

    await tab1.click();
    await expect(page.locator('[data-testid="monaco-editor"]')).toContainText('Archivo 1');

    await tab2.click();
    await expect(page.locator('[data-testid="monaco-editor"]')).toContainText('Archivo 2');

    // Cerrar pestaña
    const closeButton = tab1.locator('[data-testid="tab-close-button"]');
    await closeButton.click();

    // Verificar que queda solo una pestaña
    await expect(page.locator('[data-testid="editor-tab"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="monaco-editor"]')).toContainText('Archivo 2');
  });

  test('debe manejar errores de archivo y recuperación', async ({ page }) => {
    // Intentar abrir un archivo que no existe desde la URL
    await page.goto('http://127.0.0.1:3000/file/nonexistent.txt');

    // Verificar que se muestra error amigable
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Archivo no encontrado');

    // Verificar que se puede crear nuevo archivo desde el estado de error
    const createNewButton = page.locator('[data-testid="create-new-file-button"]');
    await expect(createNewButton).toBeVisible();
    await createNewButton.click();

    // Verificar que se abre editor vacío
    const editor = page.locator('[data-testid="monaco-editor"]');
    await expect(editor).toBeVisible();
    expect(await editor.textContent()).toBe('');
  });

  test('debe manejar edición con diferentes codificaciones', async ({ page }) => {
    // Crear nuevo archivo
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="monaco-editor"]');
    await editor.click();

    // Escribir texto con caracteres especiales
    const unicodeText = 'Hello 世界 🌍 café naïve';
    await page.keyboard.type(unicodeText);

    // Verificar que se muestra correctamente
    await expect(editor).toContainText(unicodeText);

    // Cambiar codificación (simulado - asumiendo UI para esto)
    const encodingSelector = page.locator('[data-testid="encoding-selector"]');
    if (await encodingSelector.isVisible()) {
      await encodingSelector.selectOption('utf-16');
      // Verificar que el texto sigue siendo correcto después del cambio
      await expect(editor).toContainText(unicodeText);
    }
  });

  test('debe manejar archivos de gran tamaño eficientemente', async ({ page }) => {
    // Crear archivo con contenido grande (simulado)
    const largeContent = 'x'.repeat(100000); // 100KB de contenido

    // Medir tiempo de carga
    const startTime = Date.now();

    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="monaco-editor"]');
    await editor.click();

    // Escribir contenido grande en chunks para evitar timeouts
    const chunkSize = 10000;
    for (let i = 0; i < largeContent.length; i += chunkSize) {
      const chunk = largeContent.slice(i, i + chunkSize);
      await page.keyboard.type(chunk);
    }

    const loadTime = Date.now() - startTime;

    // Verificar que se cargó eficientemente (< 10 segundos)
    expect(loadTime).toBeLessThan(10000);

    // Verificar que el contenido está presente
    const editorText = await editor.textContent();
    expect(editorText?.length).toBeGreaterThan(50000);

    // Verificar que las funciones básicas siguen funcionando
    await page.keyboard.press('Control+a'); // Seleccionar todo
    await page.keyboard.press('Control+c'); // Copiar

    // Verificar que no hay indicadores de rendimiento degradado
    const performanceWarning = page.locator('[data-testid="performance-warning"]');
    await expect(performanceWarning).not.toBeVisible();
  });
});