# Configuración de Jest para MintMind

## Resumen
Esta guía documenta la configuración de Jest para el proyecto MintMind, incluyendo la integración con TypeScript, cobertura de código y pipelines de CI/CD.

## Configuración de Jest

### Archivo: `jest.config.js`

```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],

  // Configuración de archivos de test
  roots: ['<rootDir>/src', '<rootDir>/extensions', '<rootDir>/test'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.spec.ts',
    '**/?(*.)+(spec|test).ts'
  ],

  // Transformación de TypeScript
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        'target': 'ES2020',
        'module': 'ESNext',
        'moduleResolution': 'node',
        'allowSyntheticDefaultImports': true,
        'esModuleInterop': true,
        'strict': false,
        'exactOptionalPropertyTypes': false,
        'skipLibCheck': true
      },
      diagnostics: {
        ignoreCodes: ['TS6133', 'TS2345', 'TS18046', 'TS2339'],
        warnOnly: true
      }
    }]
  },

  // Mapeo de módulos
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^vs/(.*)$': '<rootDir>/src/vs/$1'
  },

  // Configuración de cobertura
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Configuración de rendimiento
  maxWorkers: 1,
  testTimeout: 15000,
  bail: false,

  // Exclusiones
  testPathIgnorePatterns: [
    '/node_modules/',
    '/out/',
    '/build/',
    '/coverage/'
  ]
};
```

## Problemas Resueltos

### 1. Errores de TypeScript
- **Problema**: Jest no podía parsear archivos TypeScript correctamente
- **Solución**: Configuración de `ts-jest` con preset ESM y configuración de TypeScript relajada

### 2. Problemas de Memoria
- **Problema**: Tests fallaban con "JavaScript heap out of memory"
- **Solución**: Reducido `maxWorkers` a 1 y deshabilitado `detectOpenHandles`

### 3. Errores de Módulos ESM
- **Problema**: Imports de módulos ESM no funcionaban
- **Solución**: Configuración de `extensionsToTreatAsEsm` y `moduleNameMapper`

## Scripts de NPM

### Archivo: `package.json`

```json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

## Configuración de CI/CD

### GitHub Actions

#### Archivo: `.github/workflows/jest-tests.yml`
- Ejecuta tests en múltiples versiones de Node.js (18.x, 20.x)
- Genera reportes de cobertura
- Sube cobertura a Codecov

#### Archivo: `.github/workflows/code-quality.yml`
- Ejecuta ESLint
- Verifica tipos TypeScript
- Ejecuta tests
- Construye el proyecto

#### Archivo: `.github/workflows/publish.yml`
- Publica paquete en NPM cuando se crean tags
- Publica en Verdaccio para desarrollo

## Comandos Útiles

```bash
# Ejecutar todos los tests
npm run test

# Ejecutar tests con cobertura
npm run test:coverage

# Ejecutar tests en modo watch
npm run test:watch

# Ejecutar solo tests de integración
npx jest --config test/integration/jest.config.js
```

## Cobertura de Código

- **Umbral global**: 70% para branches, functions, lines y statements
- **Reportes**: Texto en consola, LCOV y HTML
- **Directorio**: `./coverage/`

## Dependencias

### DevDependencies requeridas:
- `jest`: Framework de testing
- `ts-jest`: Transformador TypeScript para Jest
- `@types/jest`: Tipos para Jest

## Troubleshooting

### Error: "Unexpected token 'export'"
- Verificar configuración de `extensionsToTreatAsEsm`
- Asegurar que los archivos usan extensiones `.js` en imports

### Error: "Cannot find module"
- Verificar `moduleNameMapper` para rutas relativas
- Revisar configuración de `roots`

### Error: "Jest did not exit"
- Reducir `maxWorkers`
- Deshabilitar `detectOpenHandles`

## Mejores Prácticas

1. **Escribir tests descriptivos** con nombres claros
2. **Usar mocks apropiados** para dependencias externas
3. **Mantener cobertura alta** especialmente en lógica crítica
4. **Ejecutar tests regularmente** durante desarrollo
5. **Revisar reportes de cobertura** para identificar áreas sin test

## Configuración de Verdaccio

Para desarrollo local, el proyecto está configurado para publicar en Verdaccio:

```json
{
  "publishConfig": {
    "registry": "http://localhost:4873"
  }
}
```

## 5. Actualización de Pipelines CI/CD para Migración a Jest

Esta sección cubre las actualizaciones necesarias en las configuraciones de CI/CD para migrar de frameworks de testing previos a Jest. Se incluyen ejemplos para plataformas populares como GitHub Actions, GitLab CI, Jenkins y otros sistemas.

### GitHub Actions

#### Antes (con Mocha/Karma):
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    - run: npm ci
    - run: npm run test:mocha  # O karma start
```

#### Después (con Jest):
```yaml
name: Jest Tests
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  jest-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 21.x]

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Cache Jest cache
      uses: actions/cache@v3
      with:
        path: |
          .jest/cache
          node_modules/.cache/jest
        key: ${{ runner.os }}-jest-${{ hashFiles('**/package-lock.json') }}
        restore-keys: |
          ${{ runner.os }}-jest-

    - name: Install dependencies
      run: npm ci

    - name: Run Jest tests with coverage
      run: npm run test:coverage
      env:
        CI: true
        JEST_JUNIT_OUTPUT_DIR: ./test-results/junit.xml

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
        fail_ci_if_error: false

    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results-${{ matrix.node-version }}
        path: |
          coverage/
          test-results/
        retention-days: 30

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run integration tests
      run: npx jest --config test/integration/jest.config.js --testTimeout=30000
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
```

### GitLab CI

#### Archivo: `.gitlab-ci.yml`

```yaml
stages:
  - test
  - coverage
  - deploy

variables:
  JEST_JUNIT_OUTPUT_DIR: "test-results/junit.xml"
  JEST_JUNIT_OUTPUT_NAME: "junit.xml"

jest-tests:
  stage: test
  image: node:20-alpine
  cache:
    key: "$CI_COMMIT_REF_SLUG"
    paths:
      - node_modules/
      - .jest/
  before_script:
    - npm ci --cache .npm --prefer-offline
  script:
    - npm run test
  artifacts:
    reports:
      junit: test-results/junit.xml
    paths:
      - coverage/
    expire_in: 1 week
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  only:
    - merge_requests
    - main

jest-coverage:
  stage: coverage
  image: node:20-alpine
  dependencies:
    - jest-tests
  script:
    - npm run test:coverage
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
    paths:
      - coverage/
    expire_in: 1 month
  only:
    - main
```

### Jenkins Pipeline

#### Archivo: `Jenkinsfile`

```groovy
pipeline {
    agent {
        docker {
            image 'node:20-alpine'
            args '-u root'
        }
    }

    environment {
        JEST_JUNIT_OUTPUT_DIR = 'test-results'
        JEST_JUNIT_OUTPUT_NAME = 'junit.xml'
        CI = 'true'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Jest Tests') {
            steps {
                sh 'npm run test'
            }
            post {
                always {
                    junit 'test-results/junit.xml'
                    publishCoverage adapters: [
                        istanbulCoberturaAdapter('coverage/cobertura-coverage.xml')
                    ]
                }
            }
        }

        stage('Jest Coverage') {
            steps {
                sh 'npm run test:coverage'
            }
            post {
                always {
                    publishCoverage adapters: [
                        istanbulCoberturaAdapter('coverage/cobertura-coverage.xml')
                    ],
                    sourceFileResolver: sourceFiles('NEVER_STORE')
                }
            }
        }

        stage('Security Tests') {
            steps {
                sh 'npx jest --testPathPattern=security'
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: true
            cleanWs()
        }
        success {
            script {
                def coverage = sh(script: 'cat coverage/lcov-report/index.html | grep -o "Lines.*%" | head -1', returnStdout: true).trim()
                echo "Coverage: ${coverage}"
            }
        }
    }
}
```

### Travis CI

#### Archivo: `.travis.yml`

```yaml
language: node_js
node_js:
  - '18'
  - '20'

cache:
  directories:
    - node_modules
    - .jest

env:
  - CI=true

before_script:
  - npm ci

script:
  - npm run test:coverage

after_success:
  - npx codecov

deploy:
  provider: npm
  email: $NPM_EMAIL
  api_key: $NPM_TOKEN
  skip_cleanup: true
  on:
    tags: true
    node: '20'
```

### CircleCI

#### Archivo: `.circleci/config.yml`

```yaml
version: 2.1

orbs:
  node: circleci/node@5.1.0
  coverage-reporter: circleci/coverage-reporter@0.1.2

workflows:
  test:
    jobs:
      - test:
          matrix:
            parameters:
              node-version: ["18", "20"]

jobs:
  test:
    parameters:
      node-version:
        type: string
    docker:
      - image: cimg/node:<< parameters.node-version >>
    steps:
      - checkout
      - node/install-packages:
          cache-version: v1
      - run:
          name: Run Jest tests
          command: npm run test:coverage
          environment:
            JEST_JUNIT_OUTPUT_DIR: test-results/junit.xml
      - coverage-reporter/report:
          coverage-files: coverage/lcov.info
          coverage-reporter-flags: unittests
      - store_test_results:
          path: test-results
      - store_artifacts:
          path: coverage

  integration-test:
    docker:
      - image: cimg/node:20
      - image: postgres:15
        environment:
          POSTGRES_PASSWORD: test
    steps:
      - checkout
      - node/install-packages:
          cache-version: v1
      - run:
          name: Run integration tests
          command: npx jest --config test/integration/jest.config.js
          environment:
            DATABASE_URL: postgresql://postgres:test@localhost:5432/circle_test
```

### Estrategias de Caché

#### GitHub Actions:
```yaml
- name: Cache Jest cache
  uses: actions/cache@v3
  with:
    path: |
      .jest/cache
      node_modules/.cache/jest
    key: ${{ runner.os }}-jest-${{ hashFiles('**/package-lock.json') }}
```

#### Jenkins:
```groovy
pipeline {
    agent any
    stages {
        stage('Test') {
            steps {
                script {
                    def npmCache = '.npm'
                    sh "mkdir -p ${npmCache}"
                }
                sh 'npm ci --cache .npm'
                sh 'npm run test'
            }
        }
    }
}
```

### Integración de Reportes

#### Configuración de Jest para reportes:
```javascript
// jest.config.js
module.exports = {
  // ... otras configuraciones
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml',
      ancestorSeparator: ' › ',
      uniqueOutputName: false,
      suiteNameTemplate: '{filepath}',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }]
  ],
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
  ],
  coverageReporters: [
    'text',
    'lcov',
    'cobertura',
    'html'
  ]
};
```

#### Dependencias adicionales:
```json
{
  "devDependencies": {
    "jest-junit": "^16.0.0",
    "codecov": "^3.8.3"
  }
}
```

### Variables de Entorno y Configuración

```bash
# Variables de entorno comunes para CI
CI=true
JEST_JUNIT_OUTPUT_DIR=test-results/junit.xml
JEST_JUNIT_OUTPUT_NAME=junit.xml

# Configuración de cobertura
COVERAGE_THRESHOLD=70
COVERAGE_REPORTER=lcov

# Configuración de base de datos para tests de integración
DATABASE_URL=postgresql://user:password@localhost:5432/test_db
REDIS_URL=redis://localhost:6379
```

### Mejores Prácticas para CI/CD con Jest

1. **Paralelización**: Usa Jest's `--maxWorkers` para paralelizar tests
2. **Caching**: Cache `node_modules` y `.jest` para builds más rápidos
3. **Matriz de versiones**: Test en múltiples versiones de Node.js
4. **Cobertura**: Configura umbrales de cobertura y reportes
5. **Artefactos**: Guarda reportes de cobertura y resultados de tests
6. **Servicios**: Usa servicios de base de datos para tests de integración
7. **Tiempos de espera**: Configura timeouts apropiados para diferentes tipos de tests

### Troubleshooting Común

#### Error: "Jest cache not found"
- Solución: Asegúrate de que el directorio `.jest` existe y es writable
- Añade: `mkdir -p .jest` en before_script

#### Error: "Coverage reports not generated"
- Solución: Verifica que `collectCoverage: true` esté configurado
- Asegúrate de que los archivos de cobertura existen antes de subirlos

#### Tests lentos en CI
- Solución: Reduce `maxWorkers` o usa `--runInBand`
- Cache dependencias y archivos de Jest

#### Problemas de memoria
- Solución: Configura `maxWorkers: 2` o `maxWorkers: 1`
- Usa `--expose-gc` si es necesario

## Próximos Pasos

- [ ] Configurar tests de integración más específicos
- [ ] Implementar tests de rendimiento automatizados
- [ ] Agregar tests de accesibilidad
- [ ] Configurar tests de end-to-end con Playwright