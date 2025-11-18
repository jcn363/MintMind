// Mock for @tauri-apps/api/core
export const invoke = jest.fn().mockResolvedValue({});
export const convertFileSrc = jest.fn((url: string) => url);
