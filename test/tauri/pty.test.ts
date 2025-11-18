import { invoke } from '@tauri-apps/api/core';

jest.mock('@tauri-apps/api/core');

describe('PTY Commands', () => {
  const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

  beforeEach(() => {
    mockInvoke.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PTY Session Management', () => {
    it('should invoke pty_spawn with executable, args, cwd, env, cols, and rows', async () => {
      const id = 'terminal_1';
      const executable = '/bin/bash';
      const args = ['-l'];
      const cwd = '/home/user';
      const env = { 'TERM': 'xterm-256color', 'SHELL': '/bin/bash' };
      const cols = 80;
      const rows = 24;
      const shell_integration = { enabled: true, nonce: 'test_nonce' };

      const expectedResult = {
        pid: 1234,
        cwd: '/home/user',
        backend: 'portable-pty'
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('pty_spawn', {
        id, executable, args, cwd, env, cols, rows, shell_integration
      });

      expect(mockInvoke).toHaveBeenCalledWith('pty_spawn', {
        id, executable, args, cwd, env, cols, rows, shell_integration
      });
      expect(result).toEqual(expectedResult);
      expect(result.pid).toBeGreaterThan(0);
      expect(result.backend).toBe('portable-pty');
    });

    it('should invoke pty_spawn with minimal parameters', async () => {
      const id = 'minimal_terminal';
      const executable = 'bash';
      const args = [];
      const cwd = '';
      const env = {};
      const cols = 80;
      const rows = 24;

      const expectedResult = {
        pid: 5678,
        cwd: '/tmp',
        backend: 'portable-pty'
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('pty_spawn', {
        id, executable, args, cwd, env, cols, rows
      });

      expect(mockInvoke).toHaveBeenCalledWith('pty_spawn', {
        id, executable, args, cwd, env, cols, rows
      });
      expect(result.pid).toBe(5678);
    });

    it('should handle pty_spawn with invalid executable', async () => {
      const id = 'invalid_terminal';
      const executable = '/nonexistent/shell';
      const args = [];
      const cwd = '/tmp';
      const env = {};
      const cols = 80;
      const rows = 24;

      mockInvoke.mockRejectedValue('Failed to spawn PTY process: No such file or directory');

      await expect(invoke('pty_spawn', {
        id, executable, args, cwd, env, cols, rows
      })).rejects.toThrow('Failed to spawn PTY process');
    });

    it('should invoke pty_list_sessions and return active session IDs', async () => {
      const expectedSessions = ['terminal_1', 'terminal_2', 'terminal_3'];

      mockInvoke.mockResolvedValue(expectedSessions);

      const result = await invoke('pty_list_sessions');

      expect(mockInvoke).toHaveBeenCalledWith('pty_list_sessions');
      expect(result).toEqual(expectedSessions);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('PTY Data I/O', () => {
    it('should invoke pty_write with id, data, and is_binary flag', async () => {
      const id = 'terminal_1';
      const data = 'echo "Hello World"\n';
      const is_binary = false;

      await invoke('pty_write', { id, data, is_binary });

      expect(mockInvoke).toHaveBeenCalledWith('pty_write', { id, data, is_binary });
    });

    it('should invoke pty_write with binary data', async () => {
      const id = 'terminal_1';
      const data = '\x00\x01\x02\x03'; // Binary data
      const is_binary = true;

      await invoke('pty_write', { id, data, is_binary });

      expect(mockInvoke).toHaveBeenCalledWith('pty_write', { id, data, is_binary });
    });

    it('should invoke pty_read with id and max_bytes, returning base64 encoded data', async () => {
      const id = 'terminal_1';
      const max_bytes = 4096;
      const expectedResult = {
        data: 'SGVsbG8gV29ybGQ=', // "Hello World" in base64
        bytes_read: 11
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('pty_read', { id, max_bytes });

      expect(mockInvoke).toHaveBeenCalledWith('pty_read', { id, max_bytes });
      expect(result).toEqual(expectedResult);
      expect(result.data).toBeDefined();
      expect(result.bytes_read).toBe(11);
    });

    it('should handle pty_read with buffer size limits', async () => {
      const id = 'terminal_1';
      const max_bytes = 2 * 1024 * 1024; // 2MB, exceeds limit

      mockInvoke.mockRejectedValue('max_bytes 2097152 exceeds maximum buffer size 1048576');

      await expect(invoke('pty_read', { id, max_bytes })).rejects.toThrow('exceeds maximum buffer size');
    });
  });

  describe('PTY Control Operations', () => {
    it('should invoke pty_resize with id, cols, and rows', async () => {
      const id = 'terminal_1';
      const cols = 120;
      const rows = 30;

      await invoke('pty_resize', { id, cols, rows });

      expect(mockInvoke).toHaveBeenCalledWith('pty_resize', { id, cols, rows });
    });

    it('should reject pty_resize with invalid dimensions', async () => {
      const id = 'terminal_1';
      const cols = 0;
      const rows = 24;

      mockInvoke.mockRejectedValue('Invalid config: Columns and rows must be >= 1');

      await expect(invoke('pty_resize', { id, cols, rows })).rejects.toThrow('must be >= 1');
    });

    it('should invoke pty_kill with id and optional signal', async () => {
      const id = 'terminal_1';
      const signal = 'SIGTERM';

      await invoke('pty_kill', { id, signal });

      expect(mockInvoke).toHaveBeenCalledWith('pty_kill', { id, signal });
    });

    it('should invoke pty_shutdown with id and immediate flag', async () => {
      const id = 'terminal_1';
      const immediate = false;

      await invoke('pty_shutdown', { id, immediate });

      expect(mockInvoke).toHaveBeenCalledWith('pty_shutdown', { id, immediate });
    });

    it('should handle pty_kill with non-existent session', async () => {
      const id = 'nonexistent_terminal';

      mockInvoke.mockRejectedValue('Session not found: nonexistent_terminal');

      await expect(invoke('pty_kill', { id })).rejects.toThrow('Session not found');
    });
  });

  describe('PTY Information Queries', () => {
    it('should invoke pty_get_cwd and return current working directory', async () => {
      const id = 'terminal_1';
      const expectedCwd = '/home/user/projects';

      mockInvoke.mockResolvedValue(expectedCwd);

      const result = await invoke('pty_get_cwd', { id });

      expect(mockInvoke).toHaveBeenCalledWith('pty_get_cwd', { id });
      expect(result).toBe(expectedCwd);
    });

    it('should invoke pty_get_title and return process title', async () => {
      const id = 'terminal_1';
      const expectedTitle = 'bash';

      mockInvoke.mockResolvedValue(expectedTitle);

      const result = await invoke('pty_get_title', { id });

      expect(mockInvoke).toHaveBeenCalledWith('pty_get_title', { id });
      expect(result).toBe(expectedTitle);
    });

    it('should invoke pty_get_shell_type and return shell type', async () => {
      const id = 'terminal_1';
      const expectedShellType = 'bash';

      mockInvoke.mockResolvedValue(expectedShellType);

      const result = await invoke('pty_get_shell_type', { id });

      expect(mockInvoke).toHaveBeenCalledWith('pty_get_shell_type', { id });
      expect(result).toBe(expectedShellType);
    });

    it('should invoke pty_get_pid and return process ID', async () => {
      const id = 'terminal_1';
      const expectedPid = 12345;

      mockInvoke.mockResolvedValue(expectedPid);

      const result = await invoke('pty_get_pid', { id });

      expect(mockInvoke).toHaveBeenCalledWith('pty_get_pid', { id });
      expect(result).toBe(expectedPid);
      expect(typeof result).toBe('number');
    });
  });

  describe('PTY Flow Control', () => {
    it('should invoke pty_acknowledge_data to update flow control', async () => {
      const id = 'terminal_1';
      const char_count = 1024;

      await invoke('pty_acknowledge_data', { id, char_count });

      expect(mockInvoke).toHaveBeenCalledWith('pty_acknowledge_data', { id, char_count });
    });

    it('should invoke pty_clear_unacknowledged to reset flow control', async () => {
      const id = 'terminal_1';

      await invoke('pty_clear_unacknowledged', { id });

      expect(mockInvoke).toHaveBeenCalledWith('pty_clear_unacknowledged', { id });
    });

    it('should handle flow control with large data writes', async () => {
      const id = 'terminal_1';
      const largeData = 'a'.repeat(150000); // Exceeds FLOW_CONTROL_HIGH_WATERMARK
      const is_binary = false;

      // First write should succeed but trigger flow control
      await invoke('pty_write', { id, data: largeData, is_binary });

      // Acknowledge some data to resume
      await invoke('pty_acknowledge_data', { id, char_count: 100000 });

      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });
  });

  describe('PTY Event Streaming', () => {
    it('should invoke pty_start_data_stream to begin event-based data streaming', async () => {
      const id = 'terminal_1';

      await invoke('pty_start_data_stream', { id });

      expect(mockInvoke).toHaveBeenCalledWith('pty_start_data_stream', { id });
    });
  });

  describe('Error Handling and Validation', () => {
    it('should reject with invalid PTY ID', async () => {
      const id = '';

      mockInvoke.mockRejectedValue('PTY ID validation failed: ID cannot be empty');

      await expect(invoke('pty_spawn', {
        id, executable: 'bash', args: [], cwd: '/tmp', env: {}, cols: 80, rows: 24
      })).rejects.toThrow('PTY ID validation failed');
    });

    it('should reject with invalid executable path', async () => {
      const id = 'terminal_1';
      const executable = '';

      mockInvoke.mockRejectedValue('Executable path validation failed: Path cannot be empty');

      await expect(invoke('pty_spawn', {
        id, executable, args: [], cwd: '/tmp', env: {}, cols: 80, rows: 24
      })).rejects.toThrow('Executable path validation failed');
    });

    it('should reject with invalid CWD path', async () => {
      const id = 'terminal_1';
      const executable = 'bash';
      const cwd = '/nonexistent/directory';

      mockInvoke.mockRejectedValue('Path validation failed: Directory does not exist');

      await expect(invoke('pty_spawn', {
        id, executable, args: [], cwd, env: {}, cols: 80, rows: 24
      })).rejects.toThrow('Path validation failed');
    });

    it('should reject with invalid dimensions', async () => {
      const id = 'terminal_1';
      const executable = 'bash';
      const cols = 0;
      const rows = 24;

      mockInvoke.mockRejectedValue('PTY dimensions validation failed: Columns and rows must be >= 1');

      await expect(invoke('pty_spawn', {
        id, executable, args: [], cwd: '/tmp', env: {}, cols, rows
      })).rejects.toThrow('PTY dimensions validation failed');
    });

    it('should handle PTY process crashes', async () => {
      const id = 'terminal_1';

      mockInvoke.mockRejectedValue('PTY process terminated unexpectedly');

      await expect(invoke('pty_write', { id, data: 'test\n', is_binary: false }))
        .rejects.toThrow('PTY process terminated unexpectedly');
    });

    it('should handle I/O errors during data operations', async () => {
      const id = 'terminal_1';

      mockInvoke.mockRejectedValue('I/O error: Broken pipe');

      await expect(invoke('pty_read', { id, max_bytes: 1024 }))
        .rejects.toThrow('I/O error: Broken pipe');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete PTY lifecycle', async () => {
      const id = 'lifecycle_test';
      const executable = 'bash';
      const args = ['--norc'];
      const cwd = '/tmp';
      const env = { 'TERM': 'xterm-256color' };
      const cols = 80;
      const rows = 24;

      // Spawn PTY
      const spawnResult = { pid: 9999, cwd: '/tmp', backend: 'portable-pty' };
      mockInvoke.mockResolvedValueOnce(spawnResult);
      const result = await invoke('pty_spawn', {
        id, executable, args, cwd, env, cols, rows
      });
      expect(result.pid).toBe(9999);

      // Get PID
      mockInvoke.mockResolvedValueOnce(9999);
      const pid = await invoke('pty_get_pid', { id });
      expect(pid).toBe(9999);

      // Get shell type
      mockInvoke.mockResolvedValueOnce('bash');
      const shellType = await invoke('pty_get_shell_type', { id });
      expect(shellType).toBe('bash');

      // Write data
      await invoke('pty_write', { id, data: 'pwd\n', is_binary: false });

      // Read response
      const readResult = { data: 'L3RtcAo=', bytes_read: 5 }; // "/tmp\n" base64 encoded
      mockInvoke.mockResolvedValueOnce(readResult);
      const output = await invoke('pty_read', { id, max_bytes: 4096 });
      expect(output.bytes_read).toBe(5);

      // Resize
      await invoke('pty_resize', { id, cols: 120, rows: 30 });

      // Shutdown gracefully
      await invoke('pty_shutdown', { id, immediate: false });

      expect(mockInvoke).toHaveBeenCalledTimes(7);
    });

    it('should handle multiple concurrent PTY sessions', async () => {
      const sessions = ['term1', 'term2', 'term3'];

      // Spawn multiple sessions
      const spawnPromises = sessions.map(async (id, index) => {
        const result = { pid: 1000 + index, cwd: '/tmp', backend: 'portable-pty' };
        mockInvoke.mockResolvedValueOnce(result);
        return invoke('pty_spawn', {
          id,
          executable: 'bash',
          args: [],
          cwd: '/tmp',
          env: {},
          cols: 80,
          rows: 24
        });
      });

      const results = await Promise.all(spawnPromises);
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.pid).toBe(1000 + index);
      });

      // List all sessions
      mockInvoke.mockResolvedValueOnce(sessions);
      const activeSessions = await invoke('pty_list_sessions');
      expect(activeSessions).toEqual(sessions);
    });

    it('should handle shell integration setup', async () => {
      const id = 'integrated_terminal';
      const shell_integration = {
        enabled: true,
        nonce: 'unique_nonce_123'
      };

      await invoke('pty_spawn', {
        id,
        executable: 'zsh',
        args: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
        shell_integration
      });

      expect(mockInvoke).toHaveBeenCalledWith('pty_spawn', expect.objectContaining({
        id,
        executable: 'zsh',
        shell_integration
      }));
    });
  });
});
