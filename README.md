# MintMind - Modern IDE with AI Integration

[![Build Status](https://img.shields.io/github/actions/workflow/status/jcn363/mintmind/ci.yml)](https://github.com/jcn363/mintmind/actions)
[![Test Coverage](https://imgcodecov.io/gh/jcn363/mintmind/branch/main/graph/badge.svg)](https://codecov.io/gh/jcn363/mintmind)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/bun-v1.0.0-333333?logo=bun&labelColor=white)](https://bun.sh/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0.0-FFC131?logo=tauri&logoColor=white)](https://tauri.app/)
[![Linux x86_64](https://img.shields.io/badge/Linux-x86_64-brightgreen?logo=linux&logoColor=white)](https://ubuntu.com/)

MintMind is a modern, extensible IDE built with TypeScript, Tauri, and Bun, designed for high performance and AI integration.

## ✨ Features

- 🚀 **Blazing Fast** - Built on Bun runtime for exceptional performance
- 🖥️ **Linux x86_64 exclusivo** - Aplicaciones nativas para Linux (Mint 21+, Ubuntu 22.04+, Fedora 40+)
- 🤖 **AI Integration** - Seamless AI assistance through MCP (Model Context Protocol)
- 🧩 **Extensible** - Rich plugin architecture with MintMind extension compatibility
- 💻 **Built-in Tools** - Integrated terminal, debugger, and version control
- 🎨 **Customizable UI** - Theme support and flexible layout options
- 🔍 **Smart Code Navigation** - Go to definition, find references, and more
- 🧪 **Testing** - Built-in test runner with Jest integration

## 🛡️ Soporte Plataformas

MintMind es **exclusivo para Linux x86_64** en distribuciones modernas:

- **Linux Mint 21+** (Ubuntu 22.04 base)
- **Ubuntu 22.04 LTS+**
- **Debian 12+**
- **Fedora 40+**

**No compatible con**: Windows, macOS, ARM/aarch64, 32-bit, o distros legacy (glibc < 2.35).

Todas las instrucciones usan estándares POSIX. Despliegue vía Docker/Podman/Kubernetes.

## 🧪 Testing

MintMind uses a comprehensive four-tier testing strategy:

- **Rust Unit Tests**: `npm run test:rust` - Test Rust backend modules
- **TypeScript Integration Tests**: `npm run test:tauri` - Test Tauri command invocations
- **E2E Tests**: `npm run test:e2e` - Test full application workflows with Playwright
- **Performance Benchmarks**: `npm run test:performance` - Measure bundle size, startup time, memory usage

Run all tests: `npm run test:all`

See [TAURI_TESTING_GUIDE.md](docs/TAURI_TESTING_GUIDE.md) for detailed testing documentation.

## 🚀 Quick Start

### Prerequisites

- Bun 1.1+
- Rust 1.80+ (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y`)
- **Dependencias Linux (Ubuntu 22.04+, Debian 12+, Mint 21+)**:
  ```bash
  sudo apt update
  sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev
  ```

### Installation

```bash
# Clone the repository
git clone https://github.com/jcn363/mintmind.git
cd mintmind

# Install dependencies
bun install
```

### Build and Run

#### Standard Build (CommonJS)

```bash
# Build the application
bun run build

# Start the development server
bun run dev
```

#### ESM Build

MintMind now supports ECMAScript Modules (ESM) for better performance and modern JavaScript features:

```bash
# Build with ESM output
bun run build:esm

# Start the ESM version
bun run start:esm
```

#### Development with ESM

For development with ESM modules, use:

```bash
# Start development server with ESM
bun run start:esm
```

### Building for Production

```bash
# Build the application with ESM
bun run build:esm
npm run tauri:build
```

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) - High-level project structure and design
- [API Reference](docs/API.md) - Comprehensive API documentation
- [Development Guide](docs/DEVELOPMENT.md) - Setting up the development environment
- [Testing Guide](docs/TESTING.md) - Running and writing tests
- [Contribution Guidelines](docs/CONTRIBUTING.md) - How to contribute to MintMind

## 🛠️ Project Structure

```text
MintMind/
├── src/                # Source code
│   ├── main/           # Main process code
│   ├── renderer/       # UI components
│   └── shared/         # Shared utilities
├── extensions/         # Built-in extensions
├── scripts/            # Build and utility scripts
└── tests/              # Test files
```

## 🤝 Contributing

We welcome contributions! Please read our [Contribution Guidelines](docs/CONTRIBUTING.md) to get started.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Visual Studio Code](https://github.com/microsoft/vscode) - For inspiration and extension compatibility
- [Tauri](https://tauri.app/) - For the amazing desktop app framework
- [Bun](https://bun.sh/) - For the fast JavaScript runtime

## Architecture

MintMind uses **Tauri** for its desktop application framework:

- **Frontend**: TypeScript, Monaco Editor (web technologies)
- **Backend**: Rust (native performance and security)
- **IPC**: Tauri commands and events
- **Webview**: WebKitGTK 4.1+ (Linux x86_64)
- **Bundle Size**: ~15-20MB (vs. ~150MB with legacy Electron)
- **Memory Usage**: ~60% lower than Electron
- **Startup Time**: ~70% faster than Electron
- **Security**: Enhanced through Rust's memory safety

## Migration from Electron (Completed)

MintMind has **successfully migrated** from Electron to Tauri, achieving significant improvements in performance, security, and bundle size. All core functionality now runs on Rust backends with Tauri plugins.

**Migration Results:**
- ✅ 85-90% smaller bundle size (150MB → 15-20MB)
- ✅ 70% faster startup time
- ✅ 60% lower memory usage
- ✅ Enhanced security through Rust's memory safety

For historical context and migration details, see:
- [User Migration Guide](docs/TAURI_MIGRATION_USER_GUIDE.md)
- [Extension Developer Guide](docs/TAURI_EXTENSION_DEVELOPER_GUIDE.md)
- [Known Issues](docs/TAURI_KNOWN_ISSUES.md)
- [Complete Removal Documentation](docs/TAURI_REMOVAL_COMPLETE.md)

## MintMind

![MintMind in action](https://user-images.githubusercontent.com/35271042/118224532-3842c400-b438-11eb-923d-a5f66fa6785a.png)

MintMind es un IDE moderno y extensible construido con TypeScript, Tauri y Bun, diseñado para alto rendimiento e integración con IA.

MintMind combina la simplicidad de un editor de código con lo que los desarrolladores necesitan para su ciclo principal de edición-construcción-depuración. Proporciona soporte completo para edición, navegación y comprensión de código junto con depuración ligera, un rico modelo de extensibilidad, e integración ligera con herramientas existentes.

MintMind se actualiza mensualmente con nuevas características y corrección de bugs. Puedes descargarlo para **Linux x86_64** (Mint 21+, Ubuntu 22.04+) en el sitio web de MintMind. Para compilaciones Insiders diarias, build desde fuente.

## Guías de Desarrollo

### Configuración del Entorno de Desarrollo

#### Prerrequisitos

- **Bun** (versión 1.0.0 o superior) - Entorno de ejecución y gestor de paquetes
- **Rust** (última versión estable) - Requerido por Tauri
- **Node.js** (versión 18+ recomendada) - Para compatibilidad con herramientas
- **TypeScript** (versión 5.9.3 o superior)
- **Git** para control de versiones
- **Docker** (opcional, para ejecutar Verdaccio en contenedores

#### Instalación y Configuración

1. **Clonar el repositorio:**

   ```bash
   git clone https://github.com/your-org/mintmind.git
   cd mintmind
   ```

2. **Instalar dependencias:**

   ```bash
   # Instalar dependencias con Bun
   bun install

   # Configurar el registro de paquetes privados (Verdaccio)
   bun config set @mintmind:registry http://localhost:4873
   ```

3. **Configurar hooks de pre-commit:**

   ```bash
   bun run precommit
   ```

#### Scripts de Desarrollo Comunes

- `bun run compile` - Compilar el proyecto
- `bun test` - Ejecutar pruebas con Jest
- `bun run test:watch` - Ejecutar pruebas en modo observación
- `bun run tauri dev` - Iniciar la aplicación Tauri en modo desarrollo
- `bun run lint` - Verificar y corregir estilo de código
- `bun run build` - Construir para producción
- `bun run verdaccio:start` - Iniciar servidor Verdaccio local
- `bun run verdaccio:adduser` - Añadir usuario a Verdaccio

### Desarrollo de Extensiones

MintMind soporta un ecosistema de extensiones potente y modular:

- **Extensiones de Lenguaje**: Soporte para sintaxis, IntelliSense y debugging
- **Extensiones de Tema**: Personalización de apariencia con soporte para temas dinámicos
- **Extensiones de Herramientas**: Integración con sistemas externos y servicios en la nube
- **Extensiones Tauri**: Acceso nativo al sistema operativo
- **Extensiones Web**: Compatibles con versiones navegador y desktop

Para desarrollar extensiones, consulta la documentación en [`extensions/README.md`](extensions/README.md).

### Convenciones de Código

- **Lenguajes**: camelCase para variables/funciones, PascalCase para clases/interfaces
- **Archivos**: kebab-case (ej: `my-component.ts`)
- **Constantes**: SCREAMING_SNAKE_CASE
- **Commits**: Seguir Conventional Commits
- **PRs**: Incluir pruebas y actualizar documentación

## Contribuir

Hay muchas formas de participar en este proyecto:

- [Enviar bugs y solicitudes de características](https://github.com/jcn363/mintmind/issues), y ayudar a verificarlos cuando se implementen
- Revisar [cambios en el código fuente](https://github.com/jcn363/mintmind/pulls)
- Revisar la [documentación](docs/) y hacer pull requests para cualquier cosa desde errores tipográficos hasta contenido nuevo

Si estás interesado en corregir issues y contribuir directamente al código base,
consulta los documentos detallados:

### Documentos de Desarrollo

- **[Guía de Desarrollo](DEVELOPMENT.md)**: Configuración del entorno, convenciones de código, testing y mejores prácticas
- **[Cómo Contribuir](CONTRIBUTING.md)**: Flujo de trabajo completo para contribución al proyecto
- **[Arquitectura del Sistema](docs/)**: Documentación técnica detallada sobre componentes internos
- **[APIs](APIs.md)**: Referencia completa de APIs públicas

### Flujo de Contribución

1. **Configurar el entorno**: Seguir las [guías de desarrollo](#guías-de-desarrollo) anteriores
2. **Encontrar un issue**: Revisar issues etiquetados como `good first issue` o `help wanted`
3. **Crear una rama**: `git checkout -b feature/nombre-funcionalidad`
4. **Implementar**: Escribir código siguiendo las convenciones del proyecto
5. **Probar**: Ejecutar `bun test` y `bun run smoketest`
6. **Documentar**: Actualizar documentación si es necesario
7. **Crear PR**: Hacer un pull request con descripción detallada

### Requisitos para Pull Requests

- ✅ Código probado con tests unitarios
- ✅ Linting pasando (`bun run eslint`)
- ✅ Documentación actualizada
- ✅ Commits siguiendo Conventional Commits
- ✅ Al menos una revisión aprobada

## Comunidad y Soporte

- Hacer preguntas en [Stack Overflow](https://stackoverflow.com/questions/tagged/mintmind)
- [Solicitar nuevas características](CONTRIBUTING.md)
- Votar por [solicitudes de características populares](https://github.com/jcn363/mintmind/issues?q=is%3Aopen+is%3Aissue+label%3Afeature-request+sort%3Areactions-%2B1-desc)
- [Reportar un issue](https://github.com/jcn363/mintmind/issues)
- Conectar con la comunidad de autores de extensiones en [GitHub Discussions](https://github.com/jcn363/mintmind-discussions/discussions) o [Discord](https://discord.gg/mintmind)

Consulta nuestros [discussions](https://github.com/jcn363/mintmind/discussions) para una descripción de cada uno de estos canales e información sobre otros canales disponibles impulsados por la comunidad.

## Directrices de Desarrollo Global

Seguimos un conjunto de principios fundamentales para garantizar la calidad y consistencia en todo el proyecto. Estos son los puntos clave:

### Principios Clave

- **Enfoque en la Innovación**: Priorizamos características modernas sobre la compatibilidad con versiones antiguas
- **Tareas Granulares**: Descomponemos tareas en pasos secuenciales manejables
- **Cambios Incrementales**: Implementamos cambios de uno en uno, con validación continua
- **Manejo de Errores**: Corregimos errores en incrementos pequeños con commits frecuentes
- **Principio DRY**: Eliminamos duplicación con utilidades reutilizables
- **Responsabilidad Única**: Cada módulo tiene una única responsabilidad clara
- **Automatización**: Automatizamos flujos de trabajo repetitivos
- **Gestión de Paquetes**: Usamos `bun` como gestor de paquetes exclusivo para JavaScript/TypeScript

### Priorización de Tareas

1. Resolución de problemas de dependencias
2. Corrección de errores de importación
3. Arreglo de inconsistencias en el sistema de tipos
4. Mejora de la calidad del código
5. Validación de compilación y pruebas

Para la documentación completa de las directrices de desarrollo, consulta [GLOBAL_RULES.md](docs/GLOBAL_RULES.md).

## Documentación Técnica

### Referencias Principales

- **[APIs Públicas](APIs.md)**: Referencia completa de APIs para desarrollo de extensiones
- **[Arquitectura Tauri](https://tauri.app/v1/guides/architecture/)**: Documentación sobre la arquitectura de Tauri
- **[Guía de Bun](https://bun.sh/docs)**: Documentación completa de Bun
- **[Jest Testing](https://jestjs.io/docs/getting-started)**: Guía de pruebas con Jest
- **[Verdaccio](https://verdaccio.org/docs/what-is-verdaccio)**: Documentación de configuración y uso
- **[Guías de Migración](docs/)**: Instrucciones para actualizar versiones
- **[Referencia de Configuración](docs/)**: Opciones de configuración avanzadas

### Desarrollo Avanzado

- **Desarrollo de Extensiones**: [Guía completa](extensions/README.md)
- **Contribución al Core**: [Instrucciones detalladas](DEVELOPMENT.md)
- **Testing**: Estrategias y mejores prácticas de testing
- **Performance**: Optimización y profiling del sistema

### Recursos Adicionales

- **Wiki del Proyecto**: [Documentación comunitaria](docs/)
- **Blog de Desarrollo**: Actualizaciones y anuncios técnicos
- **Ejemplos de Código**: Repositorios con ejemplos prácticos

## Related Projects

Many of the core components and extensions to MintMind live in their own repositories on GitHub. For a complete list, please visit the [Related Projects](docs/RELATED_PROJECTS.md) page in our documentation.

## Bundled Extensions

MintMind includes a set of built-in extensions located in the [extensions](extensions) folder, including grammars and snippets for many languages. Extensions that provide rich language support (inline suggestions, Go to Definition) for a language have the suffix `language-features`. For example, the `json` extension provides coloring for `JSON` and the `json-language-features` extension provides rich language support for `JSON`.

## Development Container

This repository includes a MintMind development container for consistent development environments.

- For Dev Containers, use the **Dev Containers: Clone Repository in Container Volume...** command which creates a Docker volume for better disk I/O.

- For GitHub Codespaces, use the **Codespaces: Create New Codespace** command.

Docker / the Codespace should have at least **4 Cores and 6 GB of RAM (8 GB recommended)** to run a full build. See the [development container README](.devcontainer/README.md) for more information.

## Code of Conduct

This project has adopted the MintMind Code of Conduct to foster an inclusive and respectful community. For more information, please refer to our [Code of Conduct](CODE_OF_CONDUCT.md) or contact [conduct@mintmind.dev](mailto:conduct@mintmind.dev) with any questions or concerns.

## License



Licensed under the [MIT](LICENSE.txt) license.
