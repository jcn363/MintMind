/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * NLS (National Language Support) utilities for retrieving localized messages and language settings.
 */

export function getNLSMessages(): string[] {
	return globalThis._MINTMIND_NLS_MESSAGES || [];
}

export function getNLSLanguage(): string | undefined {
	return globalThis._MINTMIND_NLS_LANGUAGE;
}
