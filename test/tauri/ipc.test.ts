import { invoke } from '@tauri-apps/api/core';

jest.mock('@tauri-apps/api/core');

describe('IPC Commands', () => {
  const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

  beforeEach(() => {
    mockInvoke.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('IPC Protocol Initialization', () => {
    it('should invoke ipc_protocol_init and return connection ID', async () => {
      const window_label = 'main_window';
      const expectedResult = { connection_id: 'conn_1234567890123' };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('ipc_protocol_init', { window_label });

      expect(mockInvoke).toHaveBeenCalledWith('ipc_protocol_init', { window_label });
      expect(result).toEqual(expectedResult);
      expect(result.connection_id).toMatch(/^conn_\d+$/);
    });

    it('should handle ipc_protocol_init with different window labels', async () => {
      const windowLabels = ['main', 'auxiliary', 'popup'];

      for (const label of windowLabels) {
        const expectedResult = { connection_id: `conn_${Date.now()}` };
        mockInvoke.mockResolvedValue(expectedResult);

        const result = await invoke('ipc_protocol_init', { window_label: label });

        expect(mockInvoke).toHaveBeenCalledWith('ipc_protocol_init', { window_label: label });
        expect(result.connection_id).toMatch(/^conn_\d+$/);
      }
    });
  });

  describe('IPC Commands from ipc_commands.rs', () => {
    it('should invoke fetch_shell_env and return environment variables', async () => {
      const expectedEnv = {
        'PATH': '/usr/bin:/bin',
        'HOME': '/home/user',
        'SHELL': '/bin/bash'
      };

      mockInvoke.mockResolvedValue(expectedEnv);

      const result = await invoke('fetch_shell_env');

      expect(mockInvoke).toHaveBeenCalledWith('fetch_shell_env');
      expect(result).toEqual(expectedEnv);
      expect(typeof result).toBe('object');
    });

    it('should invoke notify_zoom_level with window label and zoom level', async () => {
      const window_label = 'main_window';
      const zoom_level = 1.5;

      await invoke('notify_zoom_level', { window_label, zoom_level });

      expect(mockInvoke).toHaveBeenCalledWith('notify_zoom_level', { window_label, zoom_level });
    });

    it('should reject notify_zoom_level with invalid zoom levels', async () => {
      const invalidLevels = [0.05, 6.0, -1.0];

      for (const level of invalidLevels) {
        mockInvoke.mockRejectedValue(`Invalid zoom level: ${level}. Must be between 0.1 and 5.0`);

        await expect(invoke('notify_zoom_level', { window_label: 'main', zoom_level: level }))
          .rejects.toThrow('Invalid zoom level');
      }
    });

    it('should invoke toggle_dev_tools with window label', async () => {
      const window_label = 'dev_window';

      await invoke('toggle_dev_tools', { window_label });

      expect(mockInvoke).toHaveBeenCalledWith('toggle_dev_tools', { window_label });
    });

    it('should invoke open_dev_tools with window label', async () => {
      const window_label = 'dev_window';

      await invoke('open_dev_tools', { window_label });

      expect(mockInvoke).toHaveBeenCalledWith('open_dev_tools', { window_label });
    });

    it('should invoke reload_window with window label', async () => {
      const window_label = 'main_window';

      await invoke('reload_window', { window_label });

      expect(mockInvoke).toHaveBeenCalledWith('reload_window', { window_label });
    });

    it('should invoke get_window_config and return configuration', async () => {
      const window_label = 'main_window';
      const expectedConfig = {
        zoom_level: 1.0,
        user_env: {
          'PATH': '/usr/bin',
          'HOME': '/home/user'
        }
      };

      mockInvoke.mockResolvedValue(expectedConfig);

      const result = await invoke('get_window_config', { window_label });

      expect(mockInvoke).toHaveBeenCalledWith('get_window_config', { window_label });
      expect(result).toEqual(expectedConfig);
      expect(result.zoom_level).toBe(1.0);
    });

    it('should invoke register_auxiliary_window with main window ID and label', async () => {
      const main_window_id = 123;
      const aux_window_label = 'aux_window';

      await invoke('register_auxiliary_window', { main_window_id, aux_window_label });

      expect(mockInvoke).toHaveBeenCalledWith('register_auxiliary_window', { main_window_id, aux_window_label });
    });

    it('should reject register_auxiliary_window with invalid main window ID', async () => {
      const main_window_id = 0;
      const aux_window_label = 'aux_window';

      mockInvoke.mockRejectedValue('Invalid main window ID');

      await expect(invoke('register_auxiliary_window', { main_window_id, aux_window_label }))
        .rejects.toThrow('Invalid main window ID');
    });

    it('should invoke get_diagnostic_info and return system diagnostics', async () => {
      const expectedInfo = {
        host_name: 'localhost',
        cpu_info: '8 CPUs',
        memory_info: '8192 MB used / 16384 MB total',
        os_version: 'Linux 5.15.0'
      };

      mockInvoke.mockResolvedValue(expectedInfo);

      const result = await invoke('get_diagnostic_info');

      expect(mockInvoke).toHaveBeenCalledWith('get_diagnostic_info');
      expect(result).toEqual(expectedInfo);
      expect(result.host_name).toBeDefined();
      expect(result.cpu_info).toBeDefined();
    });

    it('should invoke get_process_info and return process information', async () => {
      const expectedInfo = {
        platform: 'linux',
        arch: 'x86_64',
        env: { 'SHELL': '/bin/bash' },
        versions: { 'node': '18.0.0' },
        exec_path: '/usr/bin/code'
      };

      mockInvoke.mockResolvedValue(expectedInfo);

      const result = await invoke('get_process_info');

      expect(mockInvoke).toHaveBeenCalledWith('get_process_info');
      expect(result).toEqual(expectedInfo);
      expect(['linux', 'darwin', 'win32']).toContain(result.platform);
    });

    it('should invoke get_process_memory_info and return memory statistics', async () => {
      const expectedInfo = {
        private: 102400,
        resident_set: 204800,
        shared: 51200
      };

      mockInvoke.mockResolvedValue(expectedInfo);

      const result = await invoke('get_process_memory_info');

      expect(mockInvoke).toHaveBeenCalledWith('get_process_memory_info');
      expect(result).toEqual(expectedInfo);
      expect(result.private).toBeGreaterThan(0);
    });

    it('should invoke ipc_invoke with channel and args', async () => {
      const req = {
        channel: 'vscode:test-command',
        args: { key: 'value' }
      };
      const expectedResponse = { status: 'success', channel: 'vscode:test-command' };

      mockInvoke.mockResolvedValue(expectedResponse);

      const result = await invoke('ipc_invoke', req);

      expect(mockInvoke).toHaveBeenCalledWith('ipc_invoke', req);
      expect(result).toEqual(expectedResponse);
    });

    it('should invoke ipc_object_url_invoke with channel and args', async () => {
      const channel = 'vscode:extension-host';
      const args = { command: 'test', data: 'payload' };
      const expectedResponse = { result: 'success' };

      mockInvoke.mockResolvedValue(expectedResponse);

      const result = await invoke('ipc_object_url_invoke', { channel, args });

      expect(mockInvoke).toHaveBeenCalledWith('ipc_object_url_invoke', { channel, args });
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('Window Communication', () => {
    it('should invoke send_message_to_window with window label, event and payload', async () => {
      const label = 'main_window';
      const event = 'custom-event';
      const payload = { type: 'notification', message: 'Hello' };

      await invoke('send_message_to_window', { label, event, payload });

      expect(mockInvoke).toHaveBeenCalledWith('send_message_to_window', { label, event, payload });
    });

    it('should invoke broadcast_message to all windows', async () => {
      const event = 'global-notification';
      const payload = { type: 'update', version: '1.0.0' };

      await invoke('broadcast_message', { event, payload });

      expect(mockInvoke).toHaveBeenCalledWith('broadcast_message', { event, payload });
    });

    it('should handle send_message_to_window with non-existent window', async () => {
      const label = 'nonexistent_window';
      const event = 'test';
      const payload = {};

      mockInvoke.mockRejectedValue("Window 'nonexistent_window' not found");

      await expect(invoke('send_message_to_window', { label, event, payload }))
        .rejects.toThrow('not found');
    });
  });

  describe('Window Event Handling', () => {
    it('should invoke on_window_event with window label and event type', async () => {
      const label = 'main_window';
      const event = 'close_requested';

      await invoke('on_window_event', { label, event });

      expect(mockInvoke).toHaveBeenCalledWith('on_window_event', { label, event });
    });
  });

  describe('Error Handling and Validation', () => {
    it('should reject ipc_invoke with invalid channel', async () => {
      const req = {
        channel: 'invalid-channel',
        args: {}
      };

      mockInvoke.mockRejectedValue('Channel validation failed: Invalid IPC channel name');

      await expect(invoke('ipc_invoke', req)).rejects.toThrow('Channel validation failed');
    });

    it('should handle concurrent IPC requests', async () => {
      const requests = [
        invoke('fetch_shell_env'),
        invoke('get_process_info'),
        invoke('get_diagnostic_info')
      ];

      const results = await Promise.all(requests);

      expect(results).toHaveLength(3);
      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });

    it('should handle payload size limits in ipc_invoke', async () => {
      const largeArgs = { data: 'x'.repeat(10 * 1024 * 1024) }; // 10MB
      const req = {
        channel: 'vscode:test',
        args: largeArgs
      };

      mockInvoke.mockRejectedValue('Payload size exceeds maximum allowed limit');

      await expect(invoke('ipc_invoke', req)).rejects.toThrow('Payload size exceeds');
    });

    it('should handle network errors in IPC communication', async () => {
      mockInvoke.mockRejectedValue('IPC connection lost');

      await expect(invoke('fetch_shell_env')).rejects.toThrow('IPC connection lost');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete window setup workflow', async () => {
      const windowLabel = 'new_window';

      // Register auxiliary window
      await invoke('register_auxiliary_window', { main_window_id: 1, aux_window_label: windowLabel });

      // Get window config
      const config = { zoom_level: 1.0, user_env: {} };
      mockInvoke.mockResolvedValueOnce(config);
      const retrievedConfig = await invoke('get_window_config', { window_label: windowLabel });

      // Open dev tools
      await invoke('open_dev_tools', { window_label: windowLabel });

      // Send message to window
      await invoke('send_message_to_window', {
        label: windowLabel,
        event: 'initialized',
        payload: { config: retrievedConfig }
      });

      expect(mockInvoke).toHaveBeenCalledTimes(4);
    });

    it('should handle diagnostic information gathering', async () => {
      // Get all diagnostic info
      const [processInfo, memoryInfo, diagnostics] = await Promise.all([
        invoke('get_process_info'),
        invoke('get_process_memory_info'),
        invoke('get_diagnostic_info')
      ]);

      expect(processInfo).toBeDefined();
      expect(memoryInfo).toBeDefined();
      expect(diagnostics).toBeDefined();

      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });
  });
});
