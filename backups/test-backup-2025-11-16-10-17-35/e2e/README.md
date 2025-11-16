# Tests E2E - MintMind

Este directorio contiene los tests End-to-End (E2E) para MintMind usando Playwright, que validan flujos completos de usuario desde la interfaz.

## Estructura

```
test/e2e/
├── playwright.config.ts    # Configuración de Playwright
├── package.json           # Dependencias de E2E
├── tsconfig.json          # Configuración TypeScript
├── .gitignore             # Archivos ignorados
├── tests/                 # Tests E2E
│   └── example.spec.ts    # Ejemplo básico de test E2E
└── README.md              # Esta documentación
```

## Configuración

### Playwright Configuration

El archivo `playwright.config.ts` configura:

- Múltiples navegadores (Chromium, Firefox, WebKit)
- Configuración de dispositivos móviles
- Servidor de desarrollo automático
- Configuración de screenshots y videos
- Paralelización de tests

### Dependencias

Instalar dependencias:

```bash
cd test/e2e
npm install
```

O desde el directorio raíz:

```bash
npm run playwright-install
```

## Ejecutar Tests

```bash
# Ejecutar todos los tests E2E
npm run test:e2e

# Desde el directorio e2e
cd test/e2e && npm run test

# Ejecutar en modo headed (ver navegador)
npm run test:headed

# Ejecutar con UI de Playwright
npm run test:ui

# Ejecutar en debug mode
npm run test:debug

# Ver reportes
npm run report
```

## Scripts en package.json

Agregar al `package.json` raíz:

```json
{
  "scripts": {
    "test:e2e": "cd test/e2e && npm run test",
    "test:e2e:headed": "cd test/e2e && npm run test:headed",
    "test:e2e:ui": "cd test/e2e && npm run test:ui",
    "test:e2e:debug": "cd test/e2e && npm run test:debug",
    "test:e2e:report": "cd test/e2e && npm run report",
    "playwright-install": "cd test/e2e && npm run install-browsers"
  }
}
```

## Escritura de Tests

### Estructura Básica

```typescript
import { test, expect } from '@playwright/test';

test.describe('Mi Feature E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Setup antes de cada test
    await page.goto('/');
  });

  test('debe completar un flujo completo', async ({ page }) => {
    // Arrange - Preparar estado inicial
    
    // Act - Ejecutar acciones del usuario
    await page.locator('[data-testid="button"]').click();
    await page.fill('[data-testid="input"]', 'test data');
    
    // Assert - Verificar resultado esperado
    await expect(page.locator('[data-testid="result"]')).toBeVisible();
  });
});
```

### Selectores Recomendados

Usar `data-testid` para elementos interactivos:

```html
<button data-testid="save-button">Guardar</button>
<input data-testid="username-input" />
<div data-testid="error-message">Error</div>
```

### Manejo de Estado

Para tests que requieren estado específico:

```typescript
test.beforeEach(async ({ page }) => {
  // Login automático
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'user@test.com');
  await page.fill('[data-testid="password"]', 'password');
  await page.click('[data-testid="login-button"]');
  
  // Verificar login exitoso
  await expect(page).toHaveURL(/.*dashboard/);
});
```

### Tests en Móvil

```typescript
test('debe funcionar en móvil', async ({ page, isMobile }) => {
  if (isMobile) {
    // Tests específicos para móvil
    const mobileMenu = page.locator('[data-testid="mobile-menu"]');
    await expect(mobileMenu).toBeVisible();
  }
});
```

## Mejores Prácticas

### Organización

1. **Un test por flujo**: Cada test debe representar un flujo completo de usuario
2. **Descripciones claras**: Usar lenguaje de negocio en las descripciones
3. **Setup mínimo**: Solo configurar lo necesario para el test
4. **Aserciones específicas**: Verificar exactamente lo que importa

### Debugging

1. **Screenshots automáticos**: Configurados en `playwright.config.ts`
2. **Videos**: Para tests fallidos
3. **Step-by-step**: Usar `await page.pause()` para debug manual
4. **Logs**: Usar `console.log` en page context

### Performance

1. **Paralelización**: Tests corren en paralelo por defecto
2. **Retries**: Configurado para CI
3. **Timeouts apropiados**: Ajustar según necesidad

## CI/CD Integration

Para integración con CI:

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run playwright-install
      - run: npm run build
      - run: npm run test:e2e
```

## Extensión

Para agregar nuevos tests E2E:

1. Crear archivo en `tests/` siguiendo patrón `*.spec.ts`
2. Usar `data-testid` consistentes
3. Seguir estructura de describe/test
4. Agregar configuración de fixtures si es necesario
5. Actualizar documentación

## Troubleshooting

### Problemas Comunes

1. **Elemento no encontrado**: Verificar `data-testid` y esperar carga
2. **Timing issues**: Usar `waitFor` apropiado
3. **Flaky tests**: Revisar condiciones de carrera
4. **Browser específico**: Verificar configuración de browsers

### Comandos Útiles

```bash
# Generar codegen para nuevos tests
npx playwright codegen localhost:3000

# Actualizar browsers
npx playwright install-deps

# Ver traces
npx playwright show-trace trace.zip
```
