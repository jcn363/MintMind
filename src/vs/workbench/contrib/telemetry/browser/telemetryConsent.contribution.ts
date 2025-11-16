/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry, IWorkbenchContribution } from '../../../common/contributions.js';
import { LifecyclePhase, ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { ITelemetryService, TELEMETRY_SETTING_ID, TelemetryLevel } from '../../../../platform/telemetry/common/telemetry.js';
import { getTelemetryLevel } from '../../../../platform/telemetry/common/telemetryUtils.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IDialogService, IPromptButton } from '../../../../platform/dialogs/common/dialogs.js';
import { localize } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

const TELEMETRY_CONSENT_STORAGE_KEY = 'telemetry.consentShown';

export class TelemetryConsentContribution extends Disposable implements IWorkbenchContribution {

	constructor(
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IStorageService private readonly storageService: IStorageService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IProductService private readonly productService: IProductService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@ILifecycleService private readonly lifecycleService: ILifecycleService,
		@IDialogService private readonly dialogService: IDialogService
	) {
		super();

		this.lifecycleService.when(LifecyclePhase.Restored).then(() => {
			this.showTelemetryConsentDialogIfNeeded();
		});
	}

	private async showTelemetryConsentDialogIfNeeded(): Promise<void> {
		// Check if telemetry consent dialog was already shown
		if (this.storageService.get(TELEMETRY_CONSENT_STORAGE_KEY, StorageScope.PROFILE)) {
			return;
		}

		// Only show dialog if telemetry is enabled by default (crash level)
		const currentLevel = getTelemetryLevel(this.configurationService);
		if (currentLevel === TelemetryLevel.NONE) {
			return;
		}

		// Mark as shown to avoid showing again
		this.storageService.store(TELEMETRY_CONSENT_STORAGE_KEY, true, StorageScope.PROFILE, StorageTarget.USER);

		// Show the consent dialog
		await this.showTelemetryConsentDialog();
	}

	private async showTelemetryConsentDialog(): Promise<void> {
		const productName = this.productService.nameLong;

		const message = localize(
			'telemetry.consent.message',
			"¿Permitir que {0} recopile datos de uso y errores?",
			productName
		);

		const detail = localize(
			'telemetry.consent.detail',
			"Por defecto, {0} solo recopila datos de crashes para ayudar a mejorar la estabilidad. Puede elegir recopilar datos de errores y crashes, o datos completos de uso. Todos los datos se envían de forma anónima y no incluyen información personal.",
			productName
		);

		const acceptButton: IPromptButton<TelemetryLevel> = {
			label: localize('telemetry.consent.accept', "&&Aceptar (Datos completos)"),
			run: () => TelemetryLevel.USAGE
		};

		const acceptErrorsOnlyButton: IPromptButton<TelemetryLevel> = {
			label: localize('telemetry.consent.acceptErrorsOnly', "&&Solo errores"),
			run: () => TelemetryLevel.ERROR
		};

		const rejectButton: IPromptButton<TelemetryLevel> = {
			label: localize('telemetry.consent.reject', "&&Rechazar"),
			run: () => TelemetryLevel.NONE
		};

		const laterButton: IPromptButton<TelemetryLevel> = {
			label: localize('telemetry.consent.later', "&&Más tarde"),
			run: () => TelemetryLevel.CRASH // Keep current default
		};

		try {
			const result = await this.dialogService.prompt<TelemetryLevel>({
				type: 'question',
				message,
				detail,
				buttons: [acceptButton, acceptErrorsOnlyButton, rejectButton],
				cancelButton: laterButton
			});

			if (result.result !== undefined) {
				// Update telemetry level based on user choice
				await this.configurationService.updateValue(TELEMETRY_SETTING_ID, this.telemetryLevelToConfiguration(result.result));
			}
		} catch (error) {
			// If dialog fails, keep current default (error level)
		}
	}

	private telemetryLevelToConfiguration(level: TelemetryLevel): string {
		switch (level) {
			case TelemetryLevel.NONE:
				return 'off';
			case TelemetryLevel.CRASH:
				return 'crash';
			case TelemetryLevel.ERROR:
				return 'error';
			case TelemetryLevel.USAGE:
				return 'all';
			default:
				return 'error';
		}
	}
}

const workbenchContributionRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchContributionRegistry.registerWorkbenchContribution(TelemetryConsentContribution, LifecyclePhase.Restored);