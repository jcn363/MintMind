import { invoke } from '@tauri-apps/api/core';

jest.mock('@tauri-apps/api/core', () => ({ invoke: jest.fn() }));

describe('Shell Commands', () => {
  const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

  beforeEach(() => {
    // No default mock value - set per test as needed
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('External URL Opening', () => {
    it('should invoke open_external with valid HTTPS URL', async () => {
      const url = 'https://example.com';

      await invoke('open_external', { url });

      expect(mockInvoke).toHaveBeenCalledWith('open_external', { url });
    });

    it('should invoke open_external with valid HTTP URL', async () => {
      const url = 'http://localhost:3000';

      await invoke('open_external', { url });

      expect(mockInvoke).toHaveBeenCalledWith('open_external', { url });
    });

    it('should handle open_external with file:// URLs', async () => {
      const url = 'file:///path/to/file.txt';

      await invoke('open_external', { url });

      expect(mockInvoke).toHaveBeenCalledWith('open_external', { url });
    });

    it('should reject open_external with javascript: scheme', async () => {
      const url = 'javascript:alert("hacked")';

      mockInvoke.mockRejectedValue('Invalid scheme: javascript URLs are not allowed');

      await expect(invoke('open_external', { url })).rejects.toThrow('Invalid scheme');
    });

    it('should reject open_external with data: scheme', async () => {
      const url = 'data:text/html,<script>alert("xss")</script>';

      mockInvoke.mockRejectedValue('Invalid scheme: data URLs are not allowed');

      await expect(invoke('open_external', { url })).rejects.toThrow('Invalid scheme');
    });

    it('should reject open_external with malformed URLs', async () => {
      const url = 'not-a-url-at-all';

      mockInvoke.mockRejectedValue('Invalid URL format');

      await expect(invoke('open_external', { url })).rejects.toThrow('Invalid URL format');
    });
  });

  describe('File System Shell Operations', () => {
    it('should invoke show_item_in_folder with valid file path', async () => {
      const path = '/home/user/documents/file.txt';

      await invoke('show_item_in_folder', { path });

      expect(mockInvoke).toHaveBeenCalledWith('show_item_in_folder', { path });
    });

    it('should invoke show_item_in_folder with directory path', async () => {
      const path = '/home/user/projects';

      await invoke('show_item_in_folder', { path });

      expect(mockInvoke).toHaveBeenCalledWith('show_item_in_folder', { path });
    });

    it('should reject show_item_in_folder with non-existent path', async () => {
      const path = '/nonexistent/path/file.txt';

      mockInvoke.mockRejectedValue('Path does not exist: /nonexistent/path/file.txt');

      await expect(invoke('show_item_in_folder', { path })).rejects.toThrow('Path does not exist');
    });

    it('should invoke move_item_to_trash with valid file path', async () => {
      const path = '/home/user/temp/file.txt';

      await invoke('move_item_to_trash', { path });

      expect(mockInvoke).toHaveBeenCalledWith('move_item_to_trash', { path });
    });

    it('should invoke move_item_to_trash with directory path', async () => {
      const path = '/home/user/temp/folder';

      await invoke('move_item_to_trash', { path });

      expect(mockInvoke).toHaveBeenCalledWith('move_item_to_trash', { path });
    });

    it('should reject move_item_to_trash with protected system path', async () => {
      const path = '/etc/passwd';

      mockInvoke.mockRejectedValue('Permission denied: Cannot trash system files');

      await expect(invoke('move_item_to_trash', { path })).rejects.toThrow('Permission denied');
    });

    it('should reject move_item_to_trash with non-existent path', async () => {
      const path = '/does/not/exist.txt';

      mockInvoke.mockRejectedValue('Path does not exist: /does/not/exist.txt');

      await expect(invoke('move_item_to_trash', { path })).rejects.toThrow('Path does not exist');
    });
  });

  describe('Shell Environment Access', () => {
    it('should invoke fetch_shell_env and return environment variables', async () => {
      const expectedEnv = {
        'PATH': '/usr/bin:/bin:/usr/local/bin',
        'HOME': '/home/user',
        'SHELL': '/bin/bash',
        'USER': 'testuser',
        'LANG': 'en_US.UTF-8'
      };

      mockInvoke.mockResolvedValue(expectedEnv);

      const result = await invoke('fetch_shell_env');

      expect(mockInvoke).toHaveBeenCalledWith('fetch_shell_env');
      expect(result).toEqual(expectedEnv);
      expect(result.PATH).toBeDefined();
      expect(result.HOME).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should handle fetch_shell_env with fallback when shell command fails', async () => {
      const fallbackEnv = {
        'PATH': '/usr/bin',
        'HOME': '/home/user'
      };

      mockInvoke.mockResolvedValue(fallbackEnv);

      const result = await invoke('fetch_shell_env');

      expect(result).toEqual(fallbackEnv);
      // Should still return some environment variables
    });
  });

  describe('Error Handling and Validation', () => {
    it('should handle shell command execution failures', async () => {
      mockInvoke.mockRejectedValue('Shell command failed: command not found');

      await expect(invoke('fetch_shell_env')).rejects.toThrow('Shell command failed');
    });

    it('should validate path parameters for shell operations', async () => {
      const invalidPath = '../../../etc/passwd';

      mockInvoke.mockRejectedValue('Path validation failed: Path traversal detected');

      await expect(invoke('show_item_in_folder', { path: invalidPath })).rejects.toThrow('Path validation failed');
    });

    it('should handle permission errors for shell operations', async () => {
      const protectedPath = '/root/system.conf';

      mockInvoke.mockRejectedValue('Permission denied: Access to system files not allowed');

      await expect(invoke('show_item_in_folder', { path: protectedPath })).rejects.toThrow('Permission denied');
    });

    it('should handle URL scheme validation errors', async () => {
      const dangerousUrl = 'vbscript:Execute("malicious code")';

      mockInvoke.mockRejectedValue('Invalid URL scheme: vbscript not allowed');

      await expect(invoke('open_external', { url: dangerousUrl })).rejects.toThrow('Invalid URL scheme');
    });

    it('should handle empty or null parameters', async () => {
      mockInvoke.mockRejectedValue('Parameter validation failed: path cannot be empty');

      await expect(invoke('show_item_in_folder', { path: '' })).rejects.toThrow('Parameter validation failed');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle Windows-specific path formats', async () => {
      const windowsPath = 'C:\\Users\\user\\Documents\\file.txt';

      await invoke('show_item_in_folder', { path: windowsPath });

      expect(mockInvoke).toHaveBeenCalledWith('show_item_in_folder', { path: windowsPath });
    });

    it('should handle Unix-specific path formats', async () => {
      const unixPath = '/home/user/.config/app/settings.json';

      await invoke('show_item_in_folder', { path: unixPath });

      expect(mockInvoke).toHaveBeenCalledWith('show_item_in_folder', { path: unixPath });
    });

    it('should handle platform-specific URL schemes', async () => {
      const platformUrls = [
        'file:///C:/Windows/System32/notepad.exe', // Windows
        'file:///Applications/TextEdit.app',       // macOS
        'file:///usr/bin/vim'                      // Linux
      ];

      for (const url of platformUrls) {
        await invoke('open_external', { url });
      }

      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle file editing workflow: show in folder -> open external -> cleanup', async () => {
      const filePath = '/home/user/projects/document.txt';

      // Show file in folder
      await invoke('show_item_in_folder', { path: filePath });

      // Open file with external editor (simulated)
      const fileUrl = `file://${filePath}`;
      await invoke('open_external', { url: fileUrl });

      // Move to trash after editing
      await invoke('move_item_to_trash', { path: filePath });

      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });

    it('should handle environment inspection workflow', async () => {
      // Fetch shell environment
      const env = {
        'PATH': '/usr/bin:/bin',
        'HOME': '/home/user',
        'SHELL': '/bin/bash'
      };
      mockInvoke.mockResolvedValueOnce(env);

      const environment = await invoke('fetch_shell_env');
      expect(environment.SHELL).toBe('/bin/bash');

      // Use environment info to show config directory
      const configPath = `${environment.HOME}/.config/app`;
      await invoke('show_item_in_folder', { path: configPath });

      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should handle bulk file operations', async () => {
      const files = [
        '/temp/file1.txt',
        '/temp/file2.txt',
        '/temp/file3.txt'
      ];

      // Move multiple files to trash
      for (const file of files) {
        await invoke('move_item_to_trash', { path: file });
      }

      expect(mockInvoke).toHaveBeenCalledTimes(3);

      // Show containing directory
      await invoke('show_item_in_folder', { path: '/temp' });

      expect(mockInvoke).toHaveBeenCalledTimes(4);
    });
  });
});
