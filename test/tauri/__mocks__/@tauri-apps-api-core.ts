// Mock for @tauri-apps/api/core
interface InvokeOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

interface InvokeResult {
  [key: string]: any;
}

export const invoke = jest.fn().mockResolvedValue({});

export const convertFileSrc = jest.fn((url: string) => url);

// Add proper TypeScript interfaces for common invoke patterns
export interface PTYSpawnResult {
  pid: number;
  cwd: string;
  backend: string;
}

export interface PTYReadResult {
  data: string;
  bytes_read: number;
}

export interface WindowPosition {
  x: number;
  y: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface MonitorInfo {
  name: string;
  size: WindowSize;
  position: WindowPosition;
  scaleFactor: number;
}

export interface WindowState {
  label: string;
  title: string;
  position: WindowPosition;
  size: WindowSize;
  minimized: boolean;
  maximized: boolean;
  fullscreen: boolean;
  focused: boolean;
  decorated: boolean;
  resizable: boolean;
  alwaysOnTop: boolean;
  scaleFactor: number;
  currentMonitor?: MonitorInfo;
  availableMonitors: MonitorInfo[];
}

// Export default for compatibility with different import styles
export default {
  invoke,
  convertFileSrc,
};
