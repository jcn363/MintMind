# Development Guidelines

This document outlines the development practices and guidelines for the MintMind project.

## Table of Contents

- [Development Environment](#development-environment)
- [Code Organization](#code-organization)
- [Testing](#testing)
- [Code Quality](#code-quality)
- [Security](#security)
- [Performance](#performance)
- [Documentation](#documentation)
- [Version Control](#version-control)

## Development Environment

### Prerequisites

- Node.js (versión 18+ recomendada)
- bun (para dependencias JavaScript/TypeScript)
- TypeScript (versión 5.9.3 o superior)
- Python 3.x (para scripts de construcción)
- Git

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/your-org/mintmind.git
   cd mintmind
   ```

2. Install dependencies:

    ```bash
    # Install dependencies
    bun install
    ```

3. Set up pre-commit hooks:

    ```bash
    bun run precommit
    ```

## Code Organization

### Project Structure

```text
mintmind/
├── src/                    # TypeScript/JavaScript source code
├── extensions/             # MintMind extensions
├── scripts/                # Build and utility scripts
├── docs/                   # Documentation
├── test/                   # Test suites (unit, integration, smoke, etc.)
├── remote/                 # Remote development components
├── build/                  # Build system and tooling
├── cli/                    # Command-line interface
└── .github/                # GitHub workflows and templates
```

### Naming Conventions

- **Archivos TypeScript/JavaScript**: camelCase para variables y funciones, PascalCase para clases e interfaces
- **Archivos**: kebab-case para nombres de archivos (ej: `my-component.ts`)
- **Constantes**: SCREAMING_SNAKE_CASE
- **Directorios**: kebab-case
- **Extensiones**: PascalCase con prefijo descriptivo (ej: `JsonValidationError`)

## Testing

### Test Organization

- **Pruebas unitarias**: En archivos junto al código testeado, con sufijo `.test.ts`
- **Pruebas de integración**: En `test/integration/`
- **Pruebas smoke**: En `test/smoke/`
- **Pruebas de extensión**: En `test/unit/` y subdirectorios específicos

### Running Tests

```bash
# Ejecutar todas las pruebas
bun test

# Pruebas unitarias específicas
bun run test-node

# Pruebas de integración
./scripts/test-integration.sh

# Pruebas smoke
bun run smoketest

# Pruebas de extensión
bun run test-extension
```

## Code Quality

### Linting

```bash
# ESLint para TypeScript/JavaScript
bun run eslint

# Verificación de tipos TypeScript
bun run compile-check-ts-native

# Chequeo de estilo de código
bun run stylelint
```

### Formatting

```bash
# Formateo con Prettier
bun run format

# Verificación de formato
bun run format-check
```

## Security

### Dependency Scanning

```bash
# Escaneo con bun
bun audit

# Actualización de dependencias vulnerables
bun update
```

### Secure Coding Practices

- Utilizar el sistema de tipos para validar inputs
- Sanitizar datos de entrada en APIs públicas
- Implementar Content Security Policy (CSP)
- Usar principios de least privilege en extensiones
- Validar certificados SSL/TLS

## Performance

### Profiling

```bash
# Perfiles de rendimiento con herramientas de Node.js
node --inspect scripts/code-perf.js

# Análisis de heap
node --inspect --heap-prof scripts/heap-prof.js
```

### Optimization

- Usar lazy loading para componentes y extensiones
- Minimizar el bundle size con tree-shaking
- Optimizar algoritmos críticos con mediciones de rendimiento
- Usar estructuras de datos eficientes (Map vs Object, etc.)
- Implementar virtualización para listas grandes

## Documentation

### Code Documentation

- Documentar todas las APIs públicas con JSDoc/TSDoc
- Incluir ejemplos en archivos de documentación separados
- Mantener documentación actualizada con cambios de código

### Project Documentation

- Mantener README.md actualizado con instalación y uso
- Documentar decisiones arquitectónicas en `docs/`
- Generar changelog automáticamente con conventional commits

## Version Control

### Branching Strategy

- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `release/*`: Release preparation

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Pull Requests

- Reference related issues
- Include tests for new features
- Update documentation
- Get at least one review before merging

## CI/CD

El proyecto utiliza GitHub Actions para CI/CD con los siguientes workflows principales:

1. **CI**: Se ejecuta en cada push y PR
   - Compilación del proyecto (`bun run compile`)
   - Ejecución de pruebas (`bun test`)
   - Verificación de linting y formato
   - Escaneo de seguridad con `bun audit`

2. **CD**: Se ejecuta en tags de versión
   - Construcción de artefactos de release
   - Publicación en registros de paquetes
   - Despliegue a entornos de staging/production

## License

This project is licensed under the [MIT License](LICENSE).
