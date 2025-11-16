/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ExtHostWorkspace } from '../../../api/common/extHostWorkspace.js';
import { ExtHostConfiguration } from '../../../api/common/extHostConfiguration.js';
import { MainThreadWorkspaceShape, MainThreadConfigurationShape, IWorkspaceData } from '../../../api/common/extHost.protocol.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IExtHostRpcService } from '../../../api/common/extHostRpcService.js';
import { IExtHostInitDataService } from '../../../api/common/extHostInitDataService.js';
import { IExtHostFileSystemInfo } from '../../../api/common/extHostFileSystemInfo.js';
import { IURITransformerService } from '../../../api/common/extHostUriTransformerService.js';
import { URI } from '../../../../base/common/uri.js';

/**
 * Integration test suite for ExtHostWorkspace
 * Tests the integration between workspace and configuration services
 * including workspace operations, configuration interactions, and cross-service dependencies.
 */
describe('ExtHostWorkspace - Integration Tests', () => {
	let mockRpcService: jest.Mocked<IExtHostRpcService>;
	let mockInitDataService: jest.Mocked<IExtHostInitDataService>;
	let mockFileSystemInfo: jest.Mocked<IExtHostFileSystemInfo>;
	let mockUriTransformerService: jest.Mocked<IURITransformerService>;
	let mockLogService: jest.Mocked<ILogService>;
	let mockMainThreadWorkspace: jest.Mocked<MainThreadWorkspaceShape>;
	let mockMainThreadConfig: jest.Mocked<MainThreadConfigurationShape>;
	let workspace: ExtHostWorkspace;
	let configuration: ExtHostConfiguration;

	beforeEach(() => {
		mockRpcService = {
			getProxy: jest.fn().mockImplementation((context) => {
				if (context === 'MainContext.MainThreadWorkspace') {return mockMainThreadWorkspace;}
				if (context === 'MainContext.MainThreadConfiguration') {return mockMainThreadConfig;}
				return {};
			})
		} as any;

		mockInitDataService = {
			workspace: {
				id: 'test-workspace-id',
				name: 'Test Workspace',
				folders: [],
				configuration: undefined,
				isUntitled: false,
				transient: false
			},
			remote: {
				isRemote: false,
				authority: undefined,
				connectionData: null
			},
			environment: {
				extensionTestsLocationURI: undefined,
				extensionDevelopmentLocationURI: undefined
			},
			logsLocation: URI.parse('file:///logs')
		} as any;

		mockFileSystemInfo = {
			getCapabilities: jest.fn().mockReturnValue(0)
		};

		mockUriTransformerService = {
			transformOutgoingScheme: jest.fn().mockImplementation(scheme => scheme)
		};

		mockLogService = {
			warn: jest.fn(),
			error: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			trace: jest.fn()
		};

		mockMainThreadWorkspace = {
			$updateWorkspaceFolders: jest.fn(),
			$save: jest.fn(),
			$saveAll: jest.fn(),
			$resolveProxy: jest.fn(),
			$lookupAuthorization: jest.fn(),
			$lookupKerberosAuthorization: jest.fn(),
			$loadCertificates: jest.fn(),
			$requestWorkspaceTrust: jest.fn(),
			$registerEditSessionIdentityProvider: jest.fn(),
			$unregisterEditSessionIdentityProvider: jest.fn(),
			$registerCanonicalUriProvider: jest.fn(),
			$unregisterCanonicalUriProvider: jest.fn(),
			$resolveDecoding: jest.fn(),
			$validateDetectedEncoding: jest.fn(),
			$resolveEncoding: jest.fn(),
			$startFileSearch: jest.fn(),
			$startTextSearch: jest.fn(),
			$checkExists: jest.fn()
		};

		mockMainThreadConfig = {
			$updateConfigurationOption: jest.fn(),
			$removeConfigurationOption: jest.fn()
		};

		workspace = new ExtHostWorkspace(
			mockRpcService,
			mockInitDataService,
			mockFileSystemInfo,
			mockLogService,
			mockUriTransformerService
		);

		configuration = new ExtHostConfiguration(
			mockRpcService,
			workspace,
			mockLogService
		);
	});

	describe('workspace and configuration integration', () => {
		beforeEach(() => {
			const workspaceData: IWorkspaceData = {
				id: 'integration-test-workspace',
				name: 'Integration Test Workspace',
				folders: [
					{ uri: URI.parse('file:///project/src').toJSON(), name: 'src', index: 0 },
					{ uri: URI.parse('file:///project/test').toJSON(), name: 'test', index: 1 }
				],
				configuration: URI.parse('file:///project/.vscode/settings.json').toJSON(),
				isUntitled: false,
				transient: false
			};

			const configInitData = {
				configurationScopes: [['editor.tabSize', undefined], ['typescript.preferences.includePackageJsonAutoImports', 'resource']],
				configuration: {
					contents: {
						editor: {
							tabSize: 4,
							insertSpaces: true
						},
						typescript: {
							preferences: {
								includePackageJsonAutoImports: 'auto'
							}
						}
					},
					keys: ['editor.tabSize', 'editor.insertSpaces', 'typescript.preferences.includePackageJsonAutoImports'],
					overrides: []
				}
			};

			workspace.$initializeWorkspace(workspaceData, true);
			configuration.$initializeConfiguration(configInitData);
		});

		it('should integrate workspace folders with configuration scopes', async () => {
			const folders = workspace.getWorkspaceFolders();
			expect(folders).toHaveLength(2);

			const configProvider = await configuration.getConfigProvider();

			// Test resource-scoped configuration
			const srcUri = URI.parse('file:///project/src/main.ts');
			const configWithResource = configProvider.getConfiguration('typescript.preferences', { uri: srcUri });

			expect(configWithResource.get('includePackageJsonAutoImports')).toBe('auto');
		});

		it('should handle workspace configuration updates affecting file operations', async () => {
			mockMainThreadWorkspace.$save.mockResolvedValue(URI.parse('file:///project/src/main.ts').toJSON());

			const result = await workspace.save(URI.parse('file:///project/src/main.ts'));
			expect(result?.toString()).toBe('file:///project/src/main.ts');

			// Configuration should not interfere with basic file operations
			expect(mockMainThreadWorkspace.$save).toHaveBeenCalledWith(
				URI.parse('file:///project/src/main.ts'),
				{ saveAs: false }
			);
		});

		it('should coordinate workspace folder changes with configuration', async () => {
			mockMainThreadWorkspace.$updateWorkspaceFolders.mockResolvedValue(undefined);

			const success = workspace.updateWorkspaceFolders(
				{ identifier: { value: 'test-ext' }, displayName: 'Test Extension' } as any,
				2,
				0,
				{ uri: URI.parse('file:///project/docs'), name: 'docs' }
			);

			expect(success).toBe(true);

			// Verify workspace folders are updated
			const foldersAfter = workspace.getWorkspaceFolders();
			expect(foldersAfter).toHaveLength(3); // 2 original + 1 added (unconfirmed)
		});

		it('should handle configuration changes across workspace folders', async () => {
			const configProvider = await configuration.getConfigProvider();

			// Test global configuration
			const globalConfig = configProvider.getConfiguration('editor');
			expect(globalConfig.get('tabSize')).toBe(4);
			expect(globalConfig.get('insertSpaces')).toBe(true);

			// Test resource-specific configuration
			const testUri = URI.parse('file:///project/test/utils.ts');
			const resourceConfig = configProvider.getConfiguration('typescript.preferences', { uri: testUri });
			expect(resourceConfig.get('includePackageJsonAutoImports')).toBe('auto');
		});
	});

	describe('search operations with workspace and configuration', () => {
		beforeEach(() => {
			workspace.$initializeWorkspace({
				id: 'search-test-workspace',
				name: 'Search Test Workspace',
				folders: [
					{ uri: URI.parse('file:///search/src').toJSON(), name: 'src', index: 0 }
				],
				configuration: undefined,
				isUntitled: false,
				transient: false
			}, true);

			configuration.$initializeConfiguration({
				configurationScopes: [['search.exclude', undefined]],
				configuration: {
					contents: {
						search: {
							exclude: {
								'**/node_modules': true,
								'**/dist': true
							}
						}
					},
					keys: ['search.exclude'],
					overrides: []
				}
			});
		});

		it('should integrate search operations with workspace folders', async () => {
			const testUris = [
				URI.parse('file:///search/src/main.ts'),
				URI.parse('file:///search/src/utils.ts')
			];

			mockMainThreadWorkspace.$startFileSearch.mockResolvedValue(testUris.map(u => u.toJSON()));

			const results = await workspace.findFiles('*.ts', undefined, 10, { value: 'search-ext' });

			expect(results).toHaveLength(2);
			expect(results[0].toString()).toBe(testUris[0].toString());
			expect(results[1].toString()).toBe(testUris[1].toString());
		});

		it('should handle search with workspace-relative paths', async () => {
			const workspaceFolder = workspace.getWorkspaceFolder(URI.parse('file:///search/src/main.ts'));
			expect(workspaceFolder?.name).toBe('src');

			const relativePath = workspace.getRelativePath('file:///search/src/main.ts');
			expect(relativePath).toBe('src/main.ts');
		});
	});

	describe('workspace trust and configuration integration', () => {
		it('should handle trusted workspace configuration', async () => {
			workspace.$initializeWorkspace({
				id: 'trusted-workspace',
				name: 'Trusted Workspace',
				folders: [],
				configuration: undefined,
				isUntitled: false,
				transient: false
			}, true);

			expect(workspace.trusted).toBe(true);

			configuration.$initializeConfiguration({
				configurationScopes: [['security.workspace.trust.enabled', undefined]],
				configuration: {
					contents: {
						security: {
							workspace: {
								trust: {
									enabled: true
								}
							}
						}
					},
					keys: ['security.workspace.trust.enabled'],
					overrides: []
				}
			});

			const configProvider = await configuration.getConfigProvider();
			const trustConfig = configProvider.getConfiguration('security.workspace.trust');
			expect(trustConfig.get('enabled')).toBe(true);
		});

		it('should handle workspace trust changes', async () => {
			mockMainThreadWorkspace.$requestWorkspaceTrust.mockResolvedValue(true);

			const trustResult = await workspace.requestWorkspaceTrust();
			expect(trustResult).toBe(true);

			// Simulate trust change event
			workspace.$onDidGrantWorkspaceTrust();
			expect(workspace.trusted).toBe(true);
		});
	});

	describe('error handling and recovery', () => {
		it('should handle workspace operations when configuration is unavailable', async () => {
			const folders = workspace.getWorkspaceFolders();
			expect(folders).toBeUndefined();

			const configProvider = await configuration.getConfigProvider().catch(() => null);
			expect(configProvider).toBeNull();
		});

		it('should recover from workspace folder operation failures', async () => {
			mockMainThreadWorkspace.$updateWorkspaceFolders.mockRejectedValue(new Error('Folder update failed'));

			// This should complete despite the mock rejection
			const success = workspace.updateWorkspaceFolders(
				{ identifier: { value: 'test-ext' }, displayName: 'Test Extension' } as any,
				0,
				0,
				{ uri: URI.parse('file:///test'), name: 'test' }
			);

			expect(success).toBe(true);
		});

		it('should handle configuration updates during workspace changes', async () => {
			const configProvider = await configuration.getConfigProvider();

			// Simulate concurrent workspace and configuration changes
			const workspaceChangePromise = new Promise<void>((resolve) => {
				workspace.onDidChangeWorkspace(() => resolve());
			});

			const configChangePromise = new Promise<void>((resolve) => {
				configProvider.onDidChangeConfiguration(() => resolve());
			});

			// Trigger workspace change
			workspace.$acceptWorkspaceData({
				id: 'changed-workspace',
				name: 'Changed Workspace',
				folders: [],
				configuration: undefined,
				isUntitled: false,
				transient: false
			});

			// Trigger configuration change
			configuration.$acceptConfigurationChanged({
				configurationScopes: [],
				configuration: {
					contents: { testKey: 'changedValue' },
					keys: ['testKey'],
					overrides: []
				}
			}, { keys: ['testKey'], overrides: [] });

			await Promise.all([workspaceChangePromise, configChangePromise]);
		});
	});

	describe('performance and scalability', () => {
		it('should handle workspaces with many folders efficiently', () => {
			const manyFolders = Array.from({ length: 50 }, (_, i) => ({
				uri: URI.parse(`file:///workspace/folder${i}`).toJSON(),
				name: `folder${i}`,
				index: i
			}));

			workspace.$initializeWorkspace({
				id: 'large-workspace',
				name: 'Large Workspace',
				folders: manyFolders,
				configuration: undefined,
				isUntitled: false,
				transient: false
			}, true);

			const folders = workspace.getWorkspaceFolders();
			expect(folders).toHaveLength(50);

			// Test folder lookup performance
			const middleFolder = workspace.getWorkspaceFolder(URI.parse('file:///workspace/folder25'));
			expect(middleFolder?.name).toBe('folder25');
		});

		it('should handle bulk configuration operations', async () => {
			const configProvider = await configuration.getConfigProvider();

			// Create bulk configuration updates
			const bulkUpdates = Array.from({ length: 20 }, (_, i) => {
				const config = configProvider.getConfiguration(`section${i}`);
				return config.update('key', `value${i}`, true);
			});

			await Promise.all(bulkUpdates);

			expect(mockMainThreadConfig.$updateConfigurationOption).toHaveBeenCalledTimes(20);
		});
	});
});