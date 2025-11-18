import { invoke } from '@tauri-apps/api/core';

jest.mock('@tauri-apps/api/core');

describe('Window Management Commands', () => {
  const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

  beforeEach(() => {
    mockInvoke.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Window Creation and Lifecycle', () => {
    it('should invoke create_window with full configuration and return creation result', async () => {
      const config = {
        label: 'new-window',
        title: 'My Application Window',
        width: 1200.0,
        height: 800.0,
        x: 100.0,
        y: 100.0,
        minWidth: 400.0,
        minHeight: 300.0,
        maxWidth: 1920.0,
        maxHeight: 1080.0,
        resizable: true,
        maximizable: true,
        minimizable: true,
        closable: true,
        fullscreen: false,
        center: true,
        decorations: true,
        alwaysOnTop: false,
        skipTaskbar: false,
        theme: 'system',
        transparent: false,
        shadow: true,
        url: 'https://example.com'
      };

      const expectedResult = {
        label: 'new-window',
        id: 42
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('create_window', config);

      expect(mockInvoke).toHaveBeenCalledWith('create_window', config);
      expect(result).toEqual(expectedResult);
      expect(result.label).toBe('new-window');
      expect(result.id).toBeGreaterThan(0);
    });

    it('should invoke create_window with minimal configuration', async () => {
      const config = {
        label: 'minimal-window'
      };

      const expectedResult = {
        label: 'minimal-window',
        id: 1
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('create_window', config);

      expect(mockInvoke).toHaveBeenCalledWith('create_window', config);
      expect(result.label).toBe('minimal-window');
    });

    it('should reject create_window with duplicate label', async () => {
      const config = {
        label: 'existing-window'
      };

      mockInvoke.mockRejectedValue('Window with label \'existing-window\' already exists');

      await expect(invoke('create_window', config)).rejects.toThrow('already exists');
    });

    it('should reject create_window with invalid label', async () => {
      const config = {
        label: '' // Empty label
      };

      mockInvoke.mockRejectedValue('Window label validation failed: Label cannot be empty');

      await expect(invoke('create_window', config)).rejects.toThrow('Label cannot be empty');
    });

    it('should reject create_window with non-existent parent', async () => {
      const config = {
        label: 'child-window',
        parent: 'nonexistent-parent'
      };

      mockInvoke.mockRejectedValue('Parent window \'nonexistent-parent\' not found');

      await expect(invoke('create_window', config)).rejects.toThrow('not found');
    });

    it('should invoke create_auxiliary_window for auxiliary window creation', async () => {
      const config = {
        label: 'aux-window',
        title: 'Auxiliary Window',
        width: 600.0,
        height: 400.0,
        parent: 'main-window'
      };

      await invoke('create_auxiliary_window', config);

      expect(mockInvoke).toHaveBeenCalledWith('create_auxiliary_window', config);
    });

    it('should invoke register_auxiliary_window with parent ID and frame name', async () => {
      const main_window_id = 123;
      const aux_window_label = 'aux-vscode-frame-1';
      const token = 'unique-token';

      const expectedResult = 'aux-main-123-vscode-frame-1';

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('register_auxiliary_window', {
        main_window_id,
        aux_window_label,
        token
      });

      expect(mockInvoke).toHaveBeenCalledWith('register_auxiliary_window', {
        main_window_id,
        aux_window_label,
        token
      });
      expect(result).toMatch(/^aux-/);
    });
  });

  describe('Window Lifecycle Operations', () => {
    it('should invoke close_window and handle successful closure', async () => {
      const label = 'window-to-close';

      await invoke('close_window', { label });

      expect(mockInvoke).toHaveBeenCalledWith('close_window', { label });
    });

    it('should invoke destroy_window as alias for close_window', async () => {
      const label = 'window-to-destroy';

      await invoke('destroy_window', { label });

      expect(mockInvoke).toHaveBeenCalledWith('destroy_window', { label });
    });

    it('should reject close_window for non-existent window', async () => {
      const label = 'nonexistent-window';

      mockInvoke.mockRejectedValue("Window 'nonexistent-window' not found");

      await expect(invoke('close_window', { label })).rejects.toThrow('not found');
    });

    it('should invoke hide_window to hide a window', async () => {
      const label = 'hidden-window';

      await invoke('hide_window', { label });

      expect(mockInvoke).toHaveBeenCalledWith('hide_window', { label });
    });

    it('should invoke show_window to show a hidden window', async () => {
      const label = 'shown-window';

      await invoke('show_window', { label });

      expect(mockInvoke).toHaveBeenCalledWith('show_window', { label });
    });
  });

  describe('Window State Management', () => {
    it('should invoke minimize_window to minimize a window', async () => {
      const label = 'minimized-window';

      await invoke('minimize_window', { label });

      expect(mockInvoke).toHaveBeenCalledWith('minimize_window', { label });
    });

    it('should invoke maximize_window to maximize a window', async () => {
      const label = 'maximized-window';

      await invoke('maximize_window', { label });

      expect(mockInvoke).toHaveBeenCalledWith('maximize_window', { label });
    });

    it('should invoke unmaximize_window to restore a maximized window', async () => {
      const label = 'restored-window';

      await invoke('unmaximize_window', { label });

      expect(mockInvoke).toHaveBeenCalledWith('unmaximize_window', { label });
    });

    it('should invoke toggle_maximize_window to toggle maximization state', async () => {
      const label = 'toggle-window';

      await invoke('toggle_maximize_window', { label });

      expect(mockInvoke).toHaveBeenCalledWith('toggle_maximize_window', { label });
    });

    it('should invoke toggle_fullscreen_window to toggle fullscreen state', async () => {
      const label = 'fullscreen-window';

      await invoke('toggle_fullscreen_window', { label });

      expect(mockInvoke).toHaveBeenCalledWith('toggle_fullscreen_window', { label });
    });

    it('should invoke focus_window to bring window to front', async () => {
      const label = 'focused-window';

      await invoke('focus_window', { label });

      expect(mockInvoke).toHaveBeenCalledWith('focus_window', { label });
    });

    it('should invoke center_window to center window on screen', async () => {
      const label = 'centered-window';

      await invoke('center_window', { label });

      expect(mockInvoke).toHaveBeenCalledWith('center_window', { label });
    });
  });

  describe('Window Display Properties', () => {
    it('should invoke set_window_title to change window title', async () => {
      const label = 'titled-window';
      const title = 'New Window Title';

      await invoke('set_window_title', { label, title });

      expect(mockInvoke).toHaveBeenCalledWith('set_window_title', { label, title });
    });

    it('should invoke set_window_size with width and height', async () => {
      const label = 'resized-window';
      const size = { width: 1024.0, height: 768.0 };

      await invoke('set_window_size', { label, size });

      expect(mockInvoke).toHaveBeenCalledWith('set_window_size', { label, size });
    });

    it('should invoke set_window_position with x and y coordinates', async () => {
      const label = 'positioned-window';
      const position = { x: 200.0, y: 150.0 };

      await invoke('set_window_position', { label, position });

      expect(mockInvoke).toHaveBeenCalledWith('set_window_position', { label, position });
    });

    it('should invoke set_window_fullscreen to toggle fullscreen mode', async () => {
      const label = 'fullscreen-window';
      const fullscreen = true;

      await invoke('set_window_fullscreen', { label, fullscreen });

      expect(mockInvoke).toHaveBeenCalledWith('set_window_fullscreen', { label, fullscreen });
    });

    it('should invoke set_window_decorations to toggle window decorations', async () => {
      const label = 'decorated-window';
      const decorations = false;

      await invoke('set_window_decorations', { label, decorations });

      expect(mockInvoke).toHaveBeenCalledWith('set_window_decorations', { label, decorations });
    });

    it('should invoke set_window_always_on_top to toggle always-on-top', async () => {
      const label = 'top-window';
      const always_on_top = true;

      await invoke('set_window_always_on_top', { label, always_on_top });

      expect(mockInvoke).toHaveBeenCalledWith('set_window_always_on_top', { label, always_on_top });
    });

    it('should invoke set_window_skip_taskbar to toggle taskbar visibility', async () => {
      const label = 'hidden-taskbar-window';
      const skip_taskbar = true;

      await invoke('set_window_skip_taskbar', { label, skip_taskbar });

      expect(mockInvoke).toHaveBeenCalledWith('set_window_skip_taskbar', { label, skip_taskbar });
    });

    it('should invoke set_window_zoom_level with zoom factor', async () => {
      const label = 'zoomed-window';
      const level = 1.25;

      await invoke('set_window_zoom_level', { label, level });

      expect(mockInvoke).toHaveBeenCalledWith('set_window_zoom_level', { label, level });
    });

    it('should reject set_window_zoom_level with invalid zoom level', async () => {
      const label = 'zoomed-window';
      const level = 10.0; // Too high

      mockInvoke.mockRejectedValue('Invalid zoom level: 10. Must be between 0.1 and 5.0');

      await expect(invoke('set_window_zoom_level', { label, level })).rejects.toThrow('Invalid zoom level');
    });
  });

  describe('Window State Queries', () => {
    it('should invoke get_window_state and return complete window state', async () => {
      const label = 'queried-window';
      const expectedState = {
        label: 'queried-window',
        isMinimized: false,
        isMaximized: true,
        isFullscreen: false,
        isFocused: true,
        isDecorated: true,
        isVisible: true,
        width: 1920.0,
        height: 1080.0,
        x: 0.0,
        y: 0.0,
        scaleFactor: 1.0
      };

      mockInvoke.mockResolvedValue(expectedState);

      const result = await invoke('get_window_state', { label });

      expect(mockInvoke).toHaveBeenCalledWith('get_window_state', { label });
      expect(result).toEqual(expectedState);
      expect(result.isMaximized).toBe(true);
      expect(result.width).toBe(1920.0);
    });

    it('should invoke get_window_config and return window configuration', async () => {
      const label = 'config-window';
      const expectedConfig = {
        label: 'config-window',
        title: 'Configured Window',
        fullscreen: false,
        decorations: true
      };

      mockInvoke.mockResolvedValue(expectedConfig);

      const result = await invoke('get_window_config', { label });

      expect(mockInvoke).toHaveBeenCalledWith('get_window_config', { label });
      expect(result).toEqual(expectedConfig);
    });

    it('should invoke get_focused_window and return focused window label', async () => {
      const expectedLabel = 'focused-window';

      mockInvoke.mockResolvedValue(expectedLabel);

      const result = await invoke('get_focused_window');

      expect(mockInvoke).toHaveBeenCalledWith('get_focused_window');
      expect(result).toBe(expectedLabel);
    });

    it('should invoke get_window_by_id with window ID and return label', async () => {
      const id = 42;
      const expectedLabel = 'window-42';

      mockInvoke.mockResolvedValue(expectedLabel);

      const result = await invoke('get_window_by_id', { id });

      expect(mockInvoke).toHaveBeenCalledWith('get_window_by_id', { id });
      expect(result).toBe(expectedLabel);
    });

    it('should invoke list_windows and return array of window labels', async () => {
      const expectedWindows = ['main', 'auxiliary', 'popup'];

      mockInvoke.mockResolvedValue(expectedWindows);

      const result = await invoke('list_windows');

      expect(mockInvoke).toHaveBeenCalledWith('list_windows');
      expect(result).toEqual(expectedWindows);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should invoke window_exists to check if window exists', async () => {
      const label = 'existing-window';

      mockInvoke.mockResolvedValue(true);

      const result = await invoke('window_exists', { label });

      expect(mockInvoke).toHaveBeenCalledWith('window_exists', { label });
      expect(result).toBe(true);
    });

    it('should invoke get_window_count and return number of windows', async () => {
      const expectedCount = 3;

      mockInvoke.mockResolvedValue(expectedCount);

      const result = await invoke('get_window_count');

      expect(mockInvoke).toHaveBeenCalledWith('get_window_count');
      expect(result).toBe(expectedCount);
      expect(typeof result).toBe('number');
    });
  });

  describe('Window Communication', () => {
    it('should invoke send_message_to_window with event and payload', async () => {
      const label = 'target-window';
      const event = 'custom-event';
      const payload = { type: 'notification', message: 'Hello from test' };

      await invoke('send_message_to_window', { label, event, payload });

      expect(mockInvoke).toHaveBeenCalledWith('send_message_to_window', { label, event, payload });
    });

    it('should invoke broadcast_message to all windows', async () => {
      const event = 'global-update';
      const payload = { version: '1.2.0', urgent: false };

      await invoke('broadcast_message', { event, payload });

      expect(mockInvoke).toHaveBeenCalledWith('broadcast_message', { event, payload });
    });

    it('should invoke on_window_event to set up event listeners', async () => {
      const label = 'event-window';
      const event = 'close_requested';

      await invoke('on_window_event', { label, event });

      expect(mockInvoke).toHaveBeenCalledWith('on_window_event', { label, event });
    });
  });

  describe('Monitor and Cursor Operations', () => {
    it('should invoke get_monitors and return monitor information', async () => {
      const expectedMonitors = [
        {
          name: 'Built-in Retina Display',
          bounds: { x: 0.0, y: 0.0, width: 2560.0, height: 1600.0 },
          position: { x: 0.0, y: 0.0 },
          size: { width: 2560.0, height: 1600.0 },
          scaleFactor: 2.0,
          isPrimary: true
        }
      ];

      mockInvoke.mockResolvedValue(expectedMonitors);

      const result = await invoke('get_monitors');

      expect(mockInvoke).toHaveBeenCalledWith('get_monitors');
      expect(result).toEqual(expectedMonitors);
      expect(result[0].isPrimary).toBe(true);
    });

    it('should invoke get_primary_monitor and return primary monitor', async () => {
      const expectedMonitor = {
        name: 'Primary Display',
        bounds: { x: 0.0, y: 0.0, width: 1920.0, height: 1080.0 },
        position: { x: 0.0, y: 0.0 },
        size: { width: 1920.0, height: 1080.0 },
        scaleFactor: 1.0,
        isPrimary: true
      };

      mockInvoke.mockResolvedValue(expectedMonitor);

      const result = await invoke('get_primary_monitor');

      expect(mockInvoke).toHaveBeenCalledWith('get_primary_monitor');
      expect(result.isPrimary).toBe(true);
    });

    it('should invoke get_cursor_position and return cursor coordinates', async () => {
      const expectedPosition = { x: 512.0, y: 384.0 };

      mockInvoke.mockResolvedValue(expectedPosition);

      const result = await invoke('get_cursor_position');

      expect(mockInvoke).toHaveBeenCalledWith('get_cursor_position');
      expect(result).toEqual(expectedPosition);
      expect(result.x).toBeGreaterThanOrEqual(0);
      expect(result.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Platform-Specific Operations', () => {
    it('should invoke Windows-specific taskbar state command', async () => {
      const expectedState = 'visible';

      mockInvoke.mockResolvedValue(expectedState);

      const result = await invoke('get_windows_taskbar_state');

      expect(mockInvoke).toHaveBeenCalledWith('get_windows_taskbar_state');
      expect(result).toBe(expectedState);
    });

    it('should invoke macOS-specific traffic light positioning', async () => {
      const label = 'mac-window';
      const x = 10.0;
      const y = 10.0;

      await invoke('set_window_traffic_light_position', { label, x, y });

      expect(mockInvoke).toHaveBeenCalledWith('set_window_traffic_light_position', { label, x, y });
    });

    it('should invoke Linux-specific window manager info', async () => {
      const expectedInfo = 'gnome-shell';

      mockInvoke.mockResolvedValue(expectedInfo);

      const result = await invoke('get_window_manager_info');

      expect(mockInvoke).toHaveBeenCalledWith('get_window_manager_info');
      expect(result).toBe(expectedInfo);
    });
  });

  describe('Error Handling and Validation', () => {
    it('should reject operations on non-existent windows', async () => {
      const label = 'nonexistent-window';

      mockInvoke.mockRejectedValue("Window 'nonexistent-window' not found");

      await expect(invoke('close_window', { label })).rejects.toThrow('not found');
    });

    it('should reject invalid window labels', async () => {
      const label = 'window with spaces'; // Invalid

      mockInvoke.mockRejectedValue('Window label validation failed: Invalid characters in label');

      await expect(invoke('close_window', { label })).rejects.toThrow('Invalid characters');
    });

    it('should handle window operation failures', async () => {
      const label = 'failing-window';

      mockInvoke.mockRejectedValue('Window operation failed: System error');

      await expect(invoke('maximize_window', { label })).rejects.toThrow('System error');
    });

    it('should reject invalid window dimensions', async () => {
      const label = 'resized-window';
      const size = { width: -100.0, height: 0.0 };

      mockInvoke.mockRejectedValue('Invalid window dimensions: Width and height must be positive');

      await expect(invoke('set_window_size', { label, size })).rejects.toThrow('must be positive');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete window lifecycle', async () => {
      const label = 'lifecycle-window';

      // Create window
      const createResult = { label, id: 123 };
      mockInvoke.mockResolvedValueOnce(createResult);

      const result = await invoke('create_window', {
        label,
        title: 'Test Window',
        width: 800.0,
        height: 600.0
      });
      expect(result.id).toBe(123);

      // Configure window
      await invoke('set_window_title', { label, title: 'Updated Title' });
      await invoke('set_window_size', { label, size: { width: 1024.0, height: 768.0 } });

      // State management
      await invoke('maximize_window', { label });
      await invoke('toggle_fullscreen_window', { label });

      // Communication
      await invoke('send_message_to_window', {
        label,
        event: 'ready',
        payload: { initialized: true }
      });

      // Query state
      const state = { label, isMaximized: true, width: 1920.0, height: 1080.0 };
      mockInvoke.mockResolvedValueOnce(state);

      const queriedState = await invoke('get_window_state', { label });
      expect(queriedState.isMaximized).toBe(true);

      // Cleanup
      await invoke('close_window', { label });

      expect(mockInvoke).toHaveBeenCalledTimes(8);
    });

    it('should handle multiple window management operations', async () => {
      const windows = ['window1', 'window2', 'window3'];

      // Create multiple windows
      const createPromises = windows.map(async (label, index) => {
        const result = { label, id: index + 1 };
        mockInvoke.mockResolvedValueOnce(result);
        return invoke('create_window', { label, title: `Window ${index + 1}` });
      });

      const results = await Promise.all(createPromises);
      expect(results).toHaveLength(3);

      // Batch operations
      await Promise.all(windows.map(label => invoke('focus_window', { label })));
      await Promise.all(windows.map(label => invoke('center_window', { label })));

      // List all windows
      mockInvoke.mockResolvedValueOnce(windows);
      const listedWindows = await invoke('list_windows');
      expect(listedWindows).toEqual(windows);

      expect(mockInvoke).toHaveBeenCalledTimes(9); // 3 creates + 3 focus + 3 center + 1 list
    });
  });
});
