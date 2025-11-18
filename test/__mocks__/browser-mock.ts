/**
 * Browser API mocks for Jest testing environment
 * Provides mock implementations for browser-specific APIs that aren't available in Node.js
 */

// Mock window object
Object.defineProperty(global, 'window', {
  value: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    location: {
      href: 'http://localhost',
      origin: 'http://localhost',
      protocol: 'http:',
      host: 'localhost',
      hostname: 'localhost',
      port: '',
      pathname: '/',
      search: '',
      hash: '',
    },
    navigator: {
      userAgent: 'Jest Test Environment',
      platform: 'test',
      language: 'en',
    },
    document: {
      createElement: jest.fn(() => ({
        style: {},
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        appendChild: jest.fn(),
        removeChild: jest.fn(),
      })),
      createElementNS: jest.fn(),
      getElementById: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      body: {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
      },
      head: {
        appendChild: jest.fn(),
      },
    },
    localStorage: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
    sessionStorage: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
    setTimeout: jest.fn((callback) => setImmediate(callback)),
    clearTimeout: jest.fn(),
    setInterval: jest.fn(),
    clearInterval: jest.fn(),
    requestAnimationFrame: jest.fn((callback) => setImmediate(callback)),
    cancelAnimationFrame: jest.fn(),
    console: global.console,
  },
  writable: true,
});

// Mock document object
Object.defineProperty(global, 'document', {
  value: global.window.document,
  writable: true,
});

// Mock navigator object
Object.defineProperty(global, 'navigator', {
  value: global.window.navigator,
  writable: true,
});

// Mock localStorage
Object.defineProperty(global, 'localStorage', {
  value: global.window.localStorage,
  writable: true,
});

// Mock sessionStorage
Object.defineProperty(global, 'sessionStorage', {
  value: global.window.sessionStorage,
  writable: true,
});

// Mock HTMLElement and related DOM classes
global.HTMLElement = class HTMLElement {
  style = {};
  accessKey = '';
  accessKeyLabel = '';
  autocapitalize = '';
  autocorrect = '';
  contentEditable = 'inherit';
  draggable = false;
  hidden = false;
  inert = false;
  innerText = '';
  lang = '';
  offsetHeight = 0;
  offsetLeft = 0;
  offsetParent = null;
  offsetTop = 0;
  offsetWidth = 0;
  outerText = '';
  spellcheck = false;
  title = '';
  translate = true;
  setAttribute = jest.fn();
  getAttribute = jest.fn();
  appendChild = jest.fn();
  removeChild = jest.fn();
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  dispatchEvent = jest.fn();
} as any;

// Mock Event class
global.Event = class Event {
  static NONE = 0;
  static CAPTURING_PHASE = 1;
  static AT_TARGET = 2;
  static BUBBLING_PHASE = 3;

  constructor(type: string) {
    this.type = type;
    this.bubbles = false;
    this.cancelBubble = false;
    this.cancelable = false;
    this.composed = false;
    this.currentTarget = null;
    this.defaultPrevented = false;
    this.eventPhase = 0;
    this.isTrusted = false;
    this.target = null;
    this.timeStamp = Date.now();
  }
  readonly type!: string;
  readonly bubbles!: boolean;
  readonly cancelBubble!: boolean;
  readonly cancelable!: boolean;
  readonly composed!: boolean;
  readonly currentTarget!: EventTarget | null;
  readonly defaultPrevented!: boolean;
  readonly eventPhase!: number;
  readonly isTrusted!: boolean;
  readonly target!: EventTarget | null;
  readonly timeStamp!: number;

  preventDefault = jest.fn();
  stopPropagation = jest.fn();
  stopImmediatePropagation = jest.fn();
  composedPath = jest.fn(() => []);
} as any;

// Mock CustomEvent class
global.CustomEvent = class CustomEvent extends Event {
  constructor(type: string, options?: any) {
    super(type);
    this.detail = options?.detail;
  }
  detail: any;

  initCustomEvent(type: string, bubbles?: boolean, cancelable?: boolean, detail?: any) {
    (this as any).type = type;
    this.detail = detail;
  }
};

// Mock URL class if not available
if (!global.URL) {
  global.URL = class URL {
    static canParse(url: string, base?: string | URL): boolean {
      try {
        new URL(url, base as any);
        return true;
      } catch {
        return false;
      }
    }

    static createObjectURL(obj: Blob | MediaSource): string {
      return 'mock://object-url';
    }

    static parse(url: string, base?: string | URL): URL | null {
      try {
        return new URL(url, base as any);
      } catch {
        return null;
      }
    }

    static revokeObjectURL(url: string): void {
      // Mock implementation
    }

    constructor(url: string, base?: string | URL) {
      const parsed = new URL(url, base as any);
      this.href = parsed.href;
      this.origin = parsed.origin;
      this.protocol = parsed.protocol;
      this.username = parsed.username;
      this.password = parsed.password;
      this.host = parsed.host;
      this.hostname = parsed.hostname;
      this.port = parsed.port;
      this.pathname = parsed.pathname;
      this.search = parsed.search;
      this.hash = parsed.hash;
      this.searchParams = new URLSearchParams(parsed.search);
    }
    href: string;
    origin: string;
    protocol: string;
    username: string;
    password: string;
    host: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
    hash: string;
    searchParams: URLSearchParams;

    toString() { return this.href; }
    toJSON() { return this.href; }
  } as any;
}

// Mock fetch if not available
if (!global.fetch) {
  const mockResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    type: 'basic' as const,
    url: '',
    redirected: false,
    headers: new Map(),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    clone: () => ({ ...mockResponse }),
  };

  global.fetch = jest.fn(() => Promise.resolve(mockResponse));
}

// Mock WebSocket if not available
if (!global.WebSocket) {
  global.WebSocket = class WebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url: string) {
      this.url = url;
      this.readyState = 0;
    }
    url: string;
    readyState: number;
    binaryType: BinaryType = 'blob';
    bufferedAmount: number = 0;
    extensions: string = '';
    protocol: string = '';
    onopen: ((event: any) => void) | null = null;
    onmessage: ((event: any) => void) | null = null;
    onclose: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;

    send = jest.fn();
    close = jest.fn();
  } as any;
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  callback: ResizeObserverCallback;

  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
  }
  callback: IntersectionObserverCallback;
  root: Element | null = null;
  rootMargin: string = '0px';
  thresholds: ReadonlyArray<number> = [0];

  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn(() => []);
};

// Mock performance object
if (!global.performance) {
  const mockEventCounts = {
    forEach: jest.fn(),
    get: jest.fn(),
    has: jest.fn(),
    size: 0,
  };

  const mockNavigation = {
    type: 0,
    redirectCount: 0,
    toJSON: jest.fn(),
    TYPE_NAVIGATE: 0,
    TYPE_RELOAD: 1,
    TYPE_BACK_FORWARD: 2,
    TYPE_RESERVED: 255,
  };

  const mockTiming = {
    navigationStart: Date.now(),
    unloadEventStart: 0,
    unloadEventEnd: 0,
    redirectStart: 0,
    redirectEnd: 0,
    fetchStart: Date.now(),
    domainLookupStart: Date.now(),
    domainLookupEnd: Date.now(),
    connectStart: Date.now(),
    connectEnd: Date.now(),
    secureConnectionStart: Date.now(),
    requestStart: Date.now(),
    responseStart: Date.now(),
    responseEnd: Date.now(),
    domLoading: Date.now(),
    domInteractive: Date.now(),
    domContentLoadedEventStart: Date.now(),
    domContentLoadedEventEnd: Date.now(),
    domComplete: Date.now(),
    loadEventStart: Date.now(),
    loadEventEnd: Date.now(),
    toJSON: jest.fn(),
  };

  global.performance = {
    now: () => Date.now(),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
    timeOrigin: Date.now(),
    eventCounts: mockEventCounts,
    navigation: mockNavigation,
    timing: mockTiming,
    onresourcetimingbufferfull: null,
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    clearResourceTimings: jest.fn(),
    getEntries: jest.fn(() => []),
    setResourceTimingBufferSize: jest.fn(),
    toJSON: jest.fn(),
  } as any;
}

// Mock matchMedia
global.matchMedia = jest.fn((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

export {};