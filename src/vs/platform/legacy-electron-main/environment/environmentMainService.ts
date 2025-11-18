/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { memoize } from '../../../base/common/decorators.js';
import { join } from '../../../base/common/path.js';
import { URI } from '../../../base/common/uri.js';
import { createStaticIPCHandle } from '../../../base/parts/ipc/node/ipc.net.js';
import { refineServiceDecorator } from '../../instantiation/common/instantiation.js';
import { ExtensionKind, IEnvironmentService, INativeEnvironmentService } from '../common/environment.js';
import { NativeEnvironmentService } from '../node/environmentService.js';

export const IEnvironmentMainService = refineServiceDecorator<IEnvironmentService, IEnvironmentMainService>(IEnvironmentService);

/**
 * A subclass of the `INativeEnvironmentService` to be used only in electron-main
 * environments.
 */
export interface IEnvironmentMainService extends INativeEnvironmentService {

	// --- backup paths
	readonly backupHome: string;

	// --- V8 code caching
	readonly codeCachePath: string | undefined;
	readonly useCodeCache: boolean;

	// --- IPC
	readonly mainIPCHandle: string;
	readonly mainLockfile: string;

	// --- config
	readonly disableUpdates: boolean;

	// Make exportPolicyData optional to match the base implementation
	readonly exportPolicyData?: string;

	// TODO@deepak1556 TODO@bpasero temporary until a real fix lands upstream
	enableRDPDisplayTracking: boolean;
}

export class EnvironmentMainService extends NativeEnvironmentService implements IEnvironmentMainService {
	enableExtensions?: readonly string[];

	@memoize
	get backupHome(): string { return join(this.userDataPath, 'Backups'); }

	@memoize
	get mainIPCHandle(): string { return createStaticIPCHandle(this.userDataPath, 'main', this.productService.version); }

	@memoize
	get mainLockfile(): string { return join(this.userDataPath, 'code.lock'); }

	@memoize
	get disableUpdates(): boolean { return Boolean(this.args['disable-updates']); }

	@memoize
	get crossOriginIsolated(): boolean { return Boolean(this.args['enable-coi']); }

	@memoize
	get enableRDPDisplayTracking(): boolean { return Boolean(this.args['enable-rdp-display-tracking']); }

	@memoize
	get codeCachePath(): string | undefined { return process.env['MINTMIND_CODE_CACHE_PATH'] || undefined; }

	@memoize
	get useCodeCache(): boolean { return Boolean(this.codeCachePath); }

	@memoize
	override get exportPolicyData(): string { return ''; }

	@memoize
	override get continueOn(): string { return this.args.continueOn || ''; }

	@memoize
	override get editSessionId(): string { return this.args.editSessionId || ''; }

	@memoize
	override get extensionDevelopmentLocationURI(): URI[] { return []; }

	@memoize
	override get extensionDevelopmentKind(): ExtensionKind[] {
		return [];
	}

	@memoize
	override get extensionTestsLocationURI(): URI {
		return URI.file('');
	}

	@memoize
	override get logLevel(): string | undefined {
		return super.logLevel;
	}
}
