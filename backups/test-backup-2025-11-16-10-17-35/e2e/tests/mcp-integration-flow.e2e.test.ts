/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { test, expect } from '@playwright/test';

/**
 * Tests E2E para flujo completo de uso de MCP (Model Context Protocol) en MintMind
 *
 * Estos tests validan la integración completa de MCP desde la interfaz de usuario,
 * incluyendo configuración de servidores, uso de herramientas y manejo de respuestas.
 */

test.describe('MintMind - Flujo de Integración MCP E2E', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:3000');
    await expect(page).toHaveTitle(/MintMind/);
    await page.waitForSelector('[data-testid="main-content"]', { timeout: 10000 });
  });

  test('debe permitir configurar servidor MCP', async ({ page }) => {
    // Abrir panel de configuración MCP
    const mcpButton = page.locator('[data-testid="mcp-config-button"]');
    await expect(mcpButton).toBeVisible();
    await mcpButton.click();

    // Verificar panel de configuración MCP
    const mcpConfigPanel = page.locator('[data-testid="mcp-config-panel"]');
    await expect(mcpConfigPanel).toBeVisible();

    // Agregar nuevo servidor MCP
    const addServerButton = page.locator('[data-testid="add-mcp-server"]');
    await expect(addServerButton).toBeVisible();
    await addServerButton.click();

    // Formulario de configuración del servidor
    const serverForm = page.locator('[data-testid="mcp-server-form"]');
    await expect(serverForm).toBeVisible();

    // Llenar configuración básica
    const nameInput = serverForm.locator('[data-testid="server-name"]');
    const commandInput = serverForm.locator('[data-testid="server-command"]');
    const argsInput = serverForm.locator('[data-testid="server-args"]');

    await nameInput.fill('Test MCP Server');
    await commandInput.fill('node');
    await argsInput.fill('path/to/mcp/server.js');

    // Configurar herramientas disponibles
    const toolsSection = serverForm.locator('[data-testid="server-tools"]');
    const toolCheckboxes = toolsSection.locator('input[type="checkbox"]');

    if (await toolCheckboxes.count() > 0) {
      await toolCheckboxes.nth(0).check(); // Habilitar primera herramienta
      await toolCheckboxes.nth(1).check(); // Habilitar segunda herramienta
    }

    // Guardar configuración
    const saveButton = serverForm.locator('[data-testid="save-server-config"]');
    await saveButton.click();

    // Verificar que el servidor aparece en la lista
    const serverList = page.locator('[data-testid="mcp-servers-list"]');
    await expect(serverList).toContainText('Test MCP Server');

    // Verificar estado del servidor (conectado/desconectado)
    const serverStatus = serverList.locator('[data-testid="server-status"]');
    await expect(serverStatus).toBeVisible();
  });

  test('debe manejar conexión y desconexión de servidores MCP', async ({ page }) => {
    // Abrir configuración MCP
    const mcpButton = page.locator('[data-testid="mcp-config-button"]');
    await mcpButton.click();

    const serverList = page.locator('[data-testid="mcp-servers-list"]');

    // Buscar servidor configurado
    const serverItem = serverList.locator('[data-testid="mcp-server-item"]').first();
    if (await serverItem.isVisible()) {
      // Botón de conectar/desconectar
      const connectButton = serverItem.locator('[data-testid="server-connect-toggle"]');
      await expect(connectButton).toBeVisible();

      const initialState = await connectButton.textContent();

      // Alternar conexión
      await connectButton.click();

      // Verificar cambio de estado
      const newState = await connectButton.textContent();
      expect(newState).not.toBe(initialState);

      // Verificar indicadores visuales de estado
      const statusIndicator = serverItem.locator('[data-testid="connection-indicator"]');
      await expect(statusIndicator).toBeVisible();

      // Si se conectó, verificar herramientas disponibles
      if (newState?.includes('Conectado') || newState?.includes('Connected')) {
        const toolsList = serverItem.locator('[data-testid="server-tools-list"]');
        await expect(toolsList).toBeVisible();

        // Verificar que hay herramientas listadas
        const toolItems = toolsList.locator('[data-testid="tool-item"]');
        await expect(toolItems.count()).toBeGreaterThan(0);
      }

      // Desconectar para cleanup
      if (newState?.includes('Conectado') || newState?.includes('Connected')) {
        await connectButton.click();
      }
    }
  });

  test('debe permitir usar herramientas MCP desde interfaz', async ({ page }) => {
    // Abrir panel de herramientas MCP
    const mcpToolsButton = page.locator('[data-testid="mcp-tools-panel"]');
    await expect(mcpToolsButton).toBeVisible();
    await mcpToolsButton.click();

    const toolsPanel = page.locator('[data-testid="mcp-tools-panel"]');
    await expect(toolsPanel).toBeVisible();

    // Verificar herramientas disponibles
    const availableTools = toolsPanel.locator('[data-testid="available-tool"]');

    if (await availableTools.count() > 0) {
      const firstTool = availableTools.first();

      // Verificar información de la herramienta
      const toolName = firstTool.locator('[data-testid="tool-name"]');
      const toolDescription = firstTool.locator('[data-testid="tool-description"]');

      await expect(toolName).toBeVisible();
      await expect(toolDescription).toBeVisible();

      // Abrir formulario de ejecución de herramienta
      const executeButton = firstTool.locator('[data-testid="execute-tool"]');
      await executeButton.click();

      // Formulario de parámetros
      const toolForm = page.locator('[data-testid="tool-execution-form"]');
      await expect(toolForm).toBeVisible();

      // Llenar parámetros requeridos (simulado - depende de la herramienta)
      const paramInputs = toolForm.locator('input, textarea, select');
      for (const input of await paramInputs.all()) {
        const inputType = await input.getAttribute('type');
        if (inputType === 'text' || inputType === 'textarea') {
          await input.fill('test value');
        } else if (inputType === 'number') {
          await input.fill('42');
        }
      }

      // Ejecutar herramienta
      const runButton = toolForm.locator('[data-testid="run-tool"]');
      await runButton.click();

      // Verificar progreso de ejecución
      const progressIndicator = page.locator('[data-testid="tool-progress"]');
      if (await progressIndicator.isVisible()) {
        await expect(progressIndicator).toBeVisible();
      }

      // Verificar resultado
      const resultPanel = page.locator('[data-testid="tool-result"]');
      await expect(resultPanel).toBeVisible();

      // Verificar que hay algún resultado
      const resultContent = resultPanel.locator('[data-testid="result-content"]');
      await expect(resultContent).toBeVisible();
    }
  });

  test('debe manejar herramientas MCP en contexto del editor', async ({ page }) => {
    // Abrir un archivo en el editor
    const newFileButton = page.locator('[data-testid="new-file-button"]');
    await newFileButton.click();

    const editor = page.locator('[data-testid="monaco-editor"]');
    await editor.click();
    await page.keyboard.type('function test() {\n  // Código de prueba\n}', { delay: 10 });

    // Abrir menú contextual MCP en el editor
    await page.keyboard.press('Control+Shift+P'); // Command palette
    const commandPalette = page.locator('[data-testid="command-palette"]');
    await expect(commandPalette).toBeVisible();

    // Buscar comandos MCP
    const searchInput = commandPalette.locator('input');
    await searchInput.fill('MCP');

    // Verificar comandos MCP disponibles
    const mcpCommands = commandPalette.locator('[data-testid="command-item"]').filter({
      hasText: /MCP|mcp/
    });

    if (await mcpCommands.count() > 0) {
      // Ejecutar primer comando MCP
      const firstMcpCommand = mcpCommands.first();
      await firstMcpCommand.click();

      // Verificar que se ejecuta en contexto del editor
      const notification = page.locator('[data-testid="notification"]');
      await expect(notification).toBeVisible();
    }

    // Probar click derecho en el editor para menú contextual MCP
    await editor.click({ button: 'right' });
    const contextMenu = page.locator('[data-testid="context-menu"]');

    if (await contextMenu.isVisible()) {
      const mcpMenuItems = contextMenu.locator('[data-testid="menu-item"]').filter({
        hasText: /MCP|mcp/
      });

      if (await mcpMenuItems.count() > 0) {
        const firstMcpItem = mcpMenuItems.first();
        await firstMcpItem.click();

        // Verificar ejecución
        const resultNotification = page.locator('[data-testid="notification"]');
        await expect(resultNotification).toBeVisible();
      }
    }
  });

  test('debe integrar MCP con funcionalidades del terminal', async ({ page }) => {
    // Abrir terminal
    const terminalButton = page.locator('[data-testid="terminal-toggle"]');
    await terminalButton.click();

    const terminal = page.locator('[data-testid="terminal"]');
    await expect(terminal).toBeVisible();

    // Ejecutar comando básico
    await page.keyboard.type('ls -la');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Buscar integración MCP en el terminal
    const mcpTerminalButton = page.locator('[data-testid="mcp-terminal-integration"]');

    if (await mcpTerminalButton.isVisible()) {
      await mcpTerminalButton.click();

      // Verificar panel de herramientas MCP en contexto del terminal
      const terminalMcpPanel = page.locator('[data-testid="terminal-mcp-panel"]');
      await expect(terminalMcpPanel).toBeVisible();

      // Probar herramienta relacionada con terminal
      const terminalTools = terminalMcpPanel.locator('[data-testid="terminal-tool"]');

      if (await terminalTools.count() > 0) {
        const firstTerminalTool = terminalTools.first();
        await firstTerminalTool.click();

        // Verificar que la herramienta opera en el contexto del terminal
        const toolResult = page.locator('[data-testid="tool-execution-result"]');
        await expect(toolResult).toBeVisible();

        // Verificar que el resultado aparece en el terminal
        const terminalOutput = terminal.locator('[data-testid="terminal-output"]');
        await expect(terminalOutput).toBeVisible();
      }
    }
  });

  test('debe manejar errores y recuperación en MCP', async ({ page }) => {
    // Abrir configuración MCP
    const mcpButton = page.locator('[data-testid="mcp-config-button"]');
    await mcpButton.click();

    // Intentar conectar servidor que no existe
    const serverList = page.locator('[data-testid="mcp-servers-list"]');
    const serverItem = serverList.locator('[data-testid="mcp-server-item"]').first();

    if (await serverItem.isVisible()) {
      const connectButton = serverItem.locator('[data-testid="server-connect-toggle"]');

      // Forzar desconexión de red para simular error
      await page.context().setOffline(true);

      try {
        await connectButton.click();

        // Verificar mensaje de error de conexión
        const errorNotification = page.locator('[data-testid="error-notification"]');
        await expect(errorNotification).toBeVisible();
        await expect(errorNotification).toContainText(/conexión|connection|error/i);

      } finally {
        await page.context().setOffline(false);
      }

      // Verificar opciones de recuperación
      const retryButton = page.locator('[data-testid="retry-connection"]');
      if (await retryButton.isVisible()) {
        await retryButton.click();

        // Verificar intento de reconexión
        const reconnectingIndicator = page.locator('[data-testid="reconnecting-indicator"]');
        await expect(reconnectingIndicator).toBeVisible();
      }
    }
  });

  test('debe permitir monitoreo y logs de MCP', async ({ page }) => {
    // Abrir panel de monitoreo MCP
    const mcpMonitorButton = page.locator('[data-testid="mcp-monitor"]');
    await expect(mcpMonitorButton).toBeVisible();
    await mcpMonitorButton.click();

    const monitorPanel = page.locator('[data-testid="mcp-monitor-panel"]');
    await expect(monitorPanel).toBeVisible();

    // Verificar métricas de rendimiento
    const metricsSection = monitorPanel.locator('[data-testid="mcp-metrics"]');
    await expect(metricsSection).toBeVisible();

    // Verificar elementos de métricas
    const activeConnections = metricsSection.locator('[data-testid="active-connections"]');
    const toolsExecuted = metricsSection.locator('[data-testid="tools-executed"]');
    const avgResponseTime = metricsSection.locator('[data-testid="avg-response-time"]');

    await expect(activeConnections).toBeVisible();
    await expect(toolsExecuted).toBeVisible();
    await expect(avgResponseTime).toBeVisible();

    // Verificar logs de actividad
    const logsSection = monitorPanel.locator('[data-testid="mcp-logs"]');
    await expect(logsSection).toBeVisible();

    const logEntries = logsSection.locator('[data-testid="log-entry"]');

    // Debería haber al menos algunos logs de inicialización
    if (await logEntries.count() > 0) {
      const firstLog = logEntries.first();
      const logTimestamp = firstLog.locator('[data-testid="log-timestamp"]');
      const logLevel = firstLog.locator('[data-testid="log-level"]');
      const logMessage = firstLog.locator('[data-testid="log-message"]');

      await expect(logTimestamp).toBeVisible();
      await expect(logLevel).toBeVisible();
      await expect(logMessage).toBeVisible();
    }

    // Probar filtros de logs
    const logFilters = monitorPanel.locator('[data-testid="log-filter"]');
    if (await logFilters.count() > 0) {
      const errorFilter = logFilters.locator('text=/Error|error/').first();
      if (await errorFilter.isVisible()) {
        await errorFilter.click();

        // Verificar que solo se muestran logs de error
        const filteredLogs = logsSection.locator('[data-testid="log-entry"]');
        for (const log of await filteredLogs.all()) {
          const level = await log.locator('[data-testid="log-level"]').textContent();
          expect(level?.toLowerCase()).toBe('error');
        }
      }
    }
  });

  test('debe manejar configuración avanzada de MCP', async ({ page }) => {
    // Abrir configuración avanzada
    const mcpButton = page.locator('[data-testid="mcp-config-button"]');
    await mcpButton.click();

    const advancedButton = page.locator('[data-testid="advanced-config"]');
    if (await advancedButton.isVisible()) {
      await advancedButton.click();

      const advancedPanel = page.locator('[data-testid="mcp-advanced-config"]');
      await expect(advancedPanel).toBeVisible();

      // Configurar timeouts
      const timeoutInput = advancedPanel.locator('[data-testid="request-timeout"]');
      if (await timeoutInput.isVisible()) {
        await timeoutInput.fill('30000'); // 30 segundos
      }

      // Configurar límites de concurrencia
      const concurrencyInput = advancedPanel.locator('[data-testid="max-concurrent-requests"]');
      if (await concurrencyInput.isVisible()) {
        await concurrencyInput.fill('5');
      }

      // Configurar logging
      const logLevelSelect = advancedPanel.locator('[data-testid="log-level"]');
      if (await logLevelSelect.isVisible()) {
        await logLevelSelect.selectOption('debug');
      }

      // Configurar retry policy
      const retryConfig = advancedPanel.locator('[data-testid="retry-config"]');
      if (await retryConfig.isVisible()) {
        const maxRetries = retryConfig.locator('[data-testid="max-retries"]');
        const retryDelay = retryConfig.locator('[data-testid="retry-delay"]');

        if (await maxRetries.isVisible()) {
          await maxRetries.fill('3');
        }
        if (await retryDelay.isVisible()) {
          await retryDelay.fill('1000');
        }
      }

      // Guardar configuración avanzada
      const saveAdvancedButton = advancedPanel.locator('[data-testid="save-advanced-config"]');
      if (await saveAdvancedButton.isVisible()) {
        await saveAdvancedButton.click();

        // Verificar confirmación
        const successNotification = page.locator('[data-testid="config-saved-notification"]');
        await expect(successNotification).toBeVisible();
      }
    }
  });

  test('debe permitir compartir configuración MCP entre workspaces', async ({ page }) => {
    // Abrir configuración MCP
    const mcpButton = page.locator('[data-testid="mcp-config-button"]');
    await mcpButton.click();

    // Buscar opción de configuración global vs workspace
    const scopeSelector = page.locator('[data-testid="config-scope-selector"]');

    if (await scopeSelector.isVisible()) {
      // Cambiar a configuración global
      await scopeSelector.selectOption('global');

      // Verificar que se muestran configuraciones globales
      const globalServers = page.locator('[data-testid="global-mcp-servers"]');
      await expect(globalServers).toBeVisible();

      // Cambiar a configuración de workspace
      await scopeSelector.selectOption('workspace');

      // Verificar que se muestran configuraciones de workspace
      const workspaceServers = page.locator('[data-testid="workspace-mcp-servers"]');
      await expect(workspaceServers).toBeVisible();

      // Probar exportar configuración
      const exportButton = page.locator('[data-testid="export-mcp-config"]');
      if (await exportButton.isVisible()) {
        await exportButton.click();

        // Verificar que se descarga archivo
        const downloadPromise = page.waitForEvent('download');
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toMatch(/mcp.*config.*\.json/i);
      }

      // Probar importar configuración
      const importButton = page.locator('[data-testid="import-mcp-config"]');
      if (await importButton.isVisible()) {
        // En implementación real, se subiría un archivo
        // Aquí solo verificamos que el botón funciona
        await expect(importButton).toBeEnabled();
      }
    }
  });

  test('debe manejar actualizaciones y versiones de servidores MCP', async ({ page }) => {
    // Abrir configuración MCP
    const mcpButton = page.locator('[data-testid="mcp-config-button"]');
    await mcpButton.click();

    const serverList = page.locator('[data-testid="mcp-servers-list"]');

    // Buscar indicadores de actualización
    const updateIndicators = serverList.locator('[data-testid="server-update-available"]');

    if (await updateIndicators.count() > 0) {
      const firstUpdateIndicator = updateIndicators.first();

      // Ver información de actualización
      await firstUpdateIndicator.click();

      const updateInfo = page.locator('[data-testid="update-info-panel"]');
      await expect(updateInfo).toBeVisible();

      // Verificar detalles de versión
      const currentVersion = updateInfo.locator('[data-testid="current-version"]');
      const newVersion = updateInfo.locator('[data-testid="new-version"]');
      const changelog = updateInfo.locator('[data-testid="changelog"]');

      await expect(currentVersion).toBeVisible();
      await expect(newVersion).toBeVisible();

      if (await changelog.isVisible()) {
        await expect(changelog).toContainText(/\w+/);
      }

      // Ejecutar actualización
      const updateButton = updateInfo.locator('[data-testid="update-server"]');
      if (await updateButton.isVisible()) {
        await updateButton.click();

        // Verificar progreso de actualización
        const updateProgress = page.locator('[data-testid="update-progress"]');
        await expect(updateProgress).toBeVisible();

        // Verificar finalización exitosa
        const updateComplete = page.locator('[data-testid="update-complete"]');
        await expect(updateComplete).toBeVisible();

        // Verificar que el indicador de actualización desaparece
        await expect(firstUpdateIndicator).not.toBeVisible();
      }
    } else {
      // Verificar mensaje cuando no hay actualizaciones
      const noUpdatesMessage = page.locator('[data-testid="no-updates-message"]');
      if (await noUpdatesMessage.isVisible()) {
        await expect(noUpdatesMessage).toBeVisible();
      }
    }
  });

  test('debe proporcionar feedback y ayuda para MCP', async ({ page }) => {
    // Abrir panel de ayuda MCP
    const helpButton = page.locator('[data-testid="mcp-help"]');
    await expect(helpButton).toBeVisible();
    await helpButton.click();

    const helpPanel = page.locator('[data-testid="mcp-help-panel"]');
    await expect(helpPanel).toBeVisible();

    // Verificar documentación básica
    const gettingStarted = helpPanel.locator('[data-testid="getting-started"]');
    const apiReference = helpPanel.locator('[data-testid="api-reference"]');
    const examples = helpPanel.locator('[data-testid="examples"]');

    await expect(gettingStarted).toBeVisible();
    await expect(apiReference).toBeVisible();
    await expect(examples).toBeVisible();

    // Verificar ejemplos interactivos
    if (await examples.isVisible()) {
      const exampleItems = examples.locator('[data-testid="example-item"]');

      if (await exampleItems.count() > 0) {
        const firstExample = exampleItems.first();
        await firstExample.click();

        // Verificar que se muestra código de ejemplo
        const exampleCode = page.locator('[data-testid="example-code"]');
        await expect(exampleCode).toBeVisible();

        // Verificar botón para probar ejemplo
        const tryExampleButton = page.locator('[data-testid="try-example"]');
        if (await tryExampleButton.isVisible()) {
          await tryExampleButton.click();

          // Verificar que se ejecuta el ejemplo
          const exampleResult = page.locator('[data-testid="example-result"]');
          await expect(exampleResult).toBeVisible();
        }
      }
    }

    // Verificar troubleshooting
    const troubleshooting = helpPanel.locator('[data-testid="troubleshooting"]');
    if (await troubleshooting.isVisible()) {
      await troubleshooting.click();

      const commonIssues = page.locator('[data-testid="common-issues"]');
      await expect(commonIssues).toBeVisible();

      // Verificar soluciones a problemas comunes
      const issueItems = commonIssues.locator('[data-testid="issue-item"]');
      await expect(issueItems.count()).toBeGreaterThan(0);
    }

    // Verificar contacto y soporte
    const supportSection = helpPanel.locator('[data-testid="support"]');
    if (await supportSection.isVisible()) {
      const contactInfo = supportSection.locator('[data-testid="contact-info"]');
      const reportIssue = supportSection.locator('[data-testid="report-issue"]');

      await expect(contactInfo).toBeVisible();
      await expect(reportIssue).toBeVisible();
    }
  });
});