# APIs de MintMind

## Resumen Ejecutivo

Esta documentación detalla las APIs principales de MintMind, incluyendo interfaces TypeScript, contratos de servicios y protocolos de comunicación. MintMind extiende las APIs de MintMind con capacidades MCP (Model Context Protocol) para integración avanzada de IA.

## Arquitectura de APIs

MintMind utiliza un sistema de APIs en capas que proporciona abstracciones desde servicios de bajo nivel hasta APIs de alto nivel para extensiones.

### Capas de APIs:

```
┌─────────────────────────────────────────┐
│         APIs de Extensiones             │
│   (vscode.* APIs, Extension Host)       │
├─────────────────────────────────────────┤
│         APIs de Servicios               │
│   (Workbench Services, Platform APIs)   │
├─────────────────────────────────────────┤
│         APIs MCP                        │
│   (Model Context Protocol APIs)         │
├─────────────────────────────────────────┤
│         APIs Base                       │
│   (Utilidades, Common APIs)             │
└─────────────────────────────────────────┘
```

## APIs de Servicios de Plataforma

### IExtensionManagementService

Servicio principal para gestión del ciclo de vida de extensiones.

```typescript
export interface IExtensionManagementService {
  readonly _serviceBrand: undefined;

  readonly preferPreReleases: boolean;

  // Eventos del ciclo de vida
  onInstallExtension: Event<InstallExtensionEvent>;
  onDidInstallExtensions: Event<readonly InstallExtensionResult[]>;
  onUninstallExtension: Event<UninstallExtensionEvent>;
  onDidUninstallExtension: Event<DidUninstallExtensionEvent>;
  onDidUpdateExtensionMetadata: Event<DidUpdateExtensionMetadata>;

  // Operaciones principales
  zip(extension: ILocalExtension): Promise<URI>;
  getManifest(vsix: URI): Promise<IExtensionManifest>;
  install(vsix: URI, options?: InstallOptions): Promise<ILocalExtension>;
  canInstall(extension: IGalleryExtension): Promise<true | IMarkdownString>;
  installFromGallery(extension: IGalleryExtension, options?: InstallOptions): Promise<ILocalExtension>;
  installGalleryExtensions(extensions: InstallExtensionInfo[]): Promise<InstallExtensionResult[]>;
  installFromLocation(location: URI, profileLocation: URI): Promise<ILocalExtension>;
  installExtensionsFromProfile(extensions: IExtensionIdentifier[], fromProfileLocation: URI, toProfileLocation: URI): Promise<ILocalExtension[]>;
  uninstall(extension: ILocalExtension, options?: UninstallOptions): Promise<void>;
  uninstallExtensions(extensions: UninstallExtensionInfo[]): Promise<void>;
  toggleApplicationScope(extension: ILocalExtension, fromProfileLocation: URI): Promise<ILocalExtension>;
  getInstalled(type?: ExtensionType, profileLocation?: URI, productVersion?: IProductVersion, language?: string): Promise<ILocalExtension[]>;
  getExtensionsControlManifest(): Promise<IExtensionsControlManifest>;
  copyExtensions(fromProfileLocation: URI, toProfileLocation: URI): Promise<void>;
  updateMetadata(local: ILocalExtension, metadata: Partial<Metadata>, profileLocation: URI): Promise<ILocalExtension>;
  resetPinnedStateForAllUserExtensions(pinned: boolean): Promise<void>;

  // Descarga y verificación
  download(extension: IGalleryExtension, operation: InstallOperation, donotVerifySignature: boolean): Promise<URI>;

  // Participantes y configuración
  registerParticipant(pariticipant: IExtensionManagementParticipant): void;
  getTargetPlatform(): Promise<TargetPlatform>;

  // Limpieza
  cleanUp(): Promise<void>;
}
```

**Eventos principales:**
- `InstallExtensionEvent`: Inicio de instalación de extensión
- `InstallExtensionResult`: Resultado de instalación (éxito/error)
- `UninstallExtensionEvent`: Inicio de desinstalación
- `DidUninstallExtensionEvent`: Confirmación de desinstalación

**Opciones de instalación:**
```typescript
export type InstallOptions = {
  isBuiltin?: boolean;
  isWorkspaceScoped?: boolean;
  isMachineScoped?: boolean;
  isApplicationScoped?: boolean;
  pinned?: boolean;
  donotIncludePackAndDependencies?: boolean;
  installGivenVersion?: boolean;
  preRelease?: boolean;
  installPreReleaseVersion?: boolean;
  donotVerifySignature?: boolean;
  operation?: InstallOperation;
  profileLocation?: URI;
  productVersion?: IProductVersion;
  keepExisting?: boolean;
  downloadExtensionsLocally?: boolean;
  context?: IStringDictionary<any>;
};
```

### IExtensionGalleryService

Servicio para interacción con marketplaces de extensiones.

```typescript
export interface IExtensionGalleryService {
  readonly _serviceBrand: undefined;

  isEnabled(): boolean;
  query(options: IQueryOptions, token: CancellationToken): Promise<IPager<IGalleryExtension>>;
  getExtensions(extensionInfos: ReadonlyArray<IExtensionInfo>, token: CancellationToken): Promise<IGalleryExtension[]>;
  getExtensions(extensionInfos: ReadonlyArray<IExtensionInfo>, options: IExtensionQueryOptions, token: CancellationToken): Promise<IGalleryExtension[]>;
  isExtensionCompatible(extension: IGalleryExtension, includePreRelease: boolean, targetPlatform: TargetPlatform, productVersion?: IProductVersion): Promise<boolean>;
  getCompatibleExtension(extension: IGalleryExtension, includePreRelease: boolean, targetPlatform: TargetPlatform, productVersion?: IProductVersion): Promise<IGalleryExtension | null>;
  getAllCompatibleVersions(extensionIdentifier: IExtensionIdentifier, includePreRelease: boolean, targetPlatform: TargetPlatform): Promise<IGalleryExtensionVersion[]>;
  getAllVersions(extensionIdentifier: IExtensionIdentifier): Promise<IGalleryExtensionVersion[]>;
  download(extension: IGalleryExtension, location: URI, operation: InstallOperation): Promise<void>;
  downloadSignatureArchive(extension: IGalleryExtension, location: URI): Promise<void>;
  reportStatistic(publisher: string, name: string, version: string, type: StatisticType): Promise<void>;
  getReadme(extension: IGalleryExtension, token: CancellationToken): Promise<string>;
  getManifest(extension: IGalleryExtension, token: CancellationToken): Promise<IExtensionManifest | null>;
  getChangelog(extension: IGalleryExtension, token: CancellationToken): Promise<string>;
  getCoreTranslation(extension: IGalleryExtension, languageId: string): Promise<ITranslation | null>;
  getExtensionsControlManifest(): Promise<IExtensionsControlManifest>;
}
```

**Interfaces de datos:**
```typescript
export interface IGalleryExtension {
  type: 'gallery';
  name: string;
  identifier: IGalleryExtensionIdentifier;
  version: string;
  displayName: string;
  publisherId: string;
  publisher: string;
  publisherDisplayName: string;
  description: string;
  installCount: number;
  rating: number;
  ratingCount: number;
  categories: readonly string[];
  tags: readonly string[];
  releaseDate: number;
  lastUpdated: number;
  preview: boolean;
  private: boolean;
  hasPreReleaseVersion: boolean;
  hasReleaseVersion: boolean;
  isSigned: boolean;
  allTargetPlatforms: TargetPlatform[];
  assets: IGalleryExtensionAssets;
  properties: IGalleryExtensionProperties;
}
```

## APIs MCP (Model Context Protocol)

### McpManagementService

Servicio para gestión de servidores MCP.

```typescript
export interface IMcpManagementService {
  readonly _serviceBrand: undefined;

  // Estado y configuración
  readonly state: IMcpState;
  readonly onDidChangeState: Event<IMcpState>;

  // Gestión de servidores
  registerServer(id: string, configuration: IMcpServerConfiguration): Promise<void>;
  unregisterServer(id: string): Promise<void>;
  getServer(id: string): IMcpServer | undefined;
  getServers(): readonly IMcpServer[];

  // Ciclo de vida
  startServer(id: string): Promise<void>;
  stopServer(id: string): Promise<void>;
  restartServer(id: string): Promise<void>;

  // Comunicación
  callTool(id: string, toolName: string, args: any): Promise<any>;
  getPrompt(id: string, promptName: string, args?: any): Promise<string>;
  getResource(id: string, resourceName: string): Promise<any>;
  listTools(id: string): Promise<IMcpTool[]>;
  listPrompts(id: string): Promise<IMcpPrompt[]>;
  listResources(id: string): Promise<IMcpResource[]>;
}
```

### Configuraciones de Servidores MCP:

```typescript
export interface IMcpStdioServerConfiguration extends ICommonMcpServerConfiguration {
  readonly type: McpServerType.LOCAL;
  readonly command: string;
  readonly args?: readonly string[];
  readonly env?: Record<string, string | number | null>;
  readonly envFile?: string;
  readonly cwd?: string;
  readonly dev?: IMcpDevModeConfig;
}

export interface IMcpRemoteServerConfiguration extends ICommonMcpServerConfiguration {
  readonly type: McpServerType.REMOTE;
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly dev?: IMcpDevModeConfig;
}

export type IMcpServerConfiguration = IMcpStdioServerConfiguration | IMcpRemoteServerConfiguration;
```

### Tipos MCP:

```typescript
export interface IMcpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: object;
}

export interface IMcpPrompt {
  readonly name: string;
  readonly description: string;
  readonly arguments?: readonly IMcpPromptArgument[];
}

export interface IMcpResource {
  readonly uri: string;
  readonly name: string;
  readonly description?: string;
  readonly mimeType?: string;
}
```

## APIs de Workbench

### IEditorService

Servicio para gestión de editores.

```typescript
export interface IEditorService {
  readonly _serviceBrand: undefined;

  // Gestión de editores
  openEditor(editorInput: IEditorInput, options?: IEditorOptions): Promise<IEditor | null>;
  replaceEditors(editors: IUntypedEditorInput[], group: IEditorGroup | GroupIdentifier): Promise<void>;
  closeEditors(editors: IEditorInput[], group: IEditorGroup | GroupIdentifier): Promise<void>;

  // Grupos de editores
  readonly groups: readonly IEditorGroup[];
  readonly activeGroup: IEditorGroup;
  readonly mainGroup: IEditorGroup;

  // Eventos
  readonly onDidActiveEditorChange: Event<void>;
  readonly onDidVisibleEditorsChange: Event<void>;
  readonly onDidEditorsChange: Event<void>;
  readonly onDidEditorGroupChange: Event<IEditorGroupChangeEvent>;

  // Operaciones
  save(editors: IEditorInput[]): Promise<boolean>;
  saveAll(): Promise<boolean>;
  revert(editors: IEditorInput[]): Promise<boolean>;
  revertAll(): Promise<boolean>;
}
```

### IWorkspaceService

Servicio para gestión de workspaces.

```typescript
export interface IWorkspaceService {
  readonly _serviceBrand: undefined;

  // Workspace actual
  readonly workspace: IWorkspace | null;
  readonly workspaces: readonly IWorkspace[];
  readonly workspaceFolder: IWorkspaceFolder | null;
  readonly workspaceFolders: readonly IWorkspaceFolder[];

  // Eventos
  readonly onDidChangeWorkspaceFolders: Event<IWorkspaceFoldersChangeEvent>;
  readonly onDidChangeWorkspaceName: Event<void>;
  readonly onDidChangeWorkbenchState: Event<WorkbenchState>;

  // Operaciones
  enterWorkspace(workspace: URI): Promise<IEnterWorkspaceResult | null>;
  createWorkspace(folders: IWorkspaceFolderCreationData[], path?: URI): Promise<IWorkspace>;
  saveWorkspace(options?: ISaveWorkspaceOptions): Promise<IWorkspace | null>;
  addFolders(folders: IWorkspaceFolderCreationData[]): Promise<void>;
  removeFolders(folders: URI[]): Promise<void>;
  updateFolders(start: number, deleteCount?: number, folders?: IWorkspaceFolderCreationData[]): Promise<void>;
}
```

### ISearchService

Servicio de búsqueda integrado.

```typescript
export interface ISearchService {
  readonly _serviceBrand: undefined;

  // Búsqueda de texto
  textSearch(query: ITextQuery, token?: CancellationToken, onProgress?: (result: ISearchProgressItem) => void): Promise<ISearchComplete>;

  // Búsqueda de archivos
  fileSearch(query: IFileQuery, token?: CancellationToken): Promise<ISearchComplete>;

  // Configuración
  readonly searchEditor: ISearchEditorService;

  // Eventos
  readonly onDidRunSearch: Event<ISearchEvent>;
  readonly onDidFinishSearch: Event<ISearchEvent>;
}
```

## APIs de Extensiones

### Extension Host API

La API de extension host permite a las extensiones interactuar con MintMind.

```typescript
// Activación de extensión
export interface IExtensionContext {
  readonly extension: IExtensionDescription;
  readonly globalState: Memento;
  readonly workspaceState: Memento;
  readonly subscriptions: { dispose(): any }[];
  readonly extensionUri: Uri;
  readonly extensionPath: string;
  readonly environmentVariableCollection: EnvironmentVariableCollection;
  readonly storageUri: Uri | undefined;
  readonly globalStorageUri: Uri;
  readonly logUri: Uri;
  readonly extensionMode: ExtensionMode;
}

// Registro de comandos
export interface ICommandRegistry {
  registerCommand(command: string, handler: (...args: any[]) => any, thisArg?: any): Disposable;
  registerTextEditorCommand(command: string, handler: (textEditor: TextEditor, edit: TextEditorEdit, ...args: any[]) => void, thisArg?: any): Disposable;
  executeCommand<T>(command: string, ...rest: any[]): Thenable<T | undefined>;
}

// Contribuciones de extensiones
export interface IExtensionContributions {
  commands?: ICommand[];
  configuration?: any;
  debuggers?: IDebugger[];
  grammars?: IGrammar[];
  jsonValidation?: IJSONValidation[];
  keybindings?: IKeyBinding[];
  languages?: ILanguage[];
  menus?: { [context: string]: IMenu[] };
  snippets?: ISnippet[];
  themes?: ITheme[];
  iconThemes?: ITheme[];
  productIconThemes?: ITheme[];
  viewsContainers?: { [location: string]: IViewContainer[] };
  views?: { [location: string]: IView[] };
  colors?: IColor[];
  localizations?: ILocalizationContribution[];
  customEditors?: readonly IWebviewEditor[];
  codeActions?: readonly ICodeActionContribution[];
  authentication?: IAuthenticationContribution[];
  walkthroughs?: IWalkthrough[];
  startEntries?: IStartEntry[];
  notebooks?: INotebookEntry[];
  notebookRenderer?: INotebookRendererContribution[];
  debugVisualizers?: IDebugVisualizationContribution[];
  chatParticipants?: ReadonlyArray<IChatParticipantContribution>;
  languageModelTools?: ReadonlyArray<IToolContribution>;
  languageModelToolSets?: ReadonlyArray<IToolSetContribution>;
  mcpServerDefinitionProviders?: ReadonlyArray<IMcpCollectionContribution>;
}
```

## APIs MCP en Extensiones

### Language Model Tools

```typescript
export interface IToolContribution {
  name: string;
  displayName: string;
  modelDescription: string;
  userDescription?: string;
}

export interface IToolSetContribution {
  name: string;
  referenceName: string;
  description: string;
  icon?: string;
  tools: string[];
}
```

### Chat Participants

```typescript
export interface IChatParticipantContribution {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  isDefault?: boolean;
  commands?: { name: string }[];
}
```

## Protocolos de Comunicación

### JSON-RPC Protocol

MintMind utiliza JSON-RPC para comunicación entre procesos.

```typescript
interface IRPCMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: IRPCError;
}

interface IRPCError {
  code: number;
  message: string;
  data?: any;
}
```

### MCP Protocol

Protocolo específico para comunicación con servidores MCP.

```typescript
interface IMcpMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

// Métodos MCP principales
type McpMethod =
  | 'initialize'
  | 'initialized'
  | 'tools/list'
  | 'tools/call'
  | 'prompts/list'
  | 'prompts/get'
  | 'resources/list'
  | 'resources/read'
  | 'resources/templates/list'
  | 'logging/setLevel'
  | 'notifications/initialized';
```

## APIs de Configuración

### IConfigurationService

Servicio para gestión de configuraciones.

```typescript
export interface IConfigurationService {
  readonly _serviceBrand: undefined;

  // Configuración actual
  readonly configuration: IConfiguration;

  // Eventos
  readonly onDidChangeConfiguration: Event<IConfigurationChangeEvent>;

  // Operaciones
  getValue<T>(section?: string, overrides?: IConfigurationOverrides): T;
  updateValue(key: string, value: any, configurationTarget?: ConfigurationTarget, overrideIdentifier?: string): Promise<void>;
  inspect<T>(key: string, overrideIdentifier?: string): IConfigurationValue<T>;
  reloadConfiguration(configurationTarget?: ConfigurationTarget): Promise<void>;
  keys(): IConfigurationKeys;
}
```

## APIs de Sistema de Archivos

### IFileService

Abstracción del sistema de archivos.

```typescript
export interface IFileService {
  readonly _serviceBrand: undefined;

  // Operaciones de archivos
  createFile(resource: URI, content?: IFileContent, options?: ICreateFileOptions): Promise<IFileStatWithMetadata>;
  readFile(resource: URI, options?: IReadFileOptions): Promise<IFileContent>;
  writeFile(resource: URI, content: IFileContent, options?: IWriteFileOptions): Promise<IFileStatWithMetadata>;
  delete(resource: URI, options?: IDeleteOptions): Promise<void>;
  move(source: URI, target: URI, overwrite?: boolean): Promise<IFileStatWithMetadata>;
  copy(source: URI, target: URI, overwrite?: boolean): Promise<IFileStatWithMetadata>;

  // Operaciones de directorios
  createFolder(resource: URI): Promise<IFileStatWithMetadata>;
  resolve(resource: URI, options?: IResolveOptions): Promise<IFileStat>;
  exists(resource: URI): Promise<boolean>;
  stat(resource: URI): Promise<IFileStat>;

  // Eventos
  readonly onDidRunOperation: Event<IFileOperationEvent>;
  readonly onDidChangeFileSystemProviderRegistrations: Event<IFileSystemProviderRegistrationEvent>;
  readonly onDidChangeFileSystemProviderCapabilities: Event<IFileSystemProviderCapabilitiesEvent>;
}
```

## Conclusión

Las APIs de MintMind proporcionan una interfaz completa y bien estructurada para interactuar con todas las capas de la aplicación. Desde servicios de bajo nivel hasta APIs de alto nivel para extensiones, el sistema está diseñado para ser extensible, mantenible y fácil de usar. La integración de MCP añade una capa adicional de capacidades de IA que complementa perfectamente las APIs existentes de MintMind.
