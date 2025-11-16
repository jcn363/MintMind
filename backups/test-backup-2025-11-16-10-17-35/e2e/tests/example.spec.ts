/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { test, expect } from '@playwright/test';

/**
 * Suite de tests E2E básicos para MintMind
 * Estos tests validan flujos completos de usuario desde la interfaz
 */
test.describe('MintMind - Tests E2E Básicos', () => {

  test.beforeEach(async ({ page }) => {
    // Configuración inicial antes de cada test
    await page.goto('/');
  });

  test('debe cargar la página principal correctamente', async ({ page }) => {
    // Verificar que la página cargue sin errores
    await expect(page).toHaveTitle(/MintMind/);

    // Verificar elementos básicos de la UI
    const mainContent = page.locator('[data-testid="main-content"]');
    await expect(mainContent).toBeVisible();
  });

  test('debe manejar navegación básica', async ({ page }) => {
    // Simular navegación entre secciones
    const navMenu = page.locator('[data-testid="nav-menu"]');
    await expect(navMenu).toBeVisible();

    // Hacer clic en un elemento de navegación (ajustar según la UI real)
    // const navItem = page.locator('[data-testid="nav-item-dashboard"]');
    // await navItem.click();
    // await expect(page).toHaveURL(/.*dashboard/);
  });

  test('debe manejar errores de red gracefully', async ({ page }) => {
    // Simular desconexión de red
    await page.context().setOffline(true);

    // Intentar una acción que requiera conexión
    // Verificar que se muestre mensaje de error apropiado
    await page.reload();
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

    // Restaurar conexión
    await page.context().setOffline(false);
  });

  test('debe ser responsive en mobile', async ({ page, isMobile }) => {
    if (isMobile) {
      // Verificar comportamiento en dispositivos móviles
      const mobileMenu = page.locator('[data-testid="mobile-menu"]');
      await expect(mobileMenu).toBeVisible();

      // Verificar que el contenido se adapte al tamaño de pantalla
      await expect(page.viewportSize()?.width).toBeLessThanOrEqual(768);
    }
  });

  test('debe manejar session timeout', async ({ page }) => {
    // Simular expiración de sesión
    // Esto requeriría configuración específica de la aplicación
    // await page.addScriptTag({ content: 'localStorage.removeItem("authToken");' });

    // Intentar acción que requiera autenticación
    // const protectedAction = page.locator('[data-testid="protected-action"]');
    // await protectedAction.click();

    // Verificar redirección a login
    // await expect(page).toHaveURL(/.*login/);
  });
});
