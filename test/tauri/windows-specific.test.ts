import { invoke } from '@tauri-apps/api/core';

jest.mock('@tauri-apps/api/core', () => ({ invoke: jest.fn() }));

const mockSkipIf = jest.fn();
jest.mock('jest-skip-if', () => ({
  skipIf: mockSkipIf
}));

describe('Windows-Specific Commands', () => {
  const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

  beforeEach(() => {
    mockSkipIf.mockImplementation((condition) => condition ? describe.skip : describe);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe.skip('Windows Registry Operations', () => {
    it.skip('should invoke registry_read', async () => {
      const key = 'HKEY_CURRENT_USER\\Software\\Test';
      const value = 'TestValue';

      mockInvoke.mockResolvedValue('registry_data');

      const result = await invoke('registry_read', { key, value });

      expect(mockInvoke).toHaveBeenCalledWith('registry_read', { key, value });
    });

    it.skip('should invoke registry_write', async () => {
      const key = 'HKEY_CURRENT_USER\\Software\\Test';
      const value = 'TestValue';
      const data = 'test_data';

      await invoke('registry_write', { key, value, data });

      expect(mockInvoke).toHaveBeenCalledWith('registry_write', { key, value, data });
    });
  });

  describe.skip('Windows Process Operations', () => {
    it.skip('should invoke get_process_list', async () => {
      mockInvoke.mockResolvedValue([
        { pid: 123, name: 'test.exe', memory: 1024000 }
      ]);

      const result = await invoke('get_process_list');

      expect(mockInvoke).toHaveBeenCalledWith('get_process_list');
      expect(result).toEqual([
        { pid: 123, name: 'test.exe', memory: 1024000 }
      ]);
    });

    it.skip('should invoke kill_process', async () => {
      const pid = 123;

      await invoke('kill_process', { pid });

      expect(mockInvoke).toHaveBeenCalledWith('kill_process', { pid });
    });
  });
});
