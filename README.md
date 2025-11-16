# MintMind - Entorno de Desarrollo Integrado

[![Feature Requests](https://img.shields.io/github/issues/microsoft/vscode/feature-request.svg)](https://github.com/microsoft/vscode/issues?q=is%3Aopen+is%3Aissue+label%3Afeature-request+sort%3Areactions-%2B1-desc)
[![Bugs](https://img.shields.io/github/issues/microsoft/vscode/bug.svg)](https://github.com/microsoft/vscode/issues?utf8=✓&q=is%3Aissue+is%3Aopen+label%3Abug)
[![Gitter](https://img.shields.io/badge/chat-on%20gitter-yellow.svg)](https://gitter.im/Microsoft/vscode)

## El Repositorio

Este repositorio ("`MintMind`") es donde desarrollamos el entorno de desarrollo integrado MintMind junto con la comunidad. Aquí trabajamos no solo en el código y los issues, sino que también publicamos nuestro [roadmap](https://github.com/microsoft/vscode/wiki/Roadmap), [planes de iteración mensuales](https://github.com/microsoft/vscode/wiki/Iteration-Plans), y nuestros [planes de finalización](https://github.com/microsoft/vscode/wiki/Running-the-Endgame). Este código fuente está disponible para todos bajo la licencia estándar [MIT](LICENSE.txt).

## Arquitectura del Proyecto

MintMind está construido sobre una arquitectura modular y extensible que permite una experiencia de desarrollo fluida y personalizable. El proyecto se organiza en las siguientes capas principales:

### Componentes Principales

- **Core Engine** (`src/`): Motor central que maneja el procesamiento de código, gestión de extensiones y comunicación entre procesos
- **Extensiones** (`extensions/`): Sistema de extensiones integrado que proporciona soporte para múltiples lenguajes de programación y herramientas
- **CLI** (`cli/`): Interfaz de línea de comandos para operaciones automatizadas
- **Build System** (`build/`): Sistema de construcción y empaquetado que utiliza Gulp y Webpack
- **Remote Development** (`remote/`): Componentes para desarrollo remoto y colaboración
- **Testing Framework** (`test/`): Suites de pruebas unitarias, integración y smoke testing

### Tecnologías Clave

- **TypeScript/JavaScript**: Lenguajes principales con soporte completo para ES modules
- **Electron**: Framework para aplicaciones de escritorio multiplataforma
- **Bun**: Gestor de paquetes moderno y rápido
- **WebAssembly**: Para componentes de alto rendimiento como el parser de lenguajes
- **WebGL**: Para renderizado avanzado del editor y terminal integrada

### Arquitectura de Extensiones

Las extensiones siguen una arquitectura de host múltiple:

- **Extension Host**: Ejecuta extensiones en un proceso separado para aislamiento y rendimiento
- **Language Server Protocol**: Comunicación estándar con servidores de lenguaje
- **Web Extensions**: Soporte para extensiones que funcionan tanto en navegador como desktop

## MintMind

![MintMind in action](https://user-images.githubusercontent.com/35271042/118224532-3842c400-b438-11eb-923d-a5f66fa6785a.png)

[MintMind](https://code.visualstudio.com) es una distribución del repositorio `MintMind` con personalizaciones específicas de desarrollo colaborativo liberadas bajo una licencia tradicional [MIT](LICENSE.txt).

MintMind combina la simplicidad de un editor de código con lo que los desarrolladores necesitan para su ciclo principal de edición-construcción-depuración. Proporciona soporte completo para edición, navegación y comprensión de código junto con depuración ligera, un rico modelo de extensibilidad, e integración ligera con herramientas existentes.

MintMind se actualiza mensualmente con nuevas características y corrección de bugs. Puedes descargarlo para Windows, macOS y Linux en el sitio web de MintMind. Para obtener las últimas versiones diariamente, instala la compilación [Insiders](https://code.visualstudio.com/insiders).

## Guías de Desarrollo

### Configuración del Entorno de Desarrollo

#### Prerrequisitos

- **Node.js** (versión 18+ recomendada)
- **Bun** (para dependencias JavaScript/TypeScript)
- **TypeScript** (versión 5.9.3 o superior)
- **Python 3.x** (para scripts de construcción)
- **Git** para control de versiones

#### Instalación y Configuración

1. **Clonar el repositorio:**

   ```bash
   git clone https://github.com/your-org/mintmind.git
   cd mintmind
   ```

2. **Instalar dependencias:**

   ```bash
   bun install
   ```

3. **Configurar hooks de pre-commit:**

   ```bash
   bun run precommit
   ```

#### Scripts de Desarrollo Comunes

- `bun run compile` - Compilar el proyecto
- `bun test` - Ejecutar todas las pruebas
- `bun run watch` - Modo de desarrollo con recarga automática
- `bun run lint` - Verificar y corregir estilo de código
- `bun run build` - Construir para producción

### Desarrollo de Extensiones

MintMind soporta un rico ecosistema de extensiones que amplían su funcionalidad:

- **Extensiones de Lenguaje**: Soporte para sintaxis, IntelliSense y debugging
- **Extensiones de Tema**: Personalización de apariencia
- **Extensiones de Herramientas**: Integración con sistemas externos
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

- [Enviar bugs y solicitudes de características](https://github.com/microsoft/vscode/issues), y ayudar a verificarlos cuando se implementen
- Revisar [cambios en el código fuente](https://github.com/microsoft/vscode/pulls)
- Revisar la [documentación](https://github.com/microsoft/vscode-docs) y hacer pull requests para cualquier cosa desde errores tipográficos hasta contenido nuevo

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

- Hacer preguntas en [Stack Overflow](https://stackoverflow.com/questions/tagged/vscode)
- [Solicitar nuevas características](CONTRIBUTING.md)
- Votar por [solicitudes de características populares](https://github.com/microsoft/vscode/issues?q=is%3Aopen+is%3Aissue+label%3Afeature-request+sort%3Areactions-%2B1-desc)
- [Reportar un issue](https://github.com/microsoft/vscode/issues)
- Conectar con la comunidad de autores de extensiones en [GitHub Discussions](https://github.com/microsoft/vscode-discussions/discussions) o [Slack](https://aka.ms/vscode-dev-community)
- Seguir [@code](https://twitter.com/code) y hacernos saber qué piensas!

Consulta nuestro [wiki](https://github.com/microsoft/vscode/wiki/Feedback-Channels) para una descripción de cada uno de estos canales e información sobre otros canales disponibles impulsados por la comunidad.

## Documentación Técnica

### Referencias Principales

- **[APIs Públicas](APIs.md)**: Referencia completa de APIs para desarrollo de extensiones
- **[Arquitectura del Sistema](docs/)**: Documentación detallada de componentes internos
- **[Guías de Migración](docs/)**: Instrucciones para actualizar versiones
- **[Referencia de Configuración](docs/)**: Opciones de configuración avanzadas

### Desarrollo Avanzado

- **Desarrollo de Extensiones**: [Guía completa](extensions/README.md)
- **Contribución al Core**: [Instrucciones detalladas](DEVELOPMENT.md)
- **Testing**: Estrategias y mejores prácticas de testing
- **Performance**: Optimización y profiling del sistema

### Recursos Adicionales

- **Wiki del Proyecto**: [Documentación comunitaria](https://github.com/microsoft/vscode/wiki)
- **Blog de Desarrollo**: Actualizaciones y anuncios técnicos
- **Ejemplos de Código**: Repositorios con ejemplos prácticos

## Related Projects

Many of the core components and extensions to MintMind live in their own repositories on GitHub. For example, the [node debug adapter](https://github.com/microsoft/vscode-node-debug) and the [mono debug adapter](https://github.com/microsoft/vscode-mono-debug) repositories are separate from each other. For a complete list, please visit the [Related Projects](https://github.com/microsoft/vscode/wiki/Related-Projects) page on our [wiki](https://github.com/microsoft/vscode/wiki).

## Bundled Extensions

MintMind includes a set of built-in extensions located in the [extensions](extensions) folder, including grammars and snippets for many languages. Extensions that provide rich language support (inline suggestions, Go to Definition) for a language have the suffix `language-features`. For example, the `json` extension provides coloring for `JSON` and the `json-language-features` extension provides rich language support for `JSON`.

## Development Container

This repository includes a Visual Studio Code Dev Containers / GitHub Codespaces development container.

- For [Dev Containers](https://aka.ms/vscode-remote/download/containers), use the **Dev Containers: Clone Repository in Container Volume...** command which creates a Docker volume for better disk I/O on macOS and Windows.
  - If you already have MintMind and Docker installed, you can also click [here](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/microsoft/vscode) to get started. This will cause MintMind to automatically install the Dev Containers extension if needed, clone the source code into a container volume, and spin up a dev container for use.

- For Codespaces, install the [GitHub Codespaces](https://marketplace.visualstudio.com/items?itemName=GitHub.codespaces) extension in MintMind, and use the **Codespaces: Create New Codespace** command.

Docker / the Codespace should have at least **4 Cores and 6 GB of RAM (8 GB recommended)** to run a full build. See the [development container README](.devcontainer/README.md) for more information.

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [MIT](LICENSE.txt) license.