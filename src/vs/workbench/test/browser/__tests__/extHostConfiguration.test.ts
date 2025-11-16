/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ExtHostConfiguration, ExtHostConfigProvider } from '../../../api/common/extHostConfiguration.js';
import { ExtHostWorkspace } from '../../../api/common/extHostWorkspace.js';
import { MainThreadConfigurationShape, IConfigurationInitData } from '../../../api/common/extHost.protocol.js';
import { IConfigurationChange } from '../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IExtHostRpcService } from '../../../api/common/extHostRpcService.js';
import { URI } from '../../../../base/common/uri.js';

/**
 * Test suite for ExtHostConfiguration
 * Tests the extension host configuration service functionality
 * including configuration retrieval, updates, and event handling.
 */
describe('ExtHostConfiguration', () => {
	let mockRpcService: jest.Mocked<IExtHostRpcService>;
	let mockWorkspace: jest.Mocked<ExtHostWorkspace>;
	let mockLogService: jest.Mocked<ILogService>;
	let mockProxy: jest.Mocked<MainThreadConfigurationShape>;
	let configuration: ExtHostConfiguration;

	beforeEach(() => {
		mockRpcService = {
			getProxy: jest.fn().mockReturnValue(mockProxy)
		} as any;

		mockWorkspace = {
			workspace: undefined
		} as any;

		mockLogService = {
			warn: jest.fn(),
			error: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			trace: jest.fn()
		};

		mockProxy = {
			$updateConfigurationOption: jest.fn(),
			$removeConfigurationOption: jest.fn()
		} as any;

		configuration = new ExtHostConfiguration(
			mockRpcService,
			mockWorkspace,
			mockLogService
		);
	});

	describe('initialization', () => {
		it('should initialize configuration provider', async () => {
			const initData: IConfigurationInitData = {
				configurationScopes: [],
				configuration: {
					contents: {},
					keys: [],
					overrides: []
				}
			};

			configuration.$initializeConfiguration(initData);

			const provider = await configuration.getConfigProvider();
			expect(provider).toBeInstanceOf(ExtHostConfigProvider);
		});

		it('should reject getConfigProvider before initialization', async () => {
			await expect(configuration.getConfigProvider()).rejects.toThrow();
		});
	});

	describe('configuration changes', () => {
		let initData: IConfigurationInitData;
		let change: IConfigurationChange;

		beforeEach(() => {
			initData = {
				configurationScopes: [],
				configuration: {
					contents: {},
					keys: [],
					overrides: []
				}
			};

			change = {
				keys: [],
				overrides: []
			};

			configuration.$initializeConfiguration(initData);
		});

		it('should accept configuration changes', async () => {
			const provider = await configuration.getConfigProvider();
			const onDidChangeSpy = jest.fn();
			provider.onDidChangeConfiguration(onDidChangeSpy);

			configuration.$acceptConfigurationChanged(initData, change);

			expect(onDidChangeSpy).toHaveBeenCalledTimes(1);
		});
	});
});

describe('ExtHostConfigProvider', () => {
	let mockProxy: jest.Mocked<MainThreadConfigurationShape>;
	let mockWorkspace: jest.Mocked<ExtHostWorkspace>;
	let mockLogService: jest.Mocked<ILogService>;
	let initData: IConfigurationInitData;
	let provider: ExtHostConfigProvider;

	beforeEach(() => {
		mockProxy = {
			$updateConfigurationOption: jest.fn().mockResolvedValue(undefined),
			$removeConfigurationOption: jest.fn().mockResolvedValue(undefined)
		};

		mockWorkspace = {
			workspace: undefined
		} as any;

		mockLogService = {
			warn: jest.fn(),
			error: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			trace: jest.fn()
		};

		initData = {
			configurationScopes: [['testKey', undefined]],
			configuration: {
				contents: {
					testSection: {
						testKey: 'testValue'
					}
				},
				keys: ['testSection.testKey'],
				overrides: []
			}
		};

		provider = new ExtHostConfigProvider(mockProxy, mockWorkspace, initData, mockLogService);
	});

	describe('getConfiguration', () => {
		it('should return configuration for section', () => {
			const config = provider.getConfiguration('testSection');

			expect(config.has('testKey')).toBe(true);
			expect(config.get('testKey')).toBe('testValue');
		});

		it('should return undefined for non-existent key', () => {
			const config = provider.getConfiguration('testSection');

			expect(config.has('nonExistentKey')).toBe(false);
			expect(config.get('nonExistentKey')).toBeUndefined();
		});

		it('should return default value for non-existent key', () => {
			const config = provider.getConfiguration('testSection');

			expect(config.get('nonExistentKey', 'defaultValue')).toBe('defaultValue');
		});

		it('should update configuration option', async () => {
			const config = provider.getConfiguration('testSection');

			await config.update('testKey', 'newValue', true);

			expect(mockProxy.$updateConfigurationOption).toHaveBeenCalledWith(
				expect.any(Number),
				'testSection.testKey',
				'newValue',
				{},
				undefined
			);
		});

		it('should remove configuration option when value is undefined', async () => {
			const config = provider.getConfiguration('testSection');

			await config.update('testKey', undefined, true);

			expect(mockProxy.$removeConfigurationOption).toHaveBeenCalledWith(
				expect.any(Number),
				'testSection.testKey',
				{},
				undefined
			);
		});

		it('should inspect configuration values', () => {
			const config = provider.getConfiguration('testSection');
			const inspect = config.inspect('testKey');

			expect(inspect).toBeDefined();
			expect(inspect?.key).toBe('testSection.testKey');
		});

		it('should handle configuration scopes correctly', () => {
			const resourceUri = URI.parse('file:///test.txt');
			const config = provider.getConfiguration('testSection', { uri: resourceUri });

			expect(config).toBeDefined();
		});

		it('should validate configuration access for resource scope', () => {
			const config = provider.getConfiguration('testSection');

			// This should trigger a warning for accessing resource-scoped config without resource
			config.get('testKey');

			expect(mockLogService.warn).toHaveBeenCalledWith(
				expect.stringContaining('Accessing a resource scoped configuration')
			);
		});

		it('should handle configuration change events', () => {
			const change: IConfigurationChange = {
				keys: ['testSection.testKey'],
				overrides: []
			};

			const previous = {
				data: initData.configuration,
				workspace: undefined
			};

			const event = provider['_toConfigurationChangeEvent'](change, previous);
			expect(event).toBeDefined();
			expect(typeof event.affectsConfiguration).toBe('function');
		});
	});

	describe('error handling', () => {
		it('should handle invalid configuration updates gracefully', async () => {
			mockProxy.$updateConfigurationOption.mockRejectedValue(new Error('Update failed'));

			const config = provider.getConfiguration('testSection');

			await expect(config.update('testKey', 'value', true)).rejects.toThrow('Update failed');
		});

		it('should handle malformed configuration data', () => {
			const malformedInitData: IConfigurationInitData = {
				configurationScopes: [],
				configuration: {
					contents: null as any, // Invalid contents
					keys: [],
					overrides: []
				}
			};

			expect(() => new ExtHostConfigProvider(mockProxy, mockWorkspace, malformedInitData, mockLogService)).toThrow();
		});
	});
});