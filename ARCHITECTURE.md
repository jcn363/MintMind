# Arquitectura de MintMind

## Resumen Ejecutivo

MintMind es una implementación basada en MintMind que combina capacidades avanzadas de edición de código con integración nativa de IA a través del protocolo MCP (Model Context Protocol). Esta documentación describe la arquitectura técnica completa, incluyendo capas, componentes principales, flujos de datos y patrones de diseño utilizados.

## Arquitectura General

MintMind sigue una arquitectura modular en capas, inspirada en MintMind pero extendida con capacidades MCP para integración de IA. La arquitectura se divide en cuatro capas principales:

```
┌─────────────────────────────────────────┐
│           Capa de Aplicación           │
│   (Workbench, Extensiones, MCP)        │
├─────────────────────────────────────────┤
│         Capa de Servicios              │
│   (Plataforma, Extensiones, Base)      │
├─────────────────────────────────────────┤
│         Capa de Plataforma             │
│   (Electron, Browser, Remote)          │
├─────────────────────────────────────────┤
│           Capa Base                    │
│   (Utilidades, Tipos, Common)          │
└─────────────────────────────────────────┘

## Directory Naming Convention

### Historical Context: electron-main and electron-browser

You may notice directory names like `electron-main` and `electron-browser` throughout the codebase. **These names are historical** and do not indicate Electron dependencies. They represent architectural layers:

- **`electron-main`**: Code that runs in the **main process** (now Tauri's Rust backend)
  - Examples: `src/vs/platform/window/electron-main/`, `src/vs/platform/lifecycle/electron-main/`
  - Tauri equivalent: Rust commands in `src-tauri/src/`

- **`electron-browser`**: Code that runs in the **renderer process** (now Tauri's webview)
  - Examples: `src/vs/platform/window/electron-browser/`, `src/vs/base/parts/sandbox/electron-browser/`
  - Tauri equivalent: Frontend TypeScript code using `@tauri-apps/api`

### Why Keep These Names?

1. **Architectural Clarity**: The names clearly distinguish main process vs. renderer process code
2. **VS Code Compatibility**: Maintains compatibility with upstream VS Code architecture
3. **Migration History**: Preserves git history and makes it easier to track changes
4. **No Runtime Dependency**: The directory names are purely organizational—no Electron code remains

### Tauri Architecture Mapping

| Legacy (Electron) | Current (Tauri) | Purpose |
|-------------------|-----------------|----------|
| `electron-main` | Rust backend (`src-tauri/`) | Main process, native APIs |
| `electron-browser` | TypeScript frontend + Tauri API | Renderer process, UI |
| `ipcMain`/`ipcRenderer` | Tauri commands/events | Inter-process communication |
| `BrowserWindow` | `WebviewWindow` | Window management |
| Node.js modules | Rust crates | Native functionality |

All Electron APIs have been replaced with Tauri equivalents. See `docs/TAURI_REMOVAL_COMPLETE.md` for details.

## Capas Arquitectónicas

### 1. Capa Base (`src/vs/base/`)

La capa base proporciona utilidades fundamentales y código compartido:

#### Componentes Principales:
- **Async Utilities**: Gestión de operaciones asíncronas, promesas y timers
- **Cancellation**: Sistema de cancelación de operaciones
- **Collections**: Estructuras de datos avanzadas (arrays, maps, sets)
- **Errors**: Manejo unificado de errores
- **Event System**: Sistema de eventos basado en suscripción
- **Filters**: Algoritmos de filtrado y búsqueda
- **History**: Gestión de historial y navegación
- **Lifecycle**: Gestión del ciclo de vida de componentes
- **Network**: Utilidades de red y protocolos
- **Performance**: Métricas de rendimiento
- **Platform Detection**: Detección de plataforma y capacidades
- **Product Info**: Información del producto
- **URI Handling**: Manipulación de URIs y rutas
- **UUID Generation**: Generación de identificadores únicos

#### Patrones de Diseño:
- **Observer Pattern**: Para el sistema de eventos
- **Factory Pattern**: Para creación de componentes
- **Singleton Pattern**: Para servicios compartidos

### 2. Capa de Plataforma (`src/vs/platform/`)

La capa de plataforma proporciona servicios de bajo nivel y abstracciones:

#### Servicios Principales:

**Gestión de Extensiones**:
- `IExtensionManagementService`: Gestión completa del ciclo de vida de extensiones
- `IExtensionGalleryService`: Interacción con marketplaces de extensiones
- `IBuiltinExtensionsScannerService`: Descubrimiento de extensiones integradas

**MCP (Model Context Protocol)**:
- `McpManagementService`: Gestión de servidores MCP
- `McpGalleryService`: Descubrimiento de servidores MCP
- `McpPlatformTypes`: Tipos y configuraciones MCP

**Sistema de Archivos**:
- `IFileService`: Abstracción de sistema de archivos
- `IDiskFileService`: Implementación nativa de disco

**Configuración**:
- `IConfigurationService`: Gestión de configuraciones
- `IWorkspaceConfigurationService`: Configuración de workspace

**Trabajo en Equipo**:
- `ISCMService`: Control de versiones
- `ISCMProvider`: Proveedores SCM (Git, etc.)

**Terminal**:
- `ITerminalService`: Gestión de terminales
- `IShellIntegrationService`: Integración con shell

#### Arquitectura por Plataformas:
- **Common**: Código compartido entre plataformas
- **Browser**: Implementaciones específicas del navegador
- **Electron**: Implementaciones específicas de Electron
- **Node**: Servicios que requieren Node.js

### 3. Capa de Servicios (`src/vs/workbench/`)

La capa de workbench proporciona la experiencia del usuario y componentes de alto nivel:

#### Áreas Principales del Workbench:

**Editor**:
- `IEditorService`: Gestión de editores
- `ITextFileService`: Manejo de archivos de texto
- `ICodeEditorService`: Servicios específicos de código

**Explorer y Navegación**:
- `IExplorerService`: Explorador de archivos
- `IWorkspaceService`: Gestión de workspaces
- `INavigationService`: Navegación entre vistas

**Búsqueda**:
- `ISearchService`: Funcionalidad de búsqueda
- `ISearchView`: Vista de resultados de búsqueda

**Extensiones**:
- `IExtensionService`: Gestión del host de extensiones
- `IExtensionHost`: Comunicación con hosts de extensiones

**Debugging**:
- `IDebugService`: Servicios de depuración
- `IBreakpointService`: Gestión de breakpoints

**Testing**:
- `ITestingService`: Framework de testing integrado

**Output y Consola**:
- `IOutputService`: Gestión de salida
- `IConsoleService`: Servicios de consola

### 4. Capa de Aplicación (`src/vs/code/`)

La capa superior que integra todo en la aplicación final:

#### Componentes Principales:
- **Main Process** (Electron): Proceso principal de la aplicación
- **Renderer Process**: Proceso de renderizado (Workbench)
- **Extension Hosts**: Procesos para ejecutar extensiones
- **Remote Agents**: Agentes para entornos remotos

## Arquitectura MCP (Model Context Protocol)

MintMind integra el protocolo MCP para proporcionar capacidades de IA avanzadas:

### Componentes MCP:

**Servidores MCP**:
- **Stdio Servers**: Servidores que se ejecutan como procesos hijos
- **HTTP Servers**: Servidores remotos accesibles vía HTTP
- **Local Discovery**: Descubrimiento automático de servidores locales

**Tipos de Herramientas MCP**:
- **Language Model Tools**: Herramientas de modelos de lenguaje
- **Tool Sets**: Colecciones de herramientas relacionadas
- **Prompts**: Plantillas de prompts reutilizables
- **Resources**: Recursos contextuales para IA

**Gestión MCP**:
- **Server Management**: Instalación, configuración y monitoreo
- **Connection Handling**: Gestión de conexiones y protocolos
- **Security**: Autenticación y autorización

### Flujo de Datos MCP:

```
Usuario → Workbench → MCP Client → MCP Server → AI Model
    ↑          ↑            ↑            ↑         ↑
    └── Resultado ←────── Resultado ←─── Resultado ←─
```

## Patrón de Arquitectura por Plataformas

MintMind utiliza un patrón de arquitectura por plataformas para maximizar la compatibilidad:

### Patrón de Implementación:

```typescript
// Interfaz común
interface IService {
  method(): void;
}

// Implementación específica por plataforma
class BrowserService implements IService {
  method() { /* implementación browser */ }
}

class ElectronService implements IService {
  method() { /* implementación electron */ }
}
```

### Ventajas:
- **Compatibilidad**: Funciona en múltiples entornos
- **Optimización**: Implementaciones específicas por plataforma
- **Mantenibilidad**: Código organizado por responsabilidades
- **Extensibilidad**: Fácil agregar nuevas plataformas

## Patrón de Servicios

MintMind utiliza un patrón de servicios basado en inyección de dependencias:

### Registry de Servicios:
```typescript
const IService = createDecorator<IService>('serviceId');

class ServiceImpl implements IService {
  readonly _serviceBrand: undefined;
  // implementación
}

// Registro en el contenedor
Registry.as<IInstantiationService>(InstantiationService)
  .registerSingleton(IService, ServiceImpl);
```

### Beneficios:
- **Desacoplamiento**: Servicios independientes
- **Testabilidad**: Fácil mocking de dependencias
- **Reutilización**: Servicios compartidos
- **Configuración**: Fácil cambio de implementaciones

## Patrón de Extensiones

Las extensiones siguen un patrón de contribución declarativa:

### Manifest de Extensión:
```json
{
  "contributes": {
    "commands": [...],
    "languages": [...],
    "themes": [...],
    "mcpServers": [...]
  }
}
```

### Arquitectura de Extensiones:
- **Activation Events**: Eventos que activan extensiones
- **Contribution Points**: Puntos de extensión declarativos
- **Extension Host**: Entorno de ejecución aislado
- **API de Extensiones**: Interfaz para interactuar con MintMind

## Patrón de Comunicación

MintMind utiliza múltiples protocolos de comunicación:

### IPC (Inter-Process Communication):
- **Electron IPC**: Comunicación entre procesos en Electron
- **Message Passing**: Comunicación asíncrona basada en mensajes

### RPC (Remote Procedure Call):
- **JSON-RPC**: Para comunicación con extensiones
- **MCP Protocol**: Para comunicación con servidores IA

### Eventos:
- **EventEmitter**: Sistema de eventos locales
- **Global Events**: Eventos globales de aplicación

## Patrón de Estado

### Gestión de Estado:
- **Workspace State**: Estado del workspace actual
- **Global State**: Estado global de la aplicación
- **Extension State**: Estado específico de extensiones
- **UI State**: Estado de la interfaz de usuario

### Persistencia:
- **Storage Service**: Persistencia de configuración
- **Backup Service**: Copias de seguridad automáticas
- **Sync Service**: Sincronización entre dispositivos

## Seguridad y Privacidad

### Arquitectura de Seguridad:
- **Extension Sandboxing**: Aislamiento de extensiones
- **Content Security Policy**: Políticas de seguridad de contenido
- **Permission System**: Sistema de permisos granular
- **MCP Security**: Autenticación y autorización para servidores IA

### Privacidad:
- **Data Collection**: Control de recopilación de datos
- **Local Processing**: Procesamiento local cuando es posible
- **User Consent**: Consentimiento explícito del usuario

## Rendimiento y Optimización

### Estrategias de Rendimiento:
- **Lazy Loading**: Carga diferida de componentes
- **Virtualization**: Renderizado virtual para listas grandes
- **Caching**: Cache inteligente de recursos
- **Web Workers**: Procesamiento en segundo plano

### Métricas y Monitoreo:
- **Performance Service**: Métricas de rendimiento
- **Telemetry**: Telemetría opcional
- **Crash Reporting**: Reportes de errores

## Conclusión

La arquitectura de MintMind combina lo mejor de MintMind con capacidades avanzadas de IA a través de MCP. La separación clara en capas, los patrones de diseño consistentes y la arquitectura modular permiten una plataforma extensible, mantenible y de alto rendimiento que puede adaptarse a futuras necesidades mientras mantiene compatibilidad con el ecosistema de extensiones existente.
