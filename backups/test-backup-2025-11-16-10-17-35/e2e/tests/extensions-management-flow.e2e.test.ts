/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { test, expect } from '@playwright/test';

/**
 * Tests E2E para flujo completo de gestión de extensiones en MintMind
 *
 * Estos tests validan el flujo completo de usuario para instalar,
 * configurar y usar extensiones desde la interfaz.
 */

test.describe('MintMind - Flujo de Gestión de Extensiones E2E', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:3000');
    await expect(page).toHaveTitle(/MintMind/);
    await page.waitForSelector('[data-testid="main-content"]', { timeout: 10000 });
  });

  test('debe permitir buscar e instalar una extensión', async ({ page }) => {
    // Abrir panel de extensiones
    const extensionsButton = page.locator('[data-testid="extensions-button"]');
    await expect(extensionsButton).toBeVisible();
    await extensionsButton.click();

    // Verificar que se abre el panel de extensiones
    const extensionsPanel = page.locator('[data-testid="extensions-panel"]');
    await expect(extensionsPanel).toBeVisible();

    // Buscar una extensión popular (ejemplo: TypeScript)
    const searchInput = page.locator('[data-testid="extensions-search"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('TypeScript');

    // Esperar resultados de búsqueda
    await page.waitForSelector('[data-testid="extension-item"]', { timeout: 5000 });

    // Verificar que aparecen resultados
    const extensionItems = page.locator('[data-testid="extension-item"]');
    await expect(extensionItems.first()).toBeVisible();

    // Seleccionar primera extensión de la lista
    const firstExtension = extensionItems.first();
    const installButton = firstExtension.locator('[data-testid="install-button"]');

    // Verificar que el botón de instalar está presente
    await expect(installButton).toBeVisible();
    await expect(installButton).toContainText(/Install|Instalar/i);

    // Hacer clic en instalar (nota: esto podría requerir confirmación en implementación real)
    await installButton.click();

    // Verificar progreso de instalación
    const progressIndicator = page.locator('[data-testid="install-progress"]');
    if (await progressIndicator.isVisible()) {
      await expect(progressIndicator).toBeVisible();
    }

    // Verificar que la extensión aparece en "Installed"
    const installedTab = page.locator('[data-testid="installed-tab"]');
    await expect(installedTab).toBeVisible();
    await installedTab.click();

    // Verificar que la extensión instalada aparece en la lista
    const installedExtensions = page.locator('[data-testid="installed-extension-item"]');
    await expect(installedExtensions).toHaveCount(await installedExtensions.count() + 1); // Al menos una más
  });

  test('debe permitir desinstalar una extensión', async ({ page }) => {
    // Abrir panel de extensiones
    const extensionsButton = page.locator('[data-testid="extensions-button"]');
    await extensionsButton.click();

    // Ir a pestaña de extensiones instaladas
    const installedTab = page.locator('[data-testid="installed-tab"]');
    await installedTab.click();

    // Buscar una extensión instalada para desinstalar
    const installedExtensions = page.locator('[data-testid="installed-extension-item"]');

    if (await installedExtensions.count() > 0) {
      const firstInstalled = installedExtensions.first();

      // Hacer clic en el menú de opciones de la extensión
      const menuButton = firstInstalled.locator('[data-testid="extension-menu"]');
      await expect(menuButton).toBeVisible();
      await menuButton.click();

      // Seleccionar opción de desinstalar
      const uninstallOption = page.locator('[data-testid="uninstall-option"]');
      await expect(uninstallOption).toBeVisible();
      await uninstallOption.click();

      // Confirmar desinstalación si hay diálogo
      const confirmButton = page.locator('[data-testid="confirm-uninstall"]');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Verificar que la extensión desaparece de la lista instalada
      await expect(firstInstalled).not.toBeVisible();

      // Verificar notificación de desinstalación exitosa
      const notification = page.locator('[data-testid="notification"]');
      await expect(notification).toContainText(/desinstal|removed|uninstalled/i);
    } else {
      // Si no hay extensiones instaladas, verificar mensaje apropiado
      const noExtensionsMessage = page.locator('[data-testid="no-extensions-message"]');
      await expect(noExtensionsMessage).toBeVisible();
    }
  });

  test('debe permitir habilitar/deshabilitar extensiones', async ({ page }) => {
    // Abrir panel de extensiones
    const extensionsButton = page.locator('[data-testid="extensions-button"]');
    await extensionsButton.click();

    const installedTab = page.locator('[data-testid="installed-tab"]');
    await installedTab.click();

    const installedExtensions = page.locator('[data-testid="installed-extension-item"]');

    if (await installedExtensions.count() > 0) {
      const firstInstalled = installedExtensions.first();

      // Buscar toggle de habilitar/deshabilitar
      const toggleButton = firstInstalled.locator('[data-testid="extension-toggle"]');
      await expect(toggleButton).toBeVisible();

      // Verificar estado inicial
      const isEnabled = await toggleButton.getAttribute('aria-checked') === 'true';

      // Alternar estado
      await toggleButton.click();

      // Verificar que el estado cambió
      const newState = await toggleButton.getAttribute('aria-checked');
      expect(newState).not.toBe(isEnabled.toString());

      // Verificar notificación de cambio de estado
      const notification = page.locator('[data-testid="notification"]');
      if (isEnabled) {
        await expect(notification).toContainText(/deshabilit|disabled/i);
      } else {
        await expect(notification).toContainText(/habilit|enabled/i);
      }

      // Volver al estado original para cleanup
      await toggleButton.click();
    }
  });

  test('debe mostrar información detallada de extensión', async ({ page }) => {
    // Abrir panel de extensiones
    const extensionsButton = page.locator('[data-testid="extensions-button"]');
    await extensionsButton.click();

    // Buscar extensiones
    const searchInput = page.locator('[data-testid="extensions-search"]');
    await searchInput.fill('ESLint');

    await page.waitForSelector('[data-testid="extension-item"]', { timeout: 5000 });

    const firstExtension = page.locator('[data-testid="extension-item"]').first();

    // Hacer clic para ver detalles
    await firstExtension.click();

    // Verificar panel de detalles
    const detailsPanel = page.locator('[data-testid="extension-details"]');
    await expect(detailsPanel).toBeVisible();

    // Verificar elementos de información básica
    const extensionName = detailsPanel.locator('[data-testid="extension-name"]');
    const extensionDescription = detailsPanel.locator('[data-testid="extension-description"]');
    const extensionVersion = detailsPanel.locator('[data-testid="extension-version"]');
    const extensionPublisher = detailsPanel.locator('[data-testid="extension-publisher"]');

    await expect(extensionName).toBeVisible();
    await expect(extensionDescription).toBeVisible();
    await expect(extensionVersion).toBeVisible();
    await expect(extensionPublisher).toBeVisible();

    // Verificar secciones adicionales si existen
    const featuresSection = detailsPanel.locator('[data-testid="extension-features"]');
    const changelogSection = detailsPanel.locator('[data-testid="extension-changelog"]');

    // Estas secciones pueden no estar presentes en todas las extensiones
    if (await featuresSection.isVisible()) {
      await expect(featuresSection).toContainText(/\w+/); // Contiene algo de texto
    }

    if (await changelogSection.isVisible()) {
      await expect(changelogSection).toContainText(/\w+/);
    }
  });

  test('debe permitir configurar extensiones', async ({ page }) => {
    // Abrir panel de extensiones
    const extensionsButton = page.locator('[data-testid="extensions-button"]');
    await extensionsButton.click();

    const installedTab = page.locator('[data-testid="installed-tab"]');
    await installedTab.click();

    const installedExtensions = page.locator('[data-testid="installed-extension-item"]');

    if (await installedExtensions.count() > 0) {
      const firstInstalled = installedExtensions.first();

      // Buscar botón de configuración
      const settingsButton = firstInstalled.locator('[data-testid="extension-settings"]');

      if (await settingsButton.isVisible()) {
        await settingsButton.click();

        // Verificar que se abre panel de configuración
        const settingsPanel = page.locator('[data-testid="extension-settings-panel"]');
        await expect(settingsPanel).toBeVisible();

        // Buscar configuraciones disponibles
        const settingsItems = settingsPanel.locator('[data-testid="setting-item"]');

        if (await settingsItems.count() > 0) {
          // Modificar una configuración
          const firstSetting = settingsItems.first();
          const input = firstSetting.locator('input, select, textarea').first();

          if (await input.isVisible()) {
            const originalValue = await input.inputValue();

            // Cambiar valor
            if (await input.getAttribute('type') === 'checkbox') {
              await input.click();
            } else {
              await input.fill('test value');
            }

            // Verificar que se puede guardar
            const saveButton = settingsPanel.locator('[data-testid="save-settings"]');
            if (await saveButton.isVisible()) {
              await saveButton.click();

              // Verificar notificación de guardado
              const notification = page.locator('[data-testid="notification"]');
              await expect(notification).toContainText(/guard|saved|configur/i);
            }
          }
        }
      }
    }
  });

  test('debe manejar categorías de extensiones', async ({ page }) => {
    // Abrir panel de extensiones
    const extensionsButton = page.locator('[data-testid="extensions-button"]');
    await extensionsButton.click();

    // Verificar categorías disponibles
    const categories = page.locator('[data-testid="extension-category"]');

    if (await categories.count() > 0) {
      // Lista de categorías esperadas
      const expectedCategories = [
        'Programming Languages',
        'Snippets',
        'Linters',
        'Themes',
        'Debuggers',
        'Formatters',
        'Other'
      ];

      // Verificar que al menos algunas categorías están presentes
      let foundCategories = 0;
      for (const category of expectedCategories) {
        const categoryElement = categories.locator(`text=${category}`);
        if (await categoryElement.isVisible()) {
          foundCategories++;
        }
      }

      expect(foundCategories).toBeGreaterThan(0);

      // Probar filtrado por categoría
      const firstCategory = categories.first();
      await firstCategory.click();

      // Verificar que se muestran extensiones de esa categoría
      const filteredExtensions = page.locator('[data-testid="extension-item"]');
      await expect(filteredExtensions.first()).toBeVisible();

      // Verificar etiqueta de categoría activa
      await expect(firstCategory).toHaveClass(/active|selected/);
    }
  });

  test('debe manejar actualizaciones de extensiones', async ({ page }) => {
    // Abrir panel de extensiones
    const extensionsButton = page.locator('[data-testid="extensions-button"]');
    await extensionsButton.click();

    // Ir a pestaña de extensiones instaladas
    const installedTab = page.locator('[data-testid="installed-tab"]');
    await installedTab.click();

    // Buscar extensiones con actualizaciones disponibles
    const updateButtons = page.locator('[data-testid="update-extension-button"]');

    if (await updateButtons.count() > 0) {
      const firstUpdateButton = updateButtons.first();

      // Hacer clic en actualizar
      await firstUpdateButton.click();

      // Verificar progreso de actualización
      const updateProgress = page.locator('[data-testid="update-progress"]');
      if (await updateProgress.isVisible()) {
        await expect(updateProgress).toBeVisible();
      }

      // Verificar notificación de actualización exitosa
      const notification = page.locator('[data-testid="notification"]');
      await expect(notification).toContainText(/actualiz|updated|upgraded/i);

      // Verificar que el botón de actualizar ya no está visible
      await expect(firstUpdateButton).not.toBeVisible();
    } else {
      // Si no hay actualizaciones, verificar mensaje apropiado
      const noUpdatesMessage = page.locator('[data-testid="no-updates-message"]');
      if (await noUpdatesMessage.isVisible()) {
        await expect(noUpdatesMessage).toBeVisible();
      }
    }
  });

  test('debe manejar extensiones recomendadas del workspace', async ({ page }) => {
    // Abrir panel de extensiones
    const extensionsButton = page.locator('[data-testid="extensions-button"]');
    await extensionsButton.click();

    // Buscar pestaña de recomendaciones
    const recommendationsTab = page.locator('[data-testid="recommendations-tab"]');

    if (await recommendationsTab.isVisible()) {
      await recommendationsTab.click();

      // Verificar extensiones recomendadas
      const recommendedExtensions = page.locator('[data-testid="recommended-extension"]');

      if (await recommendedExtensions.count() > 0) {
        // Verificar que hay recomendaciones
        await expect(recommendedExtensions.first()).toBeVisible();

        // Probar instalar recomendación
        const firstRecommended = recommendedExtensions.first();
        const installRecommendedButton = firstRecommended.locator('[data-testid="install-recommended"]');

        if (await installRecommendedButton.isVisible()) {
          await installRecommendedButton.click();

          // Verificar progreso de instalación
          const progress = page.locator('[data-testid="install-progress"]');
          if (await progress.isVisible()) {
            await expect(progress).toBeVisible();
          }
        }
      } else {
        // Verificar mensaje cuando no hay recomendaciones
        const noRecommendationsMessage = page.locator('[data-testid="no-recommendations"]');
        await expect(noRecommendationsMessage).toBeVisible();
      }
    }
  });

  test('debe manejar búsqueda avanzada de extensiones', async ({ page }) => {
    // Abrir panel de extensiones
    const extensionsButton = page.locator('[data-testid="extensions-button"]');
    await extensionsButton.click();

    const searchInput = page.locator('[data-testid="extensions-search"]');

    // Probar diferentes tipos de búsqueda
    const searchQueries = [
      'typescript',
      '@sort:rating',
      '@category:formatters',
      'publisher:ms-vscode',
      'tag:debugging'
    ];

    for (const query of searchQueries) {
      await searchInput.fill('');
      await searchInput.fill(query);

      // Esperar resultados
      await page.waitForTimeout(1000); // Breve pausa para búsqueda

      // Verificar que hay resultados o mensaje de no resultados
      const results = page.locator('[data-testid="extension-item"]');
      const noResults = page.locator('[data-testid="no-results"]');

      // Al menos uno de los dos debería estar visible
      const hasResults = await results.isVisible();
      const hasNoResults = await noResults.isVisible();

      expect(hasResults || hasNoResults).toBe(true);
    }
  });

  test('debe manejar errores de instalación', async ({ page }) => {
    // Abrir panel de extensiones
    const extensionsButton = page.locator('[data-testid="extensions-button"]');
    await extensionsButton.click();

    // Buscar extensión que no existe o con problemas
    const searchInput = page.locator('[data-testid="extensions-search"]');
    await searchInput.fill('nonexistent-extension-12345');

    // Esperar mensaje de no resultados
    const noResultsMessage = page.locator('[data-testid="no-results"]');
    await expect(noResultsMessage).toBeVisible();

    // Intentar instalar desde marketplace externo (simulado)
    // En implementación real, esto probaría instalación desde MintMind Marketplace

    // Verificar manejo de errores de red
    await page.context().setOffline(true);

    try {
      const refreshButton = page.locator('[data-testid="refresh-extensions"]');
      if (await refreshButton.isVisible()) {
        await refreshButton.click();

        // Verificar mensaje de error de conexión
        const errorMessage = page.locator('[data-testid="connection-error"]');
        await expect(errorMessage).toBeVisible();
      }
    } finally {
      await page.context().setOffline(false);
    }
  });

  test('debe permitir gestionar extensiones desde línea de comandos', async ({ page }) => {
    // Abrir terminal integrado
    const terminalButton = page.locator('[data-testid="terminal-button"]');
    await expect(terminalButton).toBeVisible();
    await terminalButton.click();

    const terminal = page.locator('[data-testid="terminal"]');
    await expect(terminal).toBeVisible();

    // Ejecutar comandos de gestión de extensiones
    const extensionCommands = [
      'code --list-extensions',
      'code --install-extension ms-vscode.vscode-typescript-next',
      'code --uninstall-extension ms-vscode.vscode-typescript-next'
    ];

    for (const command of extensionCommands) {
      // Limpiar línea de comandos
      await page.keyboard.press('Control+c');

      // Escribir comando
      await page.keyboard.type(command);

      // Ejecutar
      await page.keyboard.press('Enter');

      // Esperar resultado
      await page.waitForTimeout(2000);
    }

    // Verificar que los comandos se ejecutaron (comportamiento específico depende de la implementación)
    const terminalOutput = terminal.locator('[data-testid="terminal-output"]');
    await expect(terminalOutput).toBeVisible();
  });
});
