// Mock for @tauri-apps/api/event
export const listen = jest.fn().mockResolvedValue({ unsubscribe: jest.fn() });
export const emit = jest.fn().mockResolvedValue();
export const once = jest.fn().mockResolvedValue({});
