export class MultiEditorTabsControl extends EditorTabsControl {

	private static readonly SCROLLBAR_SIZES = {
		default: 3 as const,
		large: 10 as const
	};

	private static readonly TAB_WIDTH = {
		compact: 38 as const,
		shrink: 80 as const,
		fit: 120 as const
	};

	private static readonly DRAG_OVER_OPEN_TAB_THRESHOLD = 1500;
	private static readonly MOUSE_WHEEL_EVENT_THRESHOLD = 150;
	private static readonly MOUSE_WHEEL_DISTANCE_THRESHOLD = 1.5;

	// Configuración de virtualización para optimización de memoria
	private static readonly VIRTUAL_SCROLL_CONFIG = {
		BUFFER_SIZE: 5, // Número de tabs adicionales a renderizar fuera del viewport
		MAX_RENDERED_TABS: 50, // Máximo número de tabs a renderizar simultáneamente
		TAB_HEIGHT: 35, // Altura estimada de cada tab
		CONTAINER_HEIGHT: 200 // Altura del contenedor de scroll
	};

	private titleContainer: HTMLElement | undefined;
	private tabsAndActionsContainer: HTMLElement | undefined;
	private tabsContainer: HTMLElement | undefined;
	private tabsScrollbar: ScrollableElement | undefined;
	private tabSizingFixedDisposables: DisposableStore | undefined;

	// Propiedades para virtualización
	private virtualScrollTop: number = 0;
	private renderedTabsStart: number = 0;
	private renderedTabsEnd: number = 0;
	private tabHeights: Map<number, number> = new Map();
	private visibleTabsCache: Set<number> = new Set();

	private readonly closeEditorAction = this._register(this.instantiationService.createInstance(CloseEditorTabAction, CloseEditorTabAction.ID, CloseEditorTabAction.LABEL));
	private readonly unpinEditorAction = this._register(this.instantiationService.createInstance(UnpinEditorAction, UnpinEditorAction.ID, UnpinEditorAction.LABEL));

	private readonly tabResourceLabels = this._register(this.instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER));
	private tabLabels: IEditorInputLabel[] = [];
	private activeTabLabel: IEditorInputLabel | undefined;

	private tabActionBars: ActionBar[] = [];
	private tabDisposables: IDisposable[] = [];

	private dimensions: IEditorTitleControlDimensions & { used?: Dimension } = {
		container: Dimension.None,
		available: Dimension.None
	};

	private readonly layoutScheduler = this._register(new MutableDisposable<IScheduledMultiEditorTabsControlLayout>());
	private blockRevealActiveTab: boolean | undefined;

	private path: IPath = isWindows ? win32 : posix;

	private lastMouseWheelEventTime = 0;
	private isMouseOverTabs = false;

	constructor(
		parent: HTMLElement,
		editorPartsView: IEditorPartsView,
		groupsView: IEditorGroupsView,
		groupView: IEditorGroupView,
		tabsModel: IReadonlyEditorGroupModel,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IKeybindingService keybindingService: IKeybindingService,
		@INotificationService notificationService: INotificationService,
		@IQuickInputService quickInputService: IQuickInputService,
		@IThemeService themeService: IThemeService,
		@IEditorService private readonly editorService: EditorServiceImpl,
		@IPathService private readonly pathService: IPathService,
		@ITreeViewsDnDService private readonly treeViewsDragAndDropService: ITreeViewsDnDService,
		@IEditorResolverService editorResolverService: IEditorResolverService,
		@IHostService hostService: IHostService,
	) {
		super(parent, editorPartsView, groupsView, groupView, tabsModel, contextMenuService, instantiationService, contextKeyService, keybindingService, notificationService, quickInputService, themeService, editorResolverService, hostService);

		// Resolve the correct path library for the OS we are on
		// If we are connected to remote, this accounts for the
		// remote OS.
		(async () => this.path = await this.pathService.path)();

		// React to decorations changing for our resource labels
		this._register(this.tabResourceLabels.onDidChangeDecorations(() => this.doHandleDecorationsChange()));
	}

	protected override create(parent: HTMLElement): HTMLElement {
		super.create(parent);

		this.titleContainer = parent;

		// Tabs and Actions Container (are on a single row with flex side-by-side)
		this.tabsAndActionsContainer = $('.tabs-and-actions-container');
		this.titleContainer.appendChild(this.tabsAndActionsContainer);

		// Tabs Container with virtualización
		this.tabsContainer = $('.tabs-container', {
			role: 'tablist',
			draggable: true
		});
		this._register(Gesture.addTarget(this.tabsContainer));

		this.tabSizingFixedDisposables = this._register(new DisposableStore());
		this.updateTabSizing(false);

		// Tabs Scrollbar con soporte para virtualización
		this.tabsScrollbar = this.createTabsScrollbar(this.tabsContainer);
		this.tabsAndActionsContainer.appendChild(this.tabsScrollbar.getDomNode());

		// Configurar virtualización
		this.setupVirtualScrolling();

		// Tabs Container listeners
		this.registerTabsContainerListeners(this.tabsContainer, this.tabsScrollbar);

		// Create Editor Toolbar
		this.createEditorActionsToolBar(this.tabsAndActionsContainer, ['editor-actions']);

		// Set tabs control visibility
		this.updateTabsControlVisibility();

		return this.tabsAndActionsContainer;
	}

	// Método para configurar virtualización de tabs
	private setupVirtualScrolling(): void {
		if (!this.tabsContainer || !this.tabsScrollbar) {
			return;
		}

		// Listener para scroll events para actualizar virtualización
		this._register(this.tabsScrollbar.onScroll(e => {
			if (e.scrollTopChanged) {
				this.virtualScrollTop = e.scrollTop;
				this.updateVirtualTabRendering();
			}
		}));
	}

	// Método para actualizar qué tabs se renderizan basado en la posición del scroll
	private updateVirtualTabRendering(): void {
		if (!this.tabsContainer) {
			return;
		}

		const totalTabs = this.tabsModel.count;
		if (totalTabs === 0) {
			return;
		}

		// Calcular rango visible de tabs
		const startIndex = Math.max(0, Math.floor(this.virtualScrollTop / MultiEditorTabsControl.VIRTUAL_SCROLL_CONFIG.TAB_HEIGHT) - MultiEditorTabsControl.VIRTUAL_SCROLL_CONFIG.BUFFER_SIZE);
		const visibleCount = Math.min(
			MultiEditorTabsControl.VIRTUAL_SCROLL_CONFIG.MAX_RENDERED_TABS,
			Math.ceil(MultiEditorTabsControl.VIRTUAL_SCROLL_CONFIG.CONTAINER_HEIGHT / MultiEditorTabsControl.VIRTUAL_SCROLL_CONFIG.TAB_HEIGHT) + MultiEditorTabsControl.VIRTUAL_SCROLL_CONFIG.BUFFER_SIZE * 2
		);
		const endIndex = Math.min(totalTabs, startIndex + visibleCount);

		// Si el rango cambió, re-renderizar
		if (this.renderedTabsStart !== startIndex || this.renderedTabsEnd !== endIndex) {
			this.renderedTabsStart = startIndex;
			this.renderedTabsEnd = endIndex;
			this.renderVirtualTabs(startIndex, endIndex);
		}
	}

	// Método para renderizar solo los tabs visibles
	private renderVirtualTabs(startIndex: number, endIndex: number): void {
		if (!this.tabsContainer) {
			return;
		}

		const tabsContainer = this.tabsContainer;

		// Limpiar tabs existentes
		while (tabsContainer.children.length > 0) {
			const child = tabsContainer.lastChild;
			if (child) {
				child.remove();
			}
		}

		// Limpiar cache de tabs visibles
		this.visibleTabsCache.clear();

		// Renderizar solo el rango visible de tabs
		for (let i = startIndex; i < endIndex; i++) {
			const editor = this.tabsModel.getEditorByIndex(i);
			if (editor) {
				const tabElement = this.createVirtualTab(i, tabsContainer, this.tabsScrollbar!);
				tabsContainer.appendChild(tabElement);
				this.visibleTabsCache.add(i);

				// Aplicar transformación para simular posición correcta
				const actualTop = i * MultiEditorTabsControl.VIRTUAL_SCROLL_CONFIG.TAB_HEIGHT;
				tabElement.style.transform = `translateY(${actualTop - startIndex * MultiEditorTabsControl.VIRTUAL_SCROLL_CONFIG.TAB_HEIGHT}px)`;
			}
		}

		// Ajustar altura del contenedor para simular todos los tabs
		const totalHeight = totalTabs * MultiEditorTabsControl.VIRTUAL_SCROLL_CONFIG.TAB_HEIGHT;
		tabsContainer.style.height = `${totalHeight}px`;
	}

	// Método para crear un tab virtualizado
	private createVirtualTab(tabIndex: number, tabsContainer: HTMLElement, tabsScrollbar: ScrollableElement): HTMLElement {
		const editor = this.tabsModel.getEditorByIndex(tabIndex);
		if (!editor) {
			throw new Error(`Editor not found at index ${tabIndex}`);
		}

		// Tab Container
		const tabContainer = $('.tab', {
			draggable: true,
			role: 'tab'
		});

		// Gesture Support
		this._register(Gesture.addTarget(tabContainer));

		// Tab Border Top
		const tabBorderTopContainer = $('.tab-border-top-container');
		tabContainer.appendChild(tabBorderTopContainer);

		// Tab Editor Label
		const editorLabel = this.tabResourceLabels.create(tabContainer, { hoverTargetOverride: tabContainer });

		// Tab Actions
		const tabActionsContainer = $('.tab-actions');
		tabContainer.appendChild(tabActionsContainer);

		const that = this;
		const tabActionRunner = new EditorCommandsContextActionRunner({
			groupId: this.groupView.id,
			get editorIndex() { return that.toEditorIndex(tabIndex); }
		});

		const tabActionBar = new ActionBar(tabActionsContainer, { ariaLabel: localize('ariaLabelTabActions', "Tab actions"), actionRunner: tabActionRunner });
		const tabActionListener = tabActionBar.onWillRun(e => {
			if (e.action.id === this.closeEditorAction.id) {
				this.blockRevealActiveTabOnce();
			}
		});

		const tabActionBarDisposable = combinedDisposable(tabActionRunner, tabActionBar, tabActionListener, toDisposable(insert(this.tabActionBars, tabActionBar)));

		// Tab Fade Hider
		const tabShadowHider = $('.tab-fade-hider');
		tabContainer.appendChild(tabShadowHider);

		// Tab Border Bottom
		const tabBorderBottomContainer = $('.tab-border-bottom-container');
		tabContainer.appendChild(tabBorderBottomContainer);

		// Eventing (simplificada para virtualización)
		this.registerVirtualTabListeners(tabContainer, tabIndex, tabsContainer, tabsScrollbar);

		this.tabDisposables.push(combinedDisposable(tabActionBarDisposable, tabActionRunner, editorLabel));

		return tabContainer;
	}

	// Listeners simplificados para tabs virtualizados
	private registerVirtualTabListeners(tab: HTMLElement, tabIndex: number, tabsContainer: HTMLElement, tabsScrollbar: ScrollableElement): IDisposable {
		const disposables = new DisposableStore();

		// Click simplificado
		disposables.add(addDisposableListener(tab, EventType.MOUSE_DOWN, e => {
			if (isMouseEvent(e) && e.button === 0) {
				const editor = this.tabsModel.getEditorByIndex(tabIndex);
				if (editor) {
					this.groupView.openEditor(editor);
				}
			}
		}));

		return disposables;
	}

	// Override del método createTabsScrollbar para soporte virtual
	private createTabsScrollbar(scrollable: HTMLElement): ScrollableElement {
		const tabsScrollbar = this._register(new ScrollableElement(scrollable, {
			horizontal: ScrollbarVisibility.Hidden, // Deshabilitar scroll horizontal para virtualización
			horizontalScrollbarSize: this.getTabsScrollbarSizing(),
			vertical: ScrollbarVisibility.Auto, // Habilitar scroll vertical para virtualización
			scrollYToX: false, // Deshabilitar conversión para virtualización
			useShadows: false
		}));

		this._register(tabsScrollbar.onScroll(e => {
			if (e.scrollTopChanged) {
				scrollable.scrollTop = e.scrollTop; // Sincronizar scroll vertical
				this.virtualScrollTop = e.scrollTop;
				this.updateVirtualTabRendering();
			}
		}));

		return tabsScrollbar;
	}

	// Override del método getTabsScrollbarVisibility para virtualización
	private getTabsScrollbarVisibility(): ScrollbarVisibility {
		return ScrollbarVisibility.Auto; // Siempre mostrar scrollbar vertical para virtualización
	}

	// Resto de métodos existentes con modificaciones menores para soporte virtual...