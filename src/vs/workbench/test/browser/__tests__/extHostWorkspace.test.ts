/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ExtHostWorkspace } from '../../../api/common/extHostWorkspace.js';
import { ExtHostWorkspaceImpl } from '../../../api/common/extHostWorkspace.js';
import { MainThreadWorkspaceShape, IWorkspaceData } from '../../../api/common/extHost.protocol.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IExtHostRpcService } from '../../../api/common/extHostRpcService.js';
import { IExtHostInitDataService } from '../../../api/common/extHostInitDataService.js';
import { IExtHostFileSystemInfo } from '../../../api/common/extHostFileSystemInfo.js';
import { IURITransformerService } from '../../../api/common/extHostUriTransformerService.js';
import { URI } from '../../../../base/common/uri.js';

/**
 * Test suite for ExtHostWorkspace
 * Tests the extension host workspace functionality including
 * workspace folder management, file operations, and trust handling.
 */
describe('ExtHostWorkspace', () => {
	let mockRpcService: jest.Mocked<IExtHostRpcService>;
	let mockInitDataService: jest.Mocked<IExtHostInitDataService>;
	let mockFileSystemInfo: jest.Mocked<IExtHostFileSystemInfo>;
	let mockUriTransformerService: jest.Mocked<IURITransformerService>;
	let mockLogService: jest.Mocked<ILogService>;
	let mockProxy: jest.Mocked<MainThreadWorkspaceShape>;
	let workspace: ExtHostWorkspace;

	beforeEach(() => {
		mockRpcService = {
			getProxy: jest.fn().mockReturnValue(mockProxy)
		} as any;

		mockInitDataService = {
			workspace: {
				id: 'test-workspace-id',
				name: 'Test Workspace',
				folders: [],
				configuration: undefined,
				isUntitled: false,
				transient: false
			}
		} as any;

		mockFileSystemInfo = {
			getCapabilities: jest.fn().mockReturnValue(0)
		} as any;

		mockUriTransformerService = {
			transformOutgoingScheme: jest.fn().mockImplementation(scheme => scheme)
		} as any;

		mockLogService = {
			warn: jest.fn(),
			error: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			trace: jest.fn()
		};

		mockProxy = {
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
			$startTextSearch: jest.fn()
		} as any;

		workspace = new ExtHostWorkspace(
			mockRpcService,
			mockInitDataService,
			mockFileSystemInfo,
			mockLogService,
			mockUriTransformerService
		);
	});

	describe('initialization', () => {
		it('should initialize workspace correctly', async () => {
			const workspaceData: IWorkspaceData = {
				id: 'test-id',
				name: 'Test Workspace',
				folders: [{ uri: URI.parse('file:///test').toJSON(), name: 'test', index: 0 }],
				configuration: undefined,
				isUntitled: false,
				transient: false
			};

			workspace.$initializeWorkspace(workspaceData, true);

			expect(await workspace.waitForInitializeCall()).toBe(true);
			expect(workspace.trusted).toBe(true);
		});

		it('should handle workspace trust changes', () => {
			const trustSpy = jest.fn();
			workspace.onDidGrantWorkspaceTrust(trustSpy);

			workspace.$onDidGrantWorkspaceTrust();

			expect(trustSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe('workspace folders', () => {
		beforeEach(() => {
			workspace.$initializeWorkspace({
				id: 'test-id',
				name: 'Test Workspace',
				folders: [
					{ uri: URI.parse('file:///folder1').toJSON(), name: 'Folder1', index: 0 },
					{ uri: URI.parse('file:///folder2').toJSON(), name: 'Folder2', index: 1 }
				],
				configuration: undefined,
				isUntitled: false,
				transient: false
			}, true);
		});

		it('should return workspace folders', () => {
			const folders = workspace.getWorkspaceFolders();
			expect(folders).toHaveLength(2);
			expect(folders?.[0].name).toBe('Folder1');
			expect(folders?.[1].name).toBe('Folder2');
		});

		it('should resolve workspace folder by URI', () => {
			const folder = workspace.resolveWorkspaceFolder(URI.parse('file:///folder1'));
			expect(folder?.name).toBe('Folder1');
		});

		it('should get workspace folder by URI', () => {
			const folder = workspace.getWorkspaceFolder(URI.parse('file:///folder1'));
			expect(folder?.name).toBe('Folder1');
		});

		it('should update workspace folders successfully', () => {
			mockProxy.$updateWorkspaceFolders.mockResolvedValue(undefined);

			const result = workspace.updateWorkspaceFolders(
				{ identifier: { value: 'test-ext' }, displayName: 'Test Extension' } as any,
				1,
				0,
				{ uri: URI.parse('file:///newFolder'), name: 'New Folder' }
			);

			expect(result).toBe(true);
			expect(mockProxy.$updateWorkspaceFolders).toHaveBeenCalledWith(
				'Test Extension',
				1,
				0,
				[{ uri: URI.parse('file:///newFolder'), name: 'New Folder' }]
			);
		});

		it('should reject invalid workspace folder updates', () => {
			const result = workspace.updateWorkspaceFolders(
				{ identifier: { value: 'test-ext' }, displayName: 'Test Extension' } as any,
				-1,
				0,
				{ uri: URI.parse('file:///newFolder'), name: 'New Folder' }
			);

			expect(result).toBe(false);
		});

		it('should handle workspace folder change events', () => {
			const changeSpy = jest.fn();
			workspace.onDidChangeWorkspace(changeSpy);

			const workspaceData: IWorkspaceData = {
				id: 'test-id',
				name: 'Test Workspace',
				folders: [
					{ uri: URI.parse('file:///changed').toJSON(), name: 'Changed', index: 0 }
				],
				configuration: undefined,
				isUntitled: false,
				transient: false
			};

			workspace.$acceptWorkspaceData(workspaceData);

			expect(changeSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					added: expect.any(Array),
					removed: expect.any(Array)
				})
			);
		});
	});

	describe('file operations', () => {
		beforeEach(() => {
			workspace.$initializeWorkspace({
				id: 'test-id',
				name: 'Test Workspace',
				folders: [],
				configuration: undefined,
				isUntitled: false,
				transient: false
			}, true);
		});

		it('should save file', async () => {
			const testUri = URI.parse('file:///test.txt');
			mockProxy.$save.mockResolvedValue(testUri.toJSON());

			const result = await workspace.save(testUri);

			expect(result?.toString()).toBe(testUri.toString());
			expect(mockProxy.$save).toHaveBeenCalledWith(testUri, { saveAs: false });
		});

		it('should save file as', async () => {
			const testUri = URI.parse('file:///test.txt');
			mockProxy.$save.mockResolvedValue(testUri.toJSON());

			const result = await workspace.saveAs(testUri);

			expect(result?.toString()).toBe(testUri.toString());
			expect(mockProxy.$save).toHaveBeenCalledWith(testUri, { saveAs: true });
		});

		it('should save all files', async () => {
			mockProxy.$saveAll.mockResolvedValue(true);

			const result = await workspace.saveAll();

			expect(result).toBe(true);
			expect(mockProxy.$saveAll).toHaveBeenCalledWith(undefined);
		});
	});

	describe('search operations', () => {
		beforeEach(() => {
			workspace.$initializeWorkspace({
				id: 'test-id',
				name: 'Test Workspace',
				folders: [],
				configuration: undefined,
				isUntitled: false,
				transient: false
			}, true);
		});

		it('should find files', async () => {
			const testUri = URI.parse('file:///test.txt');
			mockProxy.$startFileSearch.mockResolvedValue([testUri.toJSON()]);

			const results = await workspace.findFiles('*.txt', undefined, 10, { value: 'test-ext' });

			expect(results).toHaveLength(1);
			expect(results[0].toString()).toBe(testUri.toString());
		});

		it('should handle findFiles cancellation', async () => {
			const cancelToken = { isCancellationRequested: true, onCancellationRequested: jest.fn() };

			const results = await workspace.findFiles('*.txt', undefined, 10, { value: 'test-ext' }, cancelToken);

			expect(results).toHaveLength(0);
		});

		it('should perform text search', async () => {
			const mockResponse = { limitHit: false };
			mockProxy.$startTextSearch.mockResolvedValue(mockResponse);

			const query = { pattern: 'test' };
			const options = { include: '**/*.txt' };
			const callback = jest.fn();

			const result = await workspace.findTextInFiles(query, options, callback, { value: 'test-ext' });

			expect(result.limitHit).toBe(false);
			expect(mockProxy.$startTextSearch).toHaveBeenCalledTimes(1);
		});
	});

	describe('trust operations', () => {
		it('should request workspace trust', async () => {
			mockProxy.$requestWorkspaceTrust.mockResolvedValue(true);

			const result = await workspace.requestWorkspaceTrust();

			expect(result).toBe(true);
			expect(mockProxy.$requestWorkspaceTrust).toHaveBeenCalledWith(undefined);
		});

		it('should handle trust state', () => {
			expect(workspace.trusted).toBe(false);

			workspace.$onDidGrantWorkspaceTrust();

			expect(workspace.trusted).toBe(true);
		});
	});

	describe('edit session identity providers', () => {
		beforeEach(() => {
			workspace.$initializeWorkspace({
				id: 'test-id',
				name: 'Test Workspace',
				folders: [{ uri: URI.parse('file:///test').toJSON(), name: 'test', index: 0 }],
				configuration: undefined,
				isUntitled: false,
				transient: false
			}, true);
		});

		it('should register edit session identity provider', () => {
			const provider = { provideEditSessionIdentity: jest.fn() };

			const disposable = workspace.registerEditSessionIdentityProvider('file', provider);

			expect(disposable).toBeDefined();
			expect(mockProxy.$registerEditSessionIdentityProvider).toHaveBeenCalled();

			disposable.dispose();
			expect(mockProxy.$unregisterEditSessionIdentityProvider).toHaveBeenCalled();
		});

		it('should reject duplicate provider registration', () => {
			const provider1 = { provideEditSessionIdentity: jest.fn() };
			const provider2 = { provideEditSessionIdentity: jest.fn() };

			workspace.registerEditSessionIdentityProvider('file', provider1);

			expect(() => workspace.registerEditSessionIdentityProvider('file', provider2)).toThrow();
		});

		it('should provide edit session identifier', async () => {
			const provider = { provideEditSessionIdentity: jest.fn().mockResolvedValue('test-id') };
			workspace.registerEditSessionIdentityProvider('file', provider);

			const result = await workspace.$getEditSessionIdentifier(URI.parse('file:///test').toJSON(), { isCancellationRequested: false, onCancellationRequested: jest.fn() });

			expect(result).toBe('test-id');
			expect(provider.provideEditSessionIdentity).toHaveBeenCalled();
		});

		it('should handle missing provider gracefully', async () => {
			const result = await workspace.$getEditSessionIdentifier(URI.parse('file:///test').toJSON(), { isCancellationRequested: false, onCancellationRequested: jest.fn() });

			expect(result).toBeUndefined();
		});
	});

	describe('canonical URI providers', () => {
		it('should register canonical URI provider', () => {
			const provider = { provideCanonicalUri: jest.fn() };

			const disposable = workspace.registerCanonicalUriProvider('file', provider);

			expect(disposable).toBeDefined();
			expect(mockProxy.$registerCanonicalUriProvider).toHaveBeenCalled();

			disposable.dispose();
			expect(mockProxy.$unregisterCanonicalUriProvider).toHaveBeenCalled();
		});

		it('should provide canonical URI', async () => {
			const provider = { provideCanonicalUri: jest.fn().mockResolvedValue(URI.parse('file:///canonical')) };
			workspace.registerCanonicalUriProvider('file', provider);

			const result = await workspace.provideCanonicalUri(URI.parse('file:///test'), {}, { isCancellationRequested: false, onCancellationRequested: jest.fn() });

			expect(result?.toString()).toBe('file:///canonical');
		});
	});

	describe('error handling', () => {
		it('should handle file save errors gracefully', async () => {
			mockProxy.$save.mockRejectedValue(new Error('Save failed'));

			await expect(workspace.save(URI.parse('file:///test.txt'))).rejects.toThrow('Save failed');
		});

		it('should handle search operation errors', async () => {
			mockProxy.$startFileSearch.mockRejectedValue(new Error('Search failed'));

			await expect(workspace.findFiles('*.txt', undefined, 10, { value: 'test-ext' })).rejects.toThrow('Search failed');
		});

		it('should handle malformed workspace data', () => {
			expect(() => workspace.$acceptWorkspaceData(null as any)).not.toThrow();
		});
	});
});

describe('ExtHostWorkspaceImpl', () => {
	let mockFileSystemInfo: jest.Mocked<IExtHostFileSystemInfo>;

	beforeEach(() => {
		mockFileSystemInfo = {
			getCapabilities: jest.fn().mockReturnValue(0)
		};
	});

	it('should create workspace from data correctly', () => {
		const data: IWorkspaceData = {
			id: 'test-id',
			name: 'Test Workspace',
			folders: [
				{ uri: URI.parse('file:///folder1').toJSON(), name: 'Folder1', index: 0 },
				{ uri: URI.parse('file:///folder2').toJSON(), name: 'Folder2', index: 1 }
			],
			configuration: URI.parse('file:///config.json').toJSON(),
			isUntitled: false,
			transient: false
		};

		const result = ExtHostWorkspaceImpl.toExtHostWorkspace(data, undefined, undefined, mockFileSystemInfo);

		expect(result.workspace?.name).toBe('Test Workspace');
		expect(result.workspace?.workspaceFolders).toHaveLength(2);
		expect(result.added).toHaveLength(2);
		expect(result.removed).toHaveLength(0);
	});

	it('should handle workspace folder operations', () => {
		const folders = [
			{ uri: URI.parse('file:///test'), name: 'Test', index: 0 }
		];

		const workspace = new ExtHostWorkspaceImpl('id', 'name', folders, false, undefined, false, () => false);

		const foundFolder = workspace.getWorkspaceFolder(URI.parse('file:///test'));
		expect(foundFolder?.name).toBe('Test');

		const resolvedFolder = workspace.resolveWorkspaceFolder(URI.parse('file:///test'));
		expect(resolvedFolder?.name).toBe('Test');
	});

	it('should handle empty workspace', () => {
		const workspace = new ExtHostWorkspaceImpl('id', 'name', [], false, undefined, false, () => false);

		expect(workspace.workspaceFolders).toHaveLength(0);
		expect(workspace.getWorkspaceFolder(URI.parse('file:///test'))).toBeUndefined();
	});
});