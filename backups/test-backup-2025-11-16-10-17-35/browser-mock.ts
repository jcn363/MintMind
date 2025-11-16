const globalAny = global as any;

// Mock browser globals
globalAny.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0),
  cancelAnimationFrame: (id: number) => clearTimeout(id),
  document: {
    createElement: () => ({}),
    createTextNode: () => ({}),
    addEventListener: () => {},
    removeEventListener: () => {},
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
  },
  location: {
    href: 'http://localhost/',
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
    userAgent: 'node.js',
    platform: 'node',
    language: 'en-US',
  },
  matchMedia: () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
  }),
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
};

globalAny.document = globalAny.window.document;
globalAny.self = globalAny.window;
globalAny.HTMLElement = class {};
globalAny.Node = {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3,
  DOCUMENT_POSITION_CONTAINS: 8,
};
