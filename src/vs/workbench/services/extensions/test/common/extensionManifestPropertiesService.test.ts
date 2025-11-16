/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { isWeb } from '../../../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ExtensionUntrustedWorkspaceSupportType, IExtensionManifest } from '../../../../../platform/extensions/common/extensions.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IWorkspaceTrustEnablementService } from '../../../../../platform/workspace/common/workspaceTrust.js';
import { ExtensionManifestPropertiesService } from '../../common/extensionManifestPropertiesService.js';
import { TestProductService, TestWorkspaceTrustEnablementService } from '../../../../test/common/workbenchTestServices.js';

describe('ExtensionManifestPropertiesService - ExtensionKind', () => {

	let disposables: DisposableStore;
	let testObject: ExtensionManifestPropertiesService;

	beforeEach(() => {
		disposables = new DisposableStore();
		testObject = disposables.add(new ExtensionManifestPropertiesService(TestProductService, new TestConfigurationService(), new TestWorkspaceTrustEnablementService(), new NullLogService()));
	});

	afterEach(() => {
		disposables.dispose();
	});

	ensureNoDisposablesAreLeakedInTestSuite();

	it('declarative with extension dependencies', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ extensionDependencies: ['ext1'] }), isWeb ? ['workspace', 'web'] : ['workspace']);
	});

	it('declarative extension pack', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ extensionPack: ['ext1', 'ext2'] }), isWeb ? ['workspace', 'web'] : ['workspace']);
	});

	it('declarative extension pack and extension dependencies', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ extensionPack: ['ext1', 'ext2'], extensionDependencies: ['ext1', 'ext2'] }), isWeb ? ['workspace', 'web'] : ['workspace']);
	});

	it('declarative with unknown contribution point => workspace, web in web and => workspace in desktop', () => {
		// eslint-disable-next-line local/code-no-any-casts
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ contributes: <any>{ 'unknownPoint': { something: true } } }), isWeb ? ['workspace', 'web'] : ['workspace']);
	});

	it('declarative extension pack with unknown contribution point', () => {
		// eslint-disable-next-line local/code-no-any-casts
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ extensionPack: ['ext1', 'ext2'], contributes: <any>{ 'unknownPoint': { something: true } } }), isWeb ? ['workspace', 'web'] : ['workspace']);
	});

	it('simple declarative => ui, workspace, web', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{}), ['ui', 'workspace', 'web']);
	});

	it('only browser => web', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ browser: 'main.browser.js' }), ['web']);
	});

	it('only main => workspace', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ main: 'main.js' }), ['workspace']);
	});

	it('main and browser => workspace, web in web and workspace in desktop', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ main: 'main.js', browser: 'main.browser.js' }), isWeb ? ['workspace', 'web'] : ['workspace']);
	});

	it('browser entry point with workspace extensionKind => workspace, web in web and workspace in desktop', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ main: 'main.js', browser: 'main.browser.js', extensionKind: ['workspace'] }), isWeb ? ['workspace', 'web'] : ['workspace']);
	});

	it('only browser entry point with out extensionKind => web', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ browser: 'main.browser.js' }), ['web']);
	});

	it('simple descriptive with workspace, ui extensionKind => workspace, ui, web in web and workspace, ui in desktop', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ extensionKind: ['workspace', 'ui'] }), isWeb ? ['workspace', 'ui', 'web'] : ['workspace', 'ui']);
	});

	it('opt out from web through settings even if it can run in web', () => {
		testObject = disposables.add(new ExtensionManifestPropertiesService(TestProductService, new TestConfigurationService({ remote: { extensionKind: { 'pub.a': ['-web'] } } }), new TestWorkspaceTrustEnablementService(), new NullLogService()));
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ browser: 'main.browser.js', publisher: 'pub', name: 'a' }), ['ui', 'workspace']);
	});

	it('opt out from web and include only workspace through settings even if it can run in web', () => {
		testObject = disposables.add(new ExtensionManifestPropertiesService(TestProductService, new TestConfigurationService({ remote: { extensionKind: { 'pub.a': ['-web', 'workspace'] } } }), new TestWorkspaceTrustEnablementService(), new NullLogService()));
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ browser: 'main.browser.js', publisher: 'pub', name: 'a' }), ['workspace']);
	});

	it('extension cannot opt out from web', () => {
		// eslint-disable-next-line local/code-no-any-casts
		assert.deepStrictEqual(testObject.getExtensionKind(<any>{ browser: 'main.browser.js', extensionKind: ['-web'] }), ['web']);
	});

	it('extension cannot opt into web', () => {
		// eslint-disable-next-line local/code-no-any-casts
		assert.deepStrictEqual(testObject.getExtensionKind(<any>{ main: 'main.js', extensionKind: ['web', 'workspace', 'ui'] }), ['workspace', 'ui']);
	});

	it('extension cannot opt into web only', () => {
		// eslint-disable-next-line local/code-no-any-casts
		assert.deepStrictEqual(testObject.getExtensionKind(<any>{ main: 'main.js', extensionKind: ['web'] }), ['workspace']);
	});
});


// Workspace Trust is disabled in web at the moment
if (!isWeb) {
	describe('ExtensionManifestPropertiesService - ExtensionUntrustedWorkspaceSupportType', () => {
		let testObject: ExtensionManifestPropertiesService;
		let instantiationService: TestInstantiationService;
		let testConfigurationService: TestConfigurationService;

		beforeEach(async () => {
			instantiationService = new TestInstantiationService();

			testConfigurationService = new TestConfigurationService();
			instantiationService.stub(IConfigurationService, testConfigurationService);
		});

		afterEach(() => {
			testObject.dispose();
			instantiationService.dispose();
		});

		function assertUntrustedWorkspaceSupport(extensionManifest: IExtensionManifest, expected: ExtensionUntrustedWorkspaceSupportType): void {
			testObject = instantiationService.createInstance(ExtensionManifestPropertiesService);
			const untrustedWorkspaceSupport = testObject.getExtensionUntrustedWorkspaceSupportType(extensionManifest);

			assert.strictEqual(untrustedWorkspaceSupport, expected);
		}

		function getExtensionManifest(properties: any = {}): IExtensionManifest {
			return Object.create({ name: 'a', publisher: 'pub', version: '1.0.0', ...properties }) as IExtensionManifest;
		}

		it('test extension workspace trust request when main entry point is missing', () => {
			instantiationService.stub(IProductService, {});
			instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());

			const extensionManifest = getExtensionManifest();
			assertUntrustedWorkspaceSupport(extensionManifest, true);
		});

		it('test extension workspace trust request when workspace trust is disabled', async () => {
			instantiationService.stub(IProductService, {});
			instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService(false));

			const extensionManifest = getExtensionManifest({ main: './out/extension.js' });
			assertUntrustedWorkspaceSupport(extensionManifest, true);
		});

		it('test extension workspace trust request when "true" override exists in settings.json', async () => {
			instantiationService.stub(IProductService, {});
			instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());

			await testConfigurationService.setUserConfiguration('extensions', { supportUntrustedWorkspaces: { 'pub.a': { supported: true } } });
			const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
			assertUntrustedWorkspaceSupport(extensionManifest, true);
		});

		it('test extension workspace trust request when override (false) exists in settings.json', async () => {
			instantiationService.stub(IProductService, {});
			instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());

			await testConfigurationService.setUserConfiguration('extensions', { supportUntrustedWorkspaces: { 'pub.a': { supported: false } } });
			const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
			assertUntrustedWorkspaceSupport(extensionManifest, false);
		});

		it('test extension workspace trust request when override (true) for the version exists in settings.json', async () => {
			instantiationService.stub(IProductService, {});
			instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());

			await testConfigurationService.setUserConfiguration('extensions', { supportUntrustedWorkspaces: { 'pub.a': { supported: true, version: '1.0.0' } } });
			const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
			assertUntrustedWorkspaceSupport(extensionManifest, true);
		});

		it('test extension workspace trust request when override (false) for the version exists in settings.json', async () => {
			instantiationService.stub(IProductService, {});
			instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());

			await testConfigurationService.setUserConfiguration('extensions', { supportUntrustedWorkspaces: { 'pub.a': { supported: false, version: '1.0.0' } } });
			const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
			assertUntrustedWorkspaceSupport(extensionManifest, false);
		});

		it('test extension workspace trust request when override for a different version exists in settings.json', async () => {
			instantiationService.stub(IProductService, {});
			instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());

			await testConfigurationService.setUserConfiguration('extensions', { supportUntrustedWorkspaces: { 'pub.a': { supported: true, version: '2.0.0' } } });
			const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
			assertUntrustedWorkspaceSupport(extensionManifest, 'limited');
		});

		it('test extension workspace trust request when default (true) exists in product.json', () => {
			instantiationService.stub(IProductService, { extensionUntrustedWorkspaceSupport: { 'pub.a': { default: true } } });
			instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());

			const extensionManifest = getExtensionManifest({ main: './out/extension.js' });
			assertUntrustedWorkspaceSupport(extensionManifest, true);
		});

		it('test extension workspace trust request when default (false) exists in product.json', () => {
			instantiationService.stub(IProductService, { extensionUntrustedWorkspaceSupport: { 'pub.a': { default: false } } });
			instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());

			const extensionManifest = getExtensionManifest({ main: './out/extension.js' });
			assertUntrustedWorkspaceSupport(extensionManifest, false);
		});

		it('test extension workspace trust request when override (limited) exists in product.json', () => {
			instantiationService.stub(IProductService, { extensionUntrustedWorkspaceSupport: { 'pub.a': { override: 'limited' } } });
			instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());

			const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: true } } });
			assertUntrustedWorkspaceSupport(extensionManifest, 'limited');
		});

		it('test extension workspace trust request when override (false) exists in product.json', () => {
			instantiationService.stub(IProductService, { extensionUntrustedWorkspaceSupport: { 'pub.a': { override: false } } });
			instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());

			const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: true } } });
			assertUntrustedWorkspaceSupport(extensionManifest, false);
		});

		it('test extension workspace trust request when value exists in package.json', () => {
			instantiationService.stub(IProductService, {});
			instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());

			const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
			assertUntrustedWorkspaceSupport(extensionManifest, 'limited');
		});

		it('test extension workspace trust request when no value exists in package.json', () => {
			instantiationService.stub(IProductService, {});
			instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());

			const extensionManifest = getExtensionManifest({ main: './out/extension.js' });
			assertUntrustedWorkspaceSupport(extensionManifest, false);
		});
	});
}
