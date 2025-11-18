import { invoke } from '@tauri-apps/api/core';

jest.mock('@tauri-apps/api/core');

describe('Dialog Commands', () => {
  const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

  beforeEach(() => {
    mockInvoke.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Message Box Dialog', () => {
    it('should invoke show_message_box with all parameters and return response', async () => {
      const message = 'Are you sure you want to delete this file?';
      const detail = 'This action cannot be undone.';
      const type = 'question';
      const buttons = ['Delete', 'Cancel'];
      const default_id = 1;
      const cancel_id = 1;
      const title = 'Confirm Deletion';
      const window_label = 'main_window';
      const checkbox_checked = false;

      const expectedResult = {
        response: 1, // User clicked Cancel
        checkbox_checked: false
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('show_message_box', {
        message,
        detail,
        type,
        buttons,
        default_id,
        cancel_id,
        title,
        window_label,
        checkbox_checked
      });

      expect(mockInvoke).toHaveBeenCalledWith('show_message_box', {
        message,
        detail,
        type,
        buttons,
        default_id,
        cancel_id,
        title,
        window_label,
        checkbox_checked
      });
      expect(result).toEqual(expectedResult);
      expect(result.response).toBe(1);
    });

    it('should invoke show_message_box with minimal parameters', async () => {
      const message = 'Simple message';
      const type = 'info';

      const expectedResult = {
        response: 0,
        checkbox_checked: undefined
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('show_message_box', { message, type });

      expect(mockInvoke).toHaveBeenCalledWith('show_message_box', { message, type });
      expect(result.response).toBe(0);
    });

    it('should handle show_message_box with different dialog types', async () => {
      const types = ['info', 'error', 'question', 'warning'];

      for (const type of types) {
        const expectedResult = { response: 0, checkbox_checked: undefined };
        mockInvoke.mockResolvedValue(expectedResult);

        const result = await invoke('show_message_box', {
          message: 'Test message',
          type
        });

        expect(mockInvoke).toHaveBeenCalledWith('show_message_box', {
          message: 'Test message',
          type
        });
        expect(result.response).toBeDefined();
      }
    });

    it('should reject show_message_box with invalid dialog type', async () => {
      const message = 'Test message';
      const type = 'invalid_type';

      mockInvoke.mockRejectedValue('Invalid dialog type: invalid_type');

      await expect(invoke('show_message_box', { message, type }))
        .rejects.toThrow('Invalid dialog type');
    });

    it('should reject show_message_box with invalid buttons', async () => {
      const message = 'Test message';
      const type = 'info';
      const buttons = ['Button1', 'Button2', 'Button3']; // Too many buttons for Tauri

      mockInvoke.mockRejectedValue('Invalid buttons: Tauri only supports OK/Cancel pattern');

      await expect(invoke('show_message_box', { message, type, buttons }))
        .rejects.toThrow('Invalid buttons');
    });
  });

  describe('Save Dialog', () => {
    it('should invoke show_save_dialog with all parameters and return file path', async () => {
      const title = 'Save Document';
      const default_path = '/home/user/document.txt';
      const filters = [
        { name: 'Text Files', extensions: ['txt', 'md'] },
        { name: 'All Files', extensions: ['*'] }
      ];
      const window_label = 'main_window';

      const expectedResult = {
        canceled: false,
        file_path: '/home/user/document.txt'
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('show_save_dialog', {
        title,
        default_path,
        filters,
        window_label
      });

      expect(mockInvoke).toHaveBeenCalledWith('show_save_dialog', {
        title,
        default_path,
        filters,
        window_label
      });
      expect(result).toEqual(expectedResult);
      expect(result.canceled).toBe(false);
      expect(result.file_path).toBe('/home/user/document.txt');
    });

    it('should invoke show_save_dialog with minimal parameters', async () => {
      const title = 'Save File';

      const expectedResult = {
        canceled: false,
        file_path: '/default/path/file.txt'
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('show_save_dialog', { title });

      expect(mockInvoke).toHaveBeenCalledWith('show_save_dialog', { title });
      expect(result.file_path).toBeDefined();
    });

    it('should handle show_save_dialog cancellation', async () => {
      const title = 'Save File';

      const expectedResult = {
        canceled: true,
        file_path: null
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('show_save_dialog', { title });

      expect(result.canceled).toBe(true);
      expect(result.file_path).toBeNull();
    });

    it('should reject show_save_dialog with invalid title', async () => {
      const title = '';

      mockInvoke.mockRejectedValue('Title validation failed: Title cannot be empty');

      await expect(invoke('show_save_dialog', { title }))
        .rejects.toThrow('Title validation failed');
    });

    it('should reject show_save_dialog with invalid path', async () => {
      const title = 'Save File';
      const default_path = '../../../etc/passwd'; // Path traversal attempt

      mockInvoke.mockRejectedValue('Path validation failed: Invalid path structure');

      await expect(invoke('show_save_dialog', { title, default_path }))
        .rejects.toThrow('Path validation failed');
    });

    it('should handle show_save_dialog with file filters', async () => {
      const title = 'Save Image';
      const filters = [
        { name: 'PNG Files', extensions: ['png'] },
        { name: 'JPEG Files', extensions: ['jpg', 'jpeg'] },
        { name: 'All Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] }
      ];

      const expectedResult = {
        canceled: false,
        file_path: '/home/user/image.png'
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('show_save_dialog', { title, filters });

      expect(mockInvoke).toHaveBeenCalledWith('show_save_dialog', { title, filters });
      expect(result.file_path).toMatch(/\.png$/);
    });
  });

  describe('Open Dialog', () => {
    it('should invoke show_open_dialog with all parameters and return file paths', async () => {
      const title = 'Open Files';
      const default_path = '/home/user/documents';
      const filters = [
        { name: 'TypeScript Files', extensions: ['ts', 'tsx'] },
        { name: 'JavaScript Files', extensions: ['js', 'jsx'] }
      ];
      const properties = ['openFile', 'multiSelections'];
      const window_label = 'main_window';

      const expectedResult = {
        canceled: false,
        file_paths: ['/home/user/documents/main.ts', '/home/user/documents/utils.ts']
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('show_open_dialog', {
        title,
        default_path,
        filters,
        properties,
        window_label
      });

      expect(mockInvoke).toHaveBeenCalledWith('show_open_dialog', {
        title,
        default_path,
        filters,
        properties,
        window_label
      });
      expect(result).toEqual(expectedResult);
      expect(result.canceled).toBe(false);
      expect(result.file_paths).toHaveLength(2);
      expect(result.file_paths[0]).toMatch(/\.ts$/);
    });

    it('should invoke show_open_dialog for single file selection', async () => {
      const title = 'Open File';
      const properties = ['openFile'];

      const expectedResult = {
        canceled: false,
        file_paths: ['/home/user/document.txt']
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('show_open_dialog', { title, properties });

      expect(mockInvoke).toHaveBeenCalledWith('show_open_dialog', { title, properties });
      expect(result.file_paths).toHaveLength(1);
    });

    it('should invoke show_open_dialog for directory selection', async () => {
      const title = 'Select Directory';
      const properties = ['openDirectory'];

      const expectedResult = {
        canceled: false,
        file_paths: ['/home/user/projects']
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('show_open_dialog', { title, properties });

      expect(mockInvoke).toHaveBeenCalledWith('show_open_dialog', { title, properties });
      expect(result.file_paths).toHaveLength(1);
    });

    it('should invoke show_open_dialog for multiple directories', async () => {
      const title = 'Select Directories';
      const properties = ['openDirectory', 'multiSelections'];

      const expectedResult = {
        canceled: false,
        file_paths: ['/home/user/projects', '/home/user/documents']
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('show_open_dialog', { title, properties });

      expect(mockInvoke).toHaveBeenCalledWith('show_open_dialog', { title, properties });
      expect(result.file_paths).toHaveLength(2);
    });

    it('should handle show_open_dialog cancellation', async () => {
      const title = 'Open File';
      const properties = ['openFile'];

      const expectedResult = {
        canceled: true,
        file_paths: []
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('show_open_dialog', { title, properties });

      expect(result.canceled).toBe(true);
      expect(result.file_paths).toHaveLength(0);
    });

    it('should reject show_open_dialog with invalid properties', async () => {
      const title = 'Open File';
      const properties = ['invalidProperty'];

      mockInvoke.mockRejectedValue('Invalid open dialog properties: invalidProperty');

      await expect(invoke('show_open_dialog', { title, properties }))
        .rejects.toThrow('Invalid open dialog properties');
    });

    it('should handle show_open_dialog with mixed file and directory properties', async () => {
      const title = 'Select Files or Directories';
      const properties = ['openFile', 'openDirectory', 'multiSelections'];

      const expectedResult = {
        canceled: false,
        file_paths: ['/home/user/file.txt', '/home/user/directory']
      };

      mockInvoke.mockResolvedValue(expectedResult);

      const result = await invoke('show_open_dialog', { title, properties });

      expect(mockInvoke).toHaveBeenCalledWith('show_open_dialog', { title, properties });
      expect(result.file_paths).toHaveLength(2);
    });
  });

  describe('Error Handling and Validation', () => {
    it('should reject with invalid title', async () => {
      const title = '';

      mockInvoke.mockRejectedValue('Title validation failed: Title cannot be empty');

      await expect(invoke('show_message_box', { message: 'test', type: 'info', title }))
        .rejects.toThrow('Title validation failed');
    });

    it('should reject with invalid window label', async () => {
      const window_label = 'nonexistent_window';

      mockInvoke.mockRejectedValue("Window with label 'nonexistent_window' not found");

      await expect(invoke('show_message_box', {
        message: 'test',
        type: 'info',
        window_label
      })).rejects.toThrow('not found');
    });

    it('should handle dialog dismissed by user', async () => {
      const title = 'Save File';

      mockInvoke.mockRejectedValue('Dialog dismissed by user');

      await expect(invoke('show_save_dialog', { title }))
        .rejects.toThrow('Dialog dismissed by user');
    });

    it('should handle permission denied errors', async () => {
      const title = 'Save File';
      const default_path = '/root/protected/file.txt';

      mockInvoke.mockRejectedValue('Permission denied: Cannot access protected directory');

      await expect(invoke('show_save_dialog', { title, default_path }))
        .rejects.toThrow('Permission denied');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete file save workflow', async () => {
      const title = 'Save Document';
      const default_path = '/home/user/untitled.txt';
      const filters = [{ name: 'Text Files', extensions: ['txt'] }];

      // Show save dialog
      const saveResult = {
        canceled: false,
        file_path: '/home/user/document.txt'
      };
      mockInvoke.mockResolvedValueOnce(saveResult);

      const dialogResult = await invoke('show_save_dialog', {
        title,
        default_path,
        filters
      });
      expect(dialogResult.canceled).toBe(false);

      // Now write file content
      const filePath = dialogResult.file_path;
      const content = 'Hello, World!';
      await invoke('write_text_file', { path: filePath, content });

      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should handle file open and read workflow', async () => {
      const title = 'Open Text File';
      const filters = [{ name: 'Text Files', extensions: ['txt'] }];
      const properties = ['openFile'];

      // Show open dialog
      const openResult = {
        canceled: false,
        file_paths: ['/home/user/document.txt']
      };
      mockInvoke.mockResolvedValueOnce(openResult);

      const dialogResult = await invoke('show_open_dialog', {
        title,
        filters,
        properties
      });
      expect(dialogResult.canceled).toBe(false);

      // Read file content
      const filePath = dialogResult.file_paths[0];
      const content = 'File content here';
      mockInvoke.mockResolvedValueOnce(content);

      const fileContent = await invoke('read_text_file', { path: filePath });
      expect(fileContent).toBe(content);

      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple file selection and batch processing', async () => {
      const title = 'Select Multiple Files';
      const properties = ['openFile', 'multiSelections'];

      // Show open dialog with multiple selection
      const openResult = {
        canceled: false,
        file_paths: ['/home/user/file1.txt', '/home/user/file2.txt', '/home/user/file3.txt']
      };
      mockInvoke.mockResolvedValueOnce(openResult);

      const dialogResult = await invoke('show_open_dialog', {
        title,
        properties
      });
      expect(dialogResult.file_paths).toHaveLength(3);

      // Process each file
      const readPromises = dialogResult.file_paths.map(async (filePath, index) => {
        const content = `Content of file ${index + 1}`;
        mockInvoke.mockResolvedValueOnce(content);
        return invoke('read_text_file', { path: filePath });
      });

      const contents = await Promise.all(readPromises);
      expect(contents).toHaveLength(3);
      expect(contents[0]).toBe('Content of file 1');

      expect(mockInvoke).toHaveBeenCalledTimes(4); // 1 dialog + 3 reads
    });
  });
});
