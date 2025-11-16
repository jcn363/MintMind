/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Ejecutar tests en archivos en paralelo */
  fullyParallel: true,
  /* Fallar el build en cualquier test fallido */
  forbidOnly: !!process.env.CI,
  /* Retry en CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt-in para paralelismo basado en archivos */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter para CI */
  reporter: 'html',
  /* Configuración global del test */
  use: {
    /* Base URL para usar en las acciones */
    baseURL: 'http://127.0.0.1:3000',

    /* Recolectar trace cuando retry en CI */
    trace: 'on-first-retry',
  },

  /* Configurar proyectos para diferentes navegadores */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test contra mobile viewports */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test branded browsers */
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],

  /* Ejecutar tu servidor local antes de iniciar los tests */
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
  },
});
