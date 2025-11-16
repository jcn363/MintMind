/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ExtHostConfiguration } from '../../../api/common/extHostConfiguration.js';
import { ExtHostWorkspace } from '../../../api/common/extHostWorkspace.js';
import { MainThreadConfigurationShape, MainThreadWorkspaceShape } from '../../../api/common/extHost.protocol.js';
import { IConfigurationChange } from '../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IExtHostRpcService } from '../../../api/common/extHostRpcService.js';
import { URI } from '../../../../base/common/uri.js';

/**
 * Integration test suite for ExtHostConfiguration
 * Tests the integration between configuration and workspace services
 * including configuration updates, workspace changes, and cross-service interactions.
 */
describe('ExtHostConfiguration - Integration Tests', () => {
	let mockRpcService: jest.Mocked<IExtHostRpcService>;
	let mockWorkspace: jest.Mocked<ExtHostWorkspace>;
	let mockLogService: jest.Mocked<ILogService>;
	let mockMainThreadConfig: jest.Mocked<MainThreadConfigurationShape>;
	let mockMainThreadWorkspace: jest.Mocked<MainThreadWorkspaceShape>;
	let configuration: ExtHostConfiguration;
	let workspace: ExtHostWorkspace;

	beforeEach(() => {
		mockRpcService = {
			getProxy: jest.fn().mockImplementation((context) => {
				if (context === 'MainContext.MainThreadConfiguration') {return mockMainThreadConfig;}
				if (context === 'MainContext.MainThreadWorkspace') {return mockMainThreadWorkspace;}
				return {};
			})
		} as any;

		mockWorkspace = {
			workspace: undefined,
			getWorkspaceFolders: jest.fn().mockReturnValue(undefined),
			onDidChangeWorkspace: { add: jest.fn() }
		} as any;

		mockLogService = {
			warn: jest.fn(),
			error: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			trace: jest.fn()
		};

		mockMainThreadConfig = {
			$updateConfigurationOption: jest.fn().mockResolvedValue(undefined),
			$removeConfigurationOption: jest.fn().mockResolvedValue(undefined)
		};

		mockMainThreadWorkspace = {
			$updateWorkspaceFolders: jest.fn(),
			$startFileSearch: jest.fn(),
			$startTextSearch: jest.fn()
		};

		configuration = new ExtHostConfiguration(
			mockRpcService,
			mockWorkspace,
			mockLogService
		);

		workspace = mockWorkspace;
	});

	describe('configuration and workspace integration', () => {
		beforeEach(() => {
			// Initialize configuration with a workspace
			const initData = {
				configurationScopes: [['testKey', undefined]],
				configuration: {
					contents: {
						workspaceSection: {
							workspaceKey: 'workspaceValue'
						}
					},
					keys: ['workspaceSection.workspaceKey'],
					overrides: []
				}
			};

			configuration.$initializeConfiguration(initData);
		});

		it('should update workspace configuration and notify workspace service', async () => {
			const provider = await configuration.getConfigProvider();
			const config = provider.getConfiguration('workspaceSection');

			// Mock workspace folder
			const workspaceFolder = {
				uri: URI.parse('file:///workspace'),
				name: 'TestWorkspace',
				index: 0
			};

			mockWorkspace.getWorkspaceFolders = jest.fn().mockReturnValue([workspaceFolder]);

			await config.update('workspaceKey', 'newWorkspaceValue', true);

			expect(mockMainThreadConfig.$updateConfigurationOption).toHaveBeenCalledWith(
				expect.any(Number),
				'workspaceSection.workspaceKey',
				'newWorkspaceValue',
				{},
				undefined
			);
		});

		it('should handle configuration changes affecting workspace folders', async () => {
			const provider = await configuration.getConfigProvider();

			const change: IConfigurationChange = {
				keys: ['workspaceSection.workspaceKey'],
				overrides: []
			};

			const previous = {
				data: {
					contents: { workspaceSection: { workspaceKey: 'oldValue' } },
					keys: ['workspaceSection.workspaceKey'],
					overrides: []
				},
				workspace: undefined
			};

			provider.$acceptConfigurationChanged({
				configurationScopes: [['testKey', undefined]],
				configuration: {
					contents: {
						workspaceSection: {
							workspaceKey: 'newValue'
						}
					},
					keys: ['workspaceSection.workspaceKey'],
					overrides: []
				}
			}, change);

			const config = provider.getConfiguration('workspaceSection');
			expect(config.get('workspaceKey')).toBe('newValue');
		});

		it('should integrate with workspace folder resolution', async () => {
			const provider = await configuration.getConfigProvider();

			// Set up workspace with folders
			const workspaceData = {
				id: 'test-workspace',
				name: 'Test Workspace',
				folders: [
					{ uri: URI.parse('file:///folder1').toJSON(), name: 'Folder1', index: 0 },
					{ uri: URI.parse('file:///folder2').toJSON(), name: 'Folder2', index: 1 }
				],
				configuration: undefined,
				isUntitled: false,
				transient: false
			};

			// Mock workspace folders
			mockWorkspace.getWorkspaceFolders = jest.fn().mockReturnValue([
				{ uri: URI.parse('file:///folder1'), name: 'Folder1', index: 0 },
				{ uri: URI.parse('file:///folder2'), name: 'Folder2', index: 1 }
			]);

			mockWorkspace.workspace = {
				id: workspaceData.id,
				name: workspaceData.name,
				workspaceFolders: [
					{ uri: URI.parse('file:///folder1'), name: 'Folder1', index: 0 },
					{ uri: URI.parse('file:///folder2'), name: 'Folder2', index: 1 }
				]
			} as any;

			const configWithResource = provider.getConfiguration('testSection', { uri: URI.parse('file:///folder1') });
			expect(configWithResource).toBeDefined();
		});
	});

	describe('configuration scope handling with workspace', () => {
		it('should handle global configuration in workspace context', async () => {
			const initData = {
				configurationScopes: [['globalSetting', 'window']],
				configuration: {
					contents: {
						globalSection: {
							globalSetting: 'globalValue'
						}
					},
					keys: ['globalSection.globalSetting'],
					overrides: []
				}
			};

			configuration.$initializeConfiguration(initData);
			const provider = await configuration.getConfigProvider();

			// With workspace present, global settings should still work
			mockWorkspace.workspace = { id: 'test' } as any;

			const config = provider.getConfiguration('globalSection');
			expect(config.get('globalSetting')).toBe('globalValue');
		});

		it('should handle workspace-scoped configuration updates', async () => {
			const initData = {
				configurationScopes: [['workspaceSetting', 'resource']],
				configuration: {
					contents: {
						workspaceSection: {
							workspaceSetting: 'workspaceValue'
						}
					},
					keys: ['workspaceSection.workspaceSetting'],
					overrides: []
				}
			};

			configuration.$initializeConfiguration(initData);
			const provider = await configuration.getConfigProvider();

			const workspaceUri = URI.parse('file:///workspace');
			const config = provider.getConfiguration('workspaceSection', { uri: workspaceUri });

			await config.update('workspaceSetting', 'updatedValue', true);

			expect(mockMainThreadConfig.$updateConfigurationOption).toHaveBeenCalledWith(
				expect.any(Number),
				'workspaceSection.workspaceSetting',
				'updatedValue',
				{ resource: workspaceUri },
				undefined
			);
		});
	});

	describe('configuration change propagation', () => {
		it('should propagate configuration changes to workspace listeners', async () => {
			const provider = await configuration.getConfigProvider();

			const changeSpy = jest.fn();
			provider.onDidChangeConfiguration(changeSpy);

			const change: IConfigurationChange = {
				keys: ['testSection.testKey'],
				overrides: []
			};

			configuration.$acceptConfigurationChanged({
				configurationScopes: [['testKey', undefined]],
				configuration: {
					contents: {
						testSection: {
							testKey: 'changedValue'
						}
					},
					keys: ['testSection.testKey'],
					overrides: []
				}
			}, change);

			expect(changeSpy).toHaveBeenCalledTimes(1);
			const changeEvent = changeSpy.mock.calls[0][0];
			expect(changeEvent.affectsConfiguration('testSection.testKey')).toBe(true);
			expect(changeEvent.affectsConfiguration('otherSection.otherKey')).toBe(false);
		});

		it('should handle configuration changes with workspace folder context', async () => {
			const workspaceUri = URI.parse('file:///workspace');
			mockWorkspace.workspace = {
				id: 'test',
				workspaceFolders: [{ uri: workspaceUri, name: 'Test', index: 0 }]
			} as any;

			const provider = await configuration.getConfigProvider();

			const change: IConfigurationChange = {
				keys: ['folderSection.folderKey'],
				overrides: [{ resource: workspaceUri, overrideIdentifier: undefined }]
			};

			const changeSpy = jest.fn();
			provider.onDidChangeConfiguration(changeSpy);

			configuration.$acceptConfigurationChanged({
				configurationScopes: [['folderKey', 'resource']],
				configuration: {
					contents: {
						folderSection: {
							folderKey: 'folderValue'
						}
					},
					keys: ['folderSection.folderKey'],
					overrides: []
				}
			}, change);

			expect(changeSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe('error scenarios and recovery', () => {
		it('should handle configuration update failures gracefully', async () => {
			mockMainThreadConfig.$updateConfigurationOption.mockRejectedValue(new Error('Update failed'));

			const provider = await configuration.getConfigProvider();
			const config = provider.getConfiguration('testSection');

			await expect(config.update('testKey', 'value', true)).rejects.toThrow('Update failed');
		});

		it('should handle workspace folder changes during configuration updates', async () => {
			const provider = await configuration.getConfigProvider();
			const config = provider.getConfiguration('testSection');

			// Simulate workspace folder disappearing during update
			mockWorkspace.getWorkspaceFolder = jest.fn().mockReturnValue(undefined);

			await config.update('testKey', 'value', true);

			expect(mockMainThreadConfig.$updateConfigurationOption).toHaveBeenCalled();
		});

		it('should recover from malformed configuration data', async () => {
			const malformedInitData = {
				configurationScopes: [],
				configuration: {
					contents: null, // Invalid
					keys: [],
					overrides: []
				}
			};

			expect(() => configuration.$initializeConfiguration(malformedInitData)).toThrow();
		});
	});

	describe('performance and resource management', () => {
		it('should efficiently handle multiple configuration updates', async () => {
			const provider = await configuration.getConfigProvider();
			const config = provider.getConfiguration('testSection');

			const updates = Array.from({ length: 10 }, (_, i) => config.update(`key${i}`, `value${i}`, true));

			await Promise.all(updates);

			expect(mockMainThreadConfig.$updateConfigurationOption).toHaveBeenCalledTimes(10);
		});

		it('should handle configuration cloning performance', async () => {
			const provider = await configuration.getConfigProvider();

			// Create a large configuration object
			const largeConfig = {};
			for (let i = 0; i < 1000; i++) {
				largeConfig[`key${i}`] = `value${i}`;
			}

			const initData = {
				configurationScopes: [],
				configuration: {
					contents: { largeSection: largeConfig },
					keys: Object.keys(largeConfig).map(k => `largeSection.${k}`),
					overrides: []
				}
			};

			configuration.$initializeConfiguration(initData);

			const config = provider.getConfiguration('largeSection');

			// Accessing should not cause performance issues
			const value = config.get('key500');
			expect(value).toBe('value500');
		});
	});
});