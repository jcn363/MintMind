# Tests de Integración - MintMind

Este directorio contiene los tests de integración para MintMind, que validan la interacción entre diferentes módulos y componentes del sistema.

## Estructura

```
test/integration/
├── jest.config.js          # Configuración específica para tests de integración
├── setup.ts               # Configuración global para tests de integración
├── helpers/               # Utilidades compartidas para tests
│   ├── test-db.ts        # Utilidades para BD de test
│   └── test-server.ts    # Utilidades para servidor de test
├── services/             # Tests de integración de servicios
│   └── workbench.integration.test.ts
└── README.md             # Esta documentación
```

## Configuración

### Jest Configuration

Los tests de integración usan una configuración Jest específica (`jest.config.js`) que incluye:

- Timeouts extendidos (30s) para operaciones de integración
- Configuración de cobertura específica para integración
- Setup global y teardown
- Detección automática de archivos `.integration.test.ts`

### Setup Global

El archivo `setup.ts` configura:

- Variables de entorno para tests
- Timeouts globales
- Limpieza de mocks entre tests
- Configuración de BD y servidor de test

## Helpers

### Test Database Helper (`helpers/test-db.ts`)

Proporciona utilidades para:

- Conectar/desconectar de BD de test
- Limpiar datos entre tests
- Seed de datos de prueba
- Singleton pattern para instancia de BD

### Test Server Helper (`helpers/test-server.ts`)

Proporciona utilidades para:

- Iniciar/detener servidor HTTP de test
- Configuración de puerto y URL base
- Mocks de endpoints comunes

## Ejecutar Tests

```bash
# Ejecutar todos los tests de integración
npm run test:integration

# Ejecutar con configuración específica
npx jest --config test/integration/jest.config.js

# Ejecutar tests específicos
npx jest --config test/integration/jest.config.js --testNamePattern="Workbench Services"

# Con cobertura
npx jest --config test/integration/jest.config.js --coverage
```

## Scripts en package.json

Agregar al `package.json` raíz:

```json
{
  "scripts": {
    "test:integration": "jest --config test/integration/jest.config.js",
    "test:integration:coverage": "jest --config test/integration/jest.config.js --coverage",
    "test:integration:watch": "jest --config test/integration/jest.config.js --watch"
  }
}
```

## Mejores Prácticas

### Estructura de Tests

1. **Setup/Teardown apropiado**: Usar `beforeAll`/`afterAll` para recursos costosos
2. **Mocks inteligentes**: Mockear dependencias externas pero probar integración real
3. **Datos de prueba consistentes**: Usar helpers para crear datos predecibles
4. **Aislamiento**: Cada test debe ser independiente

### Ejemplo de Test

```typescript
describe('Mi Servicio Integration', () => {
  let testDb: TestDatabase;
  let testServer: TestServer;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    testServer = await setupTestServer();
  });

  afterAll(async () => {
    await teardownTestServer();
    await teardownTestDatabase();
  });

  it('debe hacer algo específico', async () => {
    // Arrange
    const input = { data: 'test' };
    
    // Act
    const result = await myService.doSomething(input);
    
    // Assert
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});
```

### Cobertura

Los tests de integración deben mantener una cobertura mínima del 70% en:

- Funciones
- Líneas
- Ramas
- Statements

## Debugging

Para debuggear tests de integración:

1. Usar `--verbose` para más output
2. Usar `console.log` en helpers (temporalmente)
3. Verificar configuración de BD/servidor
4. Revisar mocks que puedan interferir

## Extensión

Para agregar nuevos tests de integración:

1. Crear archivo en directorio apropiado (`services/`, `api/`, etc.)
2. Seguir patrón de nomenclatura: `*.integration.test.ts`
3. Usar helpers disponibles
4. Actualizar mocks según necesites
5. Agregar documentación en este README si es necesario
