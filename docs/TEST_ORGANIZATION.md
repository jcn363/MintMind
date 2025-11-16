# Organización de Tests - MintMind

Este documento describe la organización y estructura de los tests en el proyecto MintMind.

## Estructura de Tests

```
test/
├── unit/                 # Tests unitarios (Jest)
├── integration/         # Tests de integración (Jest)
│   ├── jest.config.js   # Configuración específica
│   ├── setup.ts         # Setup global
│   ├── helpers/         # Utilidades compartidas
│   └── services/        # Tests de integración
├── e2e/                 # Tests E2E (Playwright)
│   ├── playwright.config.ts
│   ├── tests/           # Tests E2E
│   └── package.json
├── smoke/               # Tests de humo
├── automation/          # Tests de automatización
├── mcp/                 # Tests MCP
└── monaco/              # Tests Monaco
```

## Tipos de Tests

### 1. Tests Unitarios

**Ubicación**: `src/vs/**/__tests__/` y `test/unit/`

**Propósito**: Probar unidades individuales de código en aislamiento.

**Herramienta**: Jest

**Configuración**: `jest.config.js` (raíz)

### 2. Tests de Integración

**Ubicación**: `test/integration/`

**Propósito**: Validar interacción entre componentes y módulos.

**Características**:
- Configuración Jest específica
- Setup de BD/servidor de test
- Helpers reutilizables
- Cobertura del 70% mínimo

**Ejecución**:
```bash
npm run test:integration
```

### 3. Tests E2E

**Ubicación**: `test/e2e/`

**Propósito**: Validar flujos completos desde la interfaz de usuario.

**Características**:
- Playwright para automatización de browsers
- Múltiples navegadores y dispositivos
- Screenshots y videos automáticos
- Servidor de desarrollo integrado

**Ejecución**:
```bash
npm run test:e2e
```

### 4. Tests de Smoke

**Ubicación**: `test/smoke/`

**Propósito**: Verificación rápida de funcionalidad básica.

### 5. Tests de Automatización

**Ubicación**: `test/automation/`

**Propósito**: Automatización de tareas de testing.

### 6. Tests MCP

**Ubicación**: `test/mcp/`

**Propósito**: Tests específicos del protocolo MCP.

## Configuraciones

### Jest Global (`jest.config.js`)

- Configuración base para todos los tests unitarios
- Transformaciones TypeScript
- Cobertura general
- ESM support

### Jest Integration (`test/integration/jest.config.js`)

- Timeouts extendidos (30s)
- Setup específico para integración
- Cobertura dedicada
- Detección de archivos `.integration.test.ts`

### Playwright (`test/e2e/playwright.config.ts`)

- Múltiples navegadores
- Dispositivos móviles
- Servidor automático
- Paralelización

## Scripts de Ejecución

```json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:integration": "jest --config test/integration/jest.config.js",
    "test:e2e": "cd test/e2e && npm run test",
    "test:smoke": "cd test/smoke && npm run mocha"
  }
}
```

## Mejores Prácticas

### Organización por Tipo

1. **Unitarios**: Un archivo `.test.ts` por módulo
2. **Integración**: Agrupados por funcionalidad (`services/`, `api/`)
3. **E2E**: Un archivo por flujo de usuario principal

### Nomenclatura

- `*.test.ts` - Tests unitarios
- `*.spec.ts` - Tests E2E (convención Playwright)
- `*.integration.test.ts` - Tests de integración

### Estructura de Tests

```typescript
describe('Componente Bajo Test', () => {
  describe('Método específico', () => {
    it('debe hacer algo específico', () => {
      // Arrange, Act, Assert
    });

    it('debe manejar error case', () => {
      // Error cases
    });
  });
});
```

### Mocks y Fixtures

- Mocks en `__mocks__/` directorios
- Fixtures compartidas en `test/fixtures/`
- Helpers reutilizables en `test/helpers/`

## Cobertura

### Objetivos por Tipo

- **Unitarios**: 80%+ cobertura
- **Integración**: 70%+ cobertura
- **E2E**: Cobertura de flujos críticos

### Reportes

- Cobertura unitaria: `coverage/`
- Cobertura integración: `coverage/integration/`
- Reportes E2E: `test/e2e/playwright-report/`

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - run: npm run test:integration
      - run: npm run playwright-install
      - run: npm run test:e2e
```

## Debugging

### Herramientas por Tipo

- **Unitarios**: VS Code debugger con Jest
- **Integración**: Console logs, BD inspection
- **E2E**: Playwright UI mode, screenshots

### Troubleshooting

1. **Tests lentos**: Revisar setup/teardown
2. **Flaky tests**: Verificar timing, mocks
3. **Cobertura baja**: Identificar código no testeado

## Extensión

### Agregar Nuevo Tipo de Test

1. Crear directorio en `test/`
2. Agregar configuración específica
3. Crear `README.md` con documentación
4. Agregar scripts al `package.json`
5. Actualizar este documento

### Mantener Tests

- Ejecutar tests regularmente
- Actualizar después de cambios en código
- Revisar cobertura periódicamente
- Limpiar tests obsoletos
