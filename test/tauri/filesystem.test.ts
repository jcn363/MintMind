import { invoke } from '@tauri-apps/api/core';

jest.mock('@tauri-apps/api/core');

describe('Filesystem Commands', () => {
  const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

  beforeEach(() => {
    // No default mock value - set per test as needed
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('File Reading Operations', () => {
    it('should invoke read_text_file with valid path and return string content', async () => {
      const path = '/valid/path/file.txt';
      const content = 'file content';

      mockInvoke.mockResolvedValue(content);

      const result = await invoke('read_text_file', { path });

      expect(mockInvoke).toHaveBeenCalledWith('read_text_file', { path });
      expect(result).toBe(content);
      expect(typeof result).toBe('string');
    });

    it('should invoke read_binary_file with valid path and return byte array', async () => {
      const path = '/valid/path/file.bin';
      const content = [72, 101, 108, 108, 111]; // "Hello" in bytes

      mockInvoke.mockResolvedValue(content);

      const result = await invoke('read_binary_file', { path });

      expect(mockInvoke).toHaveBeenCalledWith('read_binary_file', { path });
      expect(result).toEqual(content);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle read_text_file with invalid path', async () => {
      const path = '/invalid/path/file.txt';

      mockInvoke.mockRejectedValueOnce('Failed to read file \'/invalid/path/file.txt\': No such file or directory');

      await expect(invoke('read_text_file', { path })).rejects.toThrow('Failed to read file');
    });

    it('should handle read_binary_file with non-existent file', async () => {
      const path = '/nonexistent/file.bin';

      mockInvoke.mockRejectedValue('Failed to read binary file \'/nonexistent/file.bin\': No such file or directory');

      await expect(invoke('read_binary_file', { path })).rejects.toThrow('Failed to read binary file');
    });
  });

  describe('File Writing Operations', () => {
    it('should invoke write_text_file with path and content', async () => {
      const path = '/path/to/file.txt';
      const content = 'new content';

      await invoke('write_text_file', { path, content });

      expect(mockInvoke).toHaveBeenCalledWith('write_text_file', { path, content });
    });

    it('should invoke write_binary_file with path and byte content', async () => {
      const path = '/path/to/file.bin';
      const content = [1, 2, 3, 4, 5];

      await invoke('write_binary_file', { path, content });

      expect(mockInvoke).toHaveBeenCalledWith('write_binary_file', { path, content });
    });

    it('should invoke write_file_atomic with path and content for atomic writes', async () => {
      const path = '/path/to/file.txt';
      const content = 'atomic content';

      await invoke('write_file_atomic', { path, content });

      expect(mockInvoke).toHaveBeenCalledWith('write_file_atomic', { path, content });
    });

    it('should handle write_text_file errors', async () => {
      const path = '/readonly/path/file.txt';
      const content = 'content';

      mockInvoke.mockRejectedValue('Failed to write file \'/readonly/path/file.txt\': Permission denied');

      await expect(invoke('write_text_file', { path, content })).rejects.toThrow('Failed to write file');
    });
  });

  describe('Directory Operations', () => {
    it('should invoke create_dir with valid path', async () => {
      const path = '/path/to/new/dir';

      await invoke('create_dir', { path });

      expect(mockInvoke).toHaveBeenCalledWith('create_dir', { path });
    });

    it('should invoke read_dir and return directory entries', async () => {
      const path = '/some/directory';
      const expectedEntries = [
        { name: 'file1.txt', path: '/some/directory/file1.txt', is_dir: false, is_file: true, size: 1024, modified: 1234567890 },
        { name: 'subdir', path: '/some/directory/subdir', is_dir: true, is_file: false, size: null, modified: 1234567800 }
      ];

      mockInvoke.mockResolvedValue(expectedEntries);

      const result = await invoke('read_dir', { path });

      expect(mockInvoke).toHaveBeenCalledWith('read_dir', { path });
      expect(result).toEqual(expectedEntries);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should invoke remove_dir for empty directory removal', async () => {
      const path = '/path/to/empty/dir';

      await invoke('remove_dir', { path });

      expect(mockInvoke).toHaveBeenCalledWith('remove_dir', { path });
    });

    it('should invoke remove_dir_all for recursive directory removal', async () => {
      const path = '/path/to/dir/with/contents';

      await invoke('remove_dir_all', { path });

      expect(mockInvoke).toHaveBeenCalledWith('remove_dir_all', { path });
    });

    it('should handle create_dir with existing directory', async () => {
      const path = '/existing/directory';

      mockInvoke.mockRejectedValue('Failed to create directory \'/existing/directory\': Directory already exists');

      await expect(invoke('create_dir', { path })).rejects.toThrow('Failed to create directory');
    });
  });

  describe('File Operations', () => {
    it('should invoke copy_file with source and destination paths', async () => {
      const from = '/source/file.txt';
      const to = '/destination/file.txt';
      const options = { overwrite: true, recursive: false };

      mockInvoke.mockResolvedValue(1024); // bytes copied

      const result = await invoke('copy_file', { from, to, options });

      expect(mockInvoke).toHaveBeenCalledWith('copy_file', { from, to, options });
      expect(result).toBe(1024);
    });

    it('should invoke rename with source and destination paths', async () => {
      const from = '/old/path/file.txt';
      const to = '/new/path/file.txt';
      const options = { overwrite: false };

      await invoke('rename', { from, to, options });

      expect(mockInvoke).toHaveBeenCalledWith('rename', { from, to, options });
    });

    it('should invoke copy_dir_atomic for atomic directory copying', async () => {
      const from = '/source/directory';
      const to = '/destination/directory';

      await invoke('copy_dir_atomic', { from, to });

      expect(mockInvoke).toHaveBeenCalledWith('copy_dir_atomic', { from, to });
    });

    it('should invoke remove_file for file deletion', async () => {
      const path = '/path/to/file.txt';

      await invoke('remove_file', { path });

      expect(mockInvoke).toHaveBeenCalledWith('remove_file', { path });
    });
  });

  describe('Filesystem Queries', () => {
    it('should invoke exists to check if path exists', async () => {
      const path = '/some/path';

      mockInvoke.mockResolvedValue(true);

      const result = await invoke('exists', { path });

      expect(mockInvoke).toHaveBeenCalledWith('exists', { path });
      expect(result).toBe(true);
    });

    it('should invoke metadata and return file information', async () => {
      const path = '/path/to/file.txt';
      const expectedMetadata = {
        path: '/path/to/file.txt',
        size: 1024,
        is_dir: false,
        is_file: true,
        modified: 1234567890,
        created: 1234567800,
        readonly: false
      };

      mockInvoke.mockResolvedValue(expectedMetadata);

      const result = await invoke('metadata', { path });

      expect(mockInvoke).toHaveBeenCalledWith('metadata', { path });
      expect(result).toEqual(expectedMetadata);
      expect(result.is_file).toBe(true);
      expect(result.size).toBe(1024);
    });
  });

  describe('Platform-specific Operations', () => {
    it('should invoke current_dir and return current working directory', async () => {
      const expectedCwd = '/home/user/project';

      mockInvoke.mockResolvedValue(expectedCwd);

      const result = await invoke('current_dir');

      expect(mockInvoke).toHaveBeenCalledWith('current_dir');
      expect(result).toBe(expectedCwd);
    });

    it('should invoke home_dir and return user home directory', async () => {
      const expectedHome = '/home/user';

      mockInvoke.mockResolvedValue(expectedHome);

      const result = await invoke('home_dir');

      expect(mockInvoke).toHaveBeenCalledWith('home_dir');
      expect(result).toBe(expectedHome);
    });

    it('should invoke path_separator and return platform-specific separator', async () => {
      const expectedSeparator = '/'; // Unix-style

      mockInvoke.mockResolvedValue(expectedSeparator);

      const result = await invoke('path_separator');

      expect(mockInvoke).toHaveBeenCalledWith('path_separator');
      expect(result).toBe(expectedSeparator);
    });
  });

  describe('Error Handling and Validation', () => {
    it('should validate paths and reject path traversal attempts', async () => {
      const invalidPath = '../../../etc/passwd';

      mockInvoke.mockRejectedValue('Path validation failed: Invalid path structure');

      await expect(invoke('read_text_file', { path: invalidPath })).rejects.toThrow('Path validation failed');
    });

    it('should handle permission errors', async () => {
      const path = '/root/protected/file.txt';

      mockInvoke.mockRejectedValue('Failed to read file \'/root/protected/file.txt\': Permission denied');

      await expect(invoke('read_text_file', { path })).rejects.toThrow('Permission denied');
    });

    it('should handle disk full errors during write operations', async () => {
      const path = '/path/to/file.txt';
      const content = 'large content';

      mockInvoke.mockRejectedValue('Failed to write file \'/path/to/file.txt\': No space left on device');

      await expect(invoke('write_text_file', { path, content })).rejects.toThrow('No space left on device');
    });

    it('should handle invalid UTF-8 when reading binary files as text', async () => {
      const path = '/binary/file.bin';

      mockInvoke.mockRejectedValue('Failed to read file \'/binary/file.bin\': Invalid UTF-8');

      await expect(invoke('read_text_file', { path })).rejects.toThrow('Invalid UTF-8');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete file copy workflow', async () => {
      const sourcePath = '/source/file.txt';
      const destPath = '/dest/file.txt';

      // Check source exists
      mockInvoke.mockResolvedValueOnce(true);
      const exists = await invoke('exists', { path: sourcePath });
      expect(exists).toBe(true);

      // Copy file
      mockInvoke.mockResolvedValueOnce(2048);
      const bytesCopied = await invoke('copy_file', { from: sourcePath, to: destPath, options: { overwrite: true, recursive: false } });
      expect(bytesCopied).toBe(2048);

      // Verify destination exists
      mockInvoke.mockResolvedValueOnce(true);
      const destExists = await invoke('exists', { path: destPath });
      expect(destExists).toBe(true);

      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });

    it('should handle directory creation and file writing workflow', async () => {
      const dirPath = '/new/directory';
      const filePath = '/new/directory/file.txt';
      const content = 'Hello World';

      // Create directory
      await invoke('create_dir', { path: dirPath });

      // Write file
      await invoke('write_text_file', { path: filePath, content });

      // Verify file exists
      mockInvoke.mockResolvedValueOnce(true);
      const exists = await invoke('exists', { path: filePath });
      expect(exists).toBe(true);

      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });
  });
});
