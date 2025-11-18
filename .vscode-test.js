/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

import { createRequire } from 'node:module';
import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { defineConfig } = require('@vscode/test-cli');

/**
 * A list of extension folders who have opted into tests, or configuration objects.
 * Edit me to add more!
 *
 * @type {Array<Partial<import("@vscode/test-cli").TestConfiguration> & { label: string }>}
 */
const extensions = [
	{
		label: 'markdown-language-features',
		workspaceFolder: `extensions/markdown-language-features/test-workspace`,
		mocha: { timeout: 60_000 }
	},
	{
		label: 'ipynb',
		workspaceFolder: path.join(os.tmpdir(), `ipynb-${Math.floor(Math.random() * 100000)}`),
		mocha: { timeout: 60_000 }
	},
	{
		label: 'notebook-renderers',
		workspaceFolder: path.join(os.tmpdir(), `nbout-${Math.floor(Math.random() * 100000)}`),
		mocha: { timeout: 60_000 }
	},
	{
		label: 'vscode-colorize-tests',
		workspaceFolder: `extensions/vscode-colorize-tests/test`,
		mocha: { timeout: 60_000 }
	},
	{
		label: 'terminal-suggest',
		workspaceFolder: path.join(os.tmpdir(), `terminal-suggest-${Math.floor(Math.random() * 100000)}`),
		mocha: { timeout: 60_000 }
	},
	{
		label: 'vscode-colorize-perf-tests',
		workspaceFolder: `extensions/vscode-colorize-perf-tests/test`,
		mocha: { timeout: 6000_000 }
	},
	{
		label: 'configuration-editing',
		workspaceFolder: path.join(os.tmpdir(), `confeditout-${Math.floor(Math.random() * 100000)}`),
		mocha: { timeout: 60_000 }
	},
	{
		label: 'github-authentication',
		workspaceFolder: path.join(os.tmpdir(), `msft-auth-${Math.floor(Math.random() * 100000)}`),
		mocha: { timeout: 60_000 }
	},
	{
		label: 'microsoft-authentication',
		mocha: { timeout: 60_000 }
	},
	{
		label: 'vscode-api-tests-folder',
		extensionDevelopmentPath: `extensions/vscode-api-tests`,
		workspaceFolder: `extensions/vscode-api-tests/testWorkspace`,
		mocha: { timeout: 60_000 },
		files: 'extensions/vscode-api-tests/out/singlefolder-tests/**/*.test.js',
	},
	{
		label: 'vscode-api-tests-workspace',
		extensionDevelopmentPath: `extensions/vscode-api-tests`,
		workspaceFolder: `extensions/vscode-api-tests/testworkspace.code-workspace`,
		mocha: { timeout: 60_000 },
		files: 'extensions/vscode-api-tests/out/workspace-tests/**/*.test.js',
	},
	{
		label: 'git-base',
		mocha: { timeout: 60_000 }
	}
];


const defaultLaunchArgs = process.env.API_TESTS_EXTRA_ARGS?.split(' ') || [
	'--disable-telemetry', '--disable-experiments', '--skip-welcome', '--skip-release-notes', `--crash-reporter-directory=${__dirname}/.build/crashes`, `--logsPath=${__dirname}/.build/logs/integration-tests`, '--no-cached-data', '--disable-updates', '--use-inmemory-secretstorage', '--disable-extensions', '--disable-workspace-trust'
];

const config = defineConfig(extensions.map(extension => {
	/** @type {import('@vscode/test-cli').TestConfiguration} */
	const config = {
		platform: 'desktop',
		files: `extensions/${extension.label}/out/**/*.test.js`,
		extensionDevelopmentPath: `extensions/${extension.label}`,
		...extension,
	};

	config.mocha ??= {};
	if (process.env.BUILD_ARTIFACTSTAGINGDIRECTORY || process.env.GITHUB_WORKSPACE) {
		let suite = '';
		if (process.env.MINTMIND_BROWSER) {
			suite = `${process.env.MINTMIND_BROWSER} Browser Integration ${config.label} tests`;
		} else if (process.env.REMOTE_MINTMIND) {
			suite = `Remote Integration ${config.label} tests`;
		} else {
			suite = `Integration ${config.label} tests`;
		}

		config.mocha.reporter = 'mocha-multi-reporters';
		config.mocha.reporterOptions = {
			reporterEnabled: 'spec, mocha-junit-reporter',
			mochaJunitReporterReporterOptions: {
				testsuitesTitle: `${suite} ${process.platform}`,
				mochaFile: path.join(
					process.env.BUILD_ARTIFACTSTAGINGDIRECTORY || process.env.GITHUB_WORKSPACE || __dirname,
					`test-results/${process.platform}-${process.arch}-${suite.toLowerCase().replace(/[^\w]/g, '-')}-results.xml`
				)
			}
		};
	}

	if (!config.platform || config.platform === 'desktop') {
		config.launchArgs = defaultLaunchArgs;
		config.useInstallation = {
			// Use Tauri binary for integration tests
			// Tests expect the release binary to be available; debug binary is used as fallback if release does not exist
			fromPath: (() => {
				if (process.env.INTEGRATION_TEST_TAURI_PATH) {
					return process.env.INTEGRATION_TEST_TAURI_PATH;
				}
				const releasePath = `${__dirname}/src-tauri/target/release/mintmind-tauri${process.platform === 'win32' ? '.exe' : ''}`;
				const debugPath = `${__dirname}/src-tauri/target/debug/mintmind-tauri${process.platform === 'win32' ? '.exe' : ''}`;
				return existsSync(releasePath) ? releasePath : debugPath;
			})(),
		};
		config.env = {
			...config.env,
			MINTMIND_SKIP_PRELAUNCH: '1',
		};
	} else {
		// web configs not supported, yet
	}

	return config;
}));

export default config;
