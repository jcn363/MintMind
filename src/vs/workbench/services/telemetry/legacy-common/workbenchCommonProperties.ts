/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INodeProcess } from '../../../../base/common/platform.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';
import { resolveCommonProperties } from '../../../../platform/telemetry/common/commonProperties.js';
import { ICommonProperties, firstSessionDateStorageKey, lastSessionDateStorageKey } from '../../../../platform/telemetry/common/telemetry.js';
import { cleanRemoteAuthority } from '../../../../platform/telemetry/common/telemetryUtils.js';

export async function resolveWorkbenchCommonProperties(
	storageService: IStorageService,
	release: string,
	hostname: string,
	commit: string | undefined,
	version: string | undefined,
	machineId: string,
	sqmId: string,
	devDeviceId: string,
	isInternalTelemetry: boolean,
	process: INodeProcess,
	releaseDate: string | undefined,
	remoteAuthority?: string,
): Promise<ICommonProperties> {
	const result = resolveCommonProperties(release, hostname, process.arch, commit, version, machineId, sqmId, devDeviceId, isInternalTelemetry, releaseDate);
	const firstSessionDate = storageService.get(firstSessionDateStorageKey, StorageScope.APPLICATION)!;
	const lastSessionDate = storageService.get(lastSessionDateStorageKey, StorageScope.APPLICATION)!;

	// __GDPR__COMMON__ "common.version.shell" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
	// Report Tauri runtime version instead of Electron
	try {
		const { getTauriVersion } = await import('@tauri-apps/api/app');
		result['common.version.shell'] = await getTauriVersion();
	} catch {
		result['common.version.shell'] = 'unknown-tauri';
	}
	// __GDPR__COMMON__ "common.version.renderer" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
	// WebView version (Chrome on Windows WebView2, WebKit on macOS/Linux)
	result['common.version.renderer'] = process.versions?.['chrome'] || 'webview';
	// __GDPR__COMMON__ "common.firstSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
	result['common.firstSessionDate'] = firstSessionDate;
	// __GDPR__COMMON__ "common.lastSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
	result['common.lastSessionDate'] = lastSessionDate || '';
	// __GDPR__COMMON__ "common.isNewSession" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
	result['common.isNewSession'] = !lastSessionDate ? '1' : '0';
	// __GDPR__COMMON__ "common.remoteAuthority" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
	result['common.remoteAuthority'] = cleanRemoteAuthority(remoteAuthority);
	// __GDPR__COMMON__ "common.cli" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
	result['common.cli'] = !!process.env['MINTMIND_CLI'];

	return result;
}
