/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepStrictEqual, strictEqual, ok } from 'assert';
import { VSBuffer } from '../../../../../../base/common/buffer.js';
import { Schemas } from '../../../../../../base/common/network.js';
import { join } from '../../../../../../base/common/path.js';
import { isWindows, OperatingSystem } from '../../../../../../base/common/platform.js';
import { env } from '../../../../../../base/common/process.js';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IRemoteAgentEnvironment } from '../../../../../../platform/remote/common/remoteAgentEnvironment.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { IRemoteAgentConnection, IRemoteAgentService } from '../../../../../services/remote/common/remoteAgentService.js';
import { TestStorageService } from '../../../../../test/common/workbenchTestServices.js';
import { fetchBashHistory, fetchFishHistory, fetchPwshHistory, fetchZshHistory, sanitizeFishHistoryCmd, TerminalPersistedHistory, type ITerminalPersistedHistory } from '../../common/history.js';

function getConfig(limit: number) {
	return {
		terminal: {
			integrated: {
				shellIntegration: {
					history: limit
				}
			}
		}
	};
}

const expectedCommands = [
	'single line command',
	'git commit -m "A wrapped line in pwsh history\n\nSome commit description\n\nFixes #xyz"',
	'git status',
	'two "\nline"'
];

describe('Terminal history', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	describe('TerminalPersistedHistory', () => {
		let history: ITerminalPersistedHistory<number>;
		let instantiationService: TestInstantiationService;
		let configurationService: TestConfigurationService;

		beforeEach(() => {
			configurationService = new TestConfigurationService(getConfig(5));
			instantiationService = store.add(new TestInstantiationService());
			instantiationService.set(IConfigurationService, configurationService);
			instantiationService.set(IStorageService, store.add(new TestStorageService()));

			history = store.add(instantiationService.createInstance(TerminalPersistedHistory<number>, 'test'));
		});

		afterEach(() => {
			instantiationService.dispose();
		});

		it('should support adding items to the cache and respect LRU', () => {
			history.add('foo', 1);
			deepStrictEqual(Array.from(history.entries), [
				['foo', 1]
			]);
			history.add('bar', 2);
			deepStrictEqual(Array.from(history.entries), [
				['foo', 1],
				['bar', 2]
			]);
			history.add('foo', 1);
			deepStrictEqual(Array.from(history.entries), [
				['bar', 2],
				['foo', 1]
			]);
		});

		it('should support removing specific items', () => {
			history.add('1', 1);
			history.add('2', 2);
			history.add('3', 3);
			history.add('4', 4);
			history.add('5', 5);
			strictEqual(Array.from(history.entries).length, 5);
			history.add('6', 6);
			strictEqual(Array.from(history.entries).length, 5);
		});

		it('should limit the number of entries based on config', () => {
			history.add('1', 1);
			history.add('2', 2);
			history.add('3', 3);
			history.add('4', 4);
			history.add('5', 5);
			strictEqual(Array.from(history.entries).length, 5);
			history.add('6', 6);
			strictEqual(Array.from(history.entries).length, 5);
			configurationService.setUserConfiguration('terminal', getConfig(2).terminal);
			// eslint-disable-next-line local/code-no-any-casts
			configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: () => true } as any);
			strictEqual(Array.from(history.entries).length, 2);
			history.add('7', 7);
			strictEqual(Array.from(history.entries).length, 2);
			configurationService.setUserConfiguration('terminal', getConfig(3).terminal);
			// eslint-disable-next-line local/code-no-any-casts
			configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: () => true } as any);
			strictEqual(Array.from(history.entries).length, 2);
			history.add('8', 8);
			strictEqual(Array.from(history.entries).length, 3);
			history.add('9', 9);
			strictEqual(Array.from(history.entries).length, 3);
		});

		it('should reload from storage service after recreation', () => {
			history.add('1', 1);
			history.add('2', 2);
			history.add('3', 3);
			strictEqual(Array.from(history.entries).length, 3);
			const history2 = store.add(instantiationService.createInstance(TerminalPersistedHistory, 'test'));
			strictEqual(Array.from(history2.entries).length, 3);
		});
	});
	describe('fetchBashHistory', () => {
		let fileScheme: string;
		let filePath: string;
		const fileContent: string = [
			'single line command',
			'git commit -m "A wrapped line in pwsh history',
			'',
			'Some commit description',
			'',
			'Fixes #xyz"',
			'git status',
			'two "',
			'line"'
		].join('\n');

		let instantiationService: TestInstantiationService;
		let remoteConnection: Pick<IRemoteAgentConnection, 'remoteAuthority'> | null = null;
		let remoteEnvironment: Pick<IRemoteAgentEnvironment, 'os'> | null = null;

		beforeEach(() => {
			instantiationService = new TestInstantiationService();
			instantiationService.stub(IFileService, {
				async readFile(resource: URI) {
					const expected = URI.from({ scheme: fileScheme, path: filePath });
					strictEqual(resource.scheme, expected.scheme);
					strictEqual(resource.path, expected.path);
					return { value: VSBuffer.fromString(fileContent) };
				}
			} as Pick<IFileService, 'readFile'>);
			instantiationService.stub(IRemoteAgentService, {
				async getEnvironment() { return remoteEnvironment; },
				getConnection() { return remoteConnection; }
			} as Pick<IRemoteAgentService, 'getConnection' | 'getEnvironment'>);
		});

		afterEach(() => {
			instantiationService.dispose();
		});

		if (!isWindows) {
			describe('local', () => {
				let originalEnvValues: { HOME: string | undefined };
				beforeEach(() => {
					originalEnvValues = { HOME: env['HOME'] };
					env['HOME'] = '/home/user';
					remoteConnection = { remoteAuthority: 'some-remote' };
					fileScheme = Schemas.vscodeRemote;
					filePath = '/home/user/.bash_history';
				});
				afterEach(() => {
					if (originalEnvValues['HOME'] === undefined) {
						delete env['HOME'];
					} else {
						env['HOME'] = originalEnvValues['HOME'];
					}
				});
				it('current OS', async () => {
					filePath = '/home/user/.bash_history';
					deepStrictEqual((await instantiationService.invokeFunction(fetchBashHistory))!.commands, expectedCommands);
				});
			});
		}
		describe('remote', () => {
			let originalEnvValues: { HOME: string | undefined };
			beforeEach(() => {
				originalEnvValues = { HOME: env['HOME'] };
				env['HOME'] = '/home/user';
				remoteConnection = { remoteAuthority: 'some-remote' };
				fileScheme = Schemas.vscodeRemote;
				filePath = '/home/user/.bash_history';
			});
			afterEach(() => {
				if (originalEnvValues['HOME'] === undefined) {
					delete env['HOME'];
				} else {
					env['HOME'] = originalEnvValues['HOME'];
				}
			});
			it('Windows', async () => {
				remoteEnvironment = { os: OperatingSystem.Windows };
				strictEqual(await instantiationService.invokeFunction(fetchBashHistory), undefined);
			});
			it('macOS', async () => {
				remoteEnvironment = { os: OperatingSystem.Macintosh };
				deepStrictEqual((await instantiationService.invokeFunction(fetchBashHistory))!.commands, expectedCommands);
			});
			it('Linux', async () => {
				remoteEnvironment = { os: OperatingSystem.Linux };
				deepStrictEqual((await instantiationService.invokeFunction(fetchBashHistory))!.commands, expectedCommands);
			});
		});
	});
	describe('fetchZshHistory', () => {
		let fileScheme: string;
		let filePath: string;
		const fileContentType = [
			{
				type: 'simple',
				content: [
					'single line command',
					'git commit -m "A wrapped line in pwsh history\\',
					'\\',
					'Some commit description\\',
					'\\',
					'Fixes #xyz"',
					'git status',
					'two "\\',
					'line"'
				].join('\n')
			},
			{
				type: 'extended',
				content: [
					': 1655252330:0;single line command',
					': 1655252330:0;git commit -m "A wrapped line in pwsh history\\',
					'\\',
					'Some commit description\\',
					'\\',
					'Fixes #xyz"',
					': 1655252330:0;git status',
					': 1655252330:0;two "\\',
					'line"'
				].join('\n')
			},
		];

		let instantiationService: TestInstantiationService;
		let remoteConnection: Pick<IRemoteAgentConnection, 'remoteAuthority'> | null = null;
		let remoteEnvironment: Pick<IRemoteAgentEnvironment, 'os'> | null = null;

		for (const { type, content } of fileContentType) {
			describe(type, () => {
				beforeEach(() => {
					instantiationService = new TestInstantiationService();
					instantiationService.stub(IFileService, {
						async readFile(resource: URI) {
							const expected = URI.from({ scheme: fileScheme, path: filePath });
							strictEqual(resource.scheme, expected.scheme);
							strictEqual(resource.path, expected.path);
							return { value: VSBuffer.fromString(content) };
						}
					} as Pick<IFileService, 'readFile'>);
					instantiationService.stub(IRemoteAgentService, {
						async getEnvironment() { return remoteEnvironment; },
						getConnection() { return remoteConnection; }
					} as Pick<IRemoteAgentService, 'getConnection' | 'getEnvironment'>);
				});

				afterEach(() => {
					instantiationService.dispose();
				});

				if (!isWindows) {
					describe('local', () => {
						let originalEnvValues: { HOME: string | undefined };
						beforeEach(() => {
							originalEnvValues = { HOME: env['HOME'] };
							env['HOME'] = '/home/user';
							remoteConnection = { remoteAuthority: 'some-remote' };
							fileScheme = Schemas.vscodeRemote;
							filePath = '/home/user/.bash_history';
						});
						afterEach(() => {
							if (originalEnvValues['HOME'] === undefined) {
								delete env['HOME'];
							} else {
								env['HOME'] = originalEnvValues['HOME'];
							}
						});
						it('current OS', async () => {
							filePath = '/home/user/.zsh_history';
							deepStrictEqual((await instantiationService.invokeFunction(fetchZshHistory))!.commands, expectedCommands);
						});
					});
				}
				describe('remote', () => {
					let originalEnvValues: { HOME: string | undefined };
					beforeEach(() => {
						originalEnvValues = { HOME: env['HOME'] };
						env['HOME'] = '/home/user';
						remoteConnection = { remoteAuthority: 'some-remote' };
						fileScheme = Schemas.vscodeRemote;
						filePath = '/home/user/.zsh_history';
					});
					afterEach(() => {
						if (originalEnvValues['HOME'] === undefined) {
							delete env['HOME'];
						} else {
							env['HOME'] = originalEnvValues['HOME'];
						}
					});
					it('Windows', async () => {
						remoteEnvironment = { os: OperatingSystem.Windows };
						strictEqual(await instantiationService.invokeFunction(fetchZshHistory), undefined);
					});
					it('macOS', async () => {
						remoteEnvironment = { os: OperatingSystem.Macintosh };
						deepStrictEqual((await instantiationService.invokeFunction(fetchZshHistory))!.commands, expectedCommands);
					});
					it('Linux', async () => {
						remoteEnvironment = { os: OperatingSystem.Linux };
						deepStrictEqual((await instantiationService.invokeFunction(fetchZshHistory))!.commands, expectedCommands);
					});
				});
			});
		}
	});
	describe('fetchPwshHistory', () => {
		let fileScheme: string;
		let filePath: string;
		const fileContent: string = [
			'single line command',
			'git commit -m "A wrapped line in pwsh history`',
			'`',
			'Some commit description`',
			'`',
			'Fixes #xyz"',
			'git status',
			'two "`',
			'line"'
		].join('\n');

		let instantiationService: TestInstantiationService;
		let remoteConnection: Pick<IRemoteAgentConnection, 'remoteAuthority'> | null = null;
		let remoteEnvironment: Pick<IRemoteAgentEnvironment, 'os'> | null = null;

		beforeEach(() => {
			instantiationService = new TestInstantiationService();
			instantiationService.stub(IFileService, {
				async readFile(resource: URI) {
					const expected = URI.from({
						scheme: fileScheme,
						authority: remoteConnection?.remoteAuthority,
						path: URI.file(filePath).path
					});
					// Sanitize the encoded `/` chars as they don't impact behavior
					strictEqual(resource.toString().replaceAll('%5C', '/'), expected.toString().replaceAll('%5C', '/'));
					return { value: VSBuffer.fromString(fileContent) };
				}
			} as Pick<IFileService, 'readFile'>);
			instantiationService.stub(IRemoteAgentService, {
				async getEnvironment() { return remoteEnvironment; },
				getConnection() { return remoteConnection; }
			} as Pick<IRemoteAgentService, 'getConnection' | 'getEnvironment'>);
		});

		afterEach(() => {
			instantiationService.dispose();
		});

		describe('local', () => {
			let originalEnvValues: { HOME: string | undefined; APPDATA: string | undefined };
			beforeEach(() => {
				originalEnvValues = { HOME: env['HOME'], APPDATA: env['APPDATA'] };
				env['HOME'] = '/home/user';
				env['APPDATA'] = 'C:\\AppData';
				remoteConnection = { remoteAuthority: 'some-remote' };
				fileScheme = Schemas.vscodeRemote;
				filePath = '/home/user/.zsh_history';
				originalEnvValues = { HOME: env['HOME'], APPDATA: env['APPDATA'] };
			});
			afterEach(() => {
				if (originalEnvValues['HOME'] === undefined) {
					delete env['HOME'];
				} else {
					env['HOME'] = originalEnvValues['HOME'];
				}
				if (originalEnvValues['APPDATA'] === undefined) {
					delete env['APPDATA'];
				} else {
					env['APPDATA'] = originalEnvValues['APPDATA'];
				}
			});
			it('current OS', async () => {
				if (isWindows) {
					filePath = join(env['APPDATA']!, 'Microsoft\\Windows\\PowerShell\\PSReadLine\\ConsoleHost_history.txt');
				} else {
					filePath = join(env['HOME']!, '.local/share/powershell/PSReadline/ConsoleHost_history.txt');
				}
				deepStrictEqual((await instantiationService.invokeFunction(fetchPwshHistory))!.commands, expectedCommands);
			});
		});
		describe('remote', () => {
			let originalEnvValues: { HOME: string | undefined; APPDATA: string | undefined };
			beforeEach(() => {
				remoteConnection = { remoteAuthority: 'some-remote' };
				fileScheme = Schemas.vscodeRemote;
				originalEnvValues = { HOME: env['HOME'], APPDATA: env['APPDATA'] };
			});
			afterEach(() => {
				if (originalEnvValues['HOME'] === undefined) {
					delete env['HOME'];
				} else {
					env['HOME'] = originalEnvValues['HOME'];
				}
				if (originalEnvValues['APPDATA'] === undefined) {
					delete env['APPDATA'];
				} else {
					env['APPDATA'] = originalEnvValues['APPDATA'];
				}
			});
			it('Windows', async () => {
				remoteEnvironment = { os: OperatingSystem.Windows };
				env['APPDATA'] = 'C:\\AppData';
				filePath = 'C:\\AppData\\Microsoft\\Windows\\PowerShell\\PSReadLine\\ConsoleHost_history.txt';
				deepStrictEqual((await instantiationService.invokeFunction(fetchPwshHistory))!.commands, expectedCommands);
			});
			it('macOS', async () => {
				remoteEnvironment = { os: OperatingSystem.Macintosh };
				env['HOME'] = '/home/user';
				filePath = '/home/user/.local/share/powershell/PSReadline/ConsoleHost_history.txt';
				deepStrictEqual((await instantiationService.invokeFunction(fetchPwshHistory))!.commands, expectedCommands);
			});
			it('Linux', async () => {
				remoteEnvironment = { os: OperatingSystem.Linux };
				env['HOME'] = '/home/user';
				filePath = '/home/user/.local/share/powershell/PSReadline/ConsoleHost_history.txt';
				deepStrictEqual((await instantiationService.invokeFunction(fetchPwshHistory))!.commands, expectedCommands);
			});
		});
	});
	describe('fetchFishHistory', () => {
		let fileScheme: string;
		let filePath: string;
		const fileContent: string = [
			'- cmd: single line command',
			'  when: 1650000000',
			'- cmd: git commit -m "A wrapped line in pwsh history\\n\\nSome commit description\\n\\nFixes #xyz"',
			'  when: 1650000010',
			'- cmd: git status',
			'  when: 1650000020',
			'- cmd: two "\\nline"',
			'  when: 1650000030',
		].join('\n');

		let instantiationService: TestInstantiationService;
		let remoteConnection: Pick<IRemoteAgentConnection, 'remoteAuthority'> | null = null;
		let remoteEnvironment: Pick<IRemoteAgentEnvironment, 'os'> | null = null;

		beforeEach(() => {
			instantiationService = new TestInstantiationService();
			instantiationService.stub(IFileService, {
				async readFile(resource: URI) {
					const expected = URI.from({ scheme: fileScheme, path: filePath });
					strictEqual(resource.scheme, expected.scheme);
					strictEqual(resource.path, expected.path);
					return { value: VSBuffer.fromString(fileContent) };
				}
			} as Pick<IFileService, 'readFile'>);
			instantiationService.stub(IRemoteAgentService, {
				async getEnvironment() { return remoteEnvironment; },
				getConnection() { return remoteConnection; }
			} as Pick<IRemoteAgentService, 'getConnection' | 'getEnvironment'>);
		});

		afterEach(() => {
			instantiationService.dispose();
		});

		if (!isWindows) {
			describe('local', () => {
				let originalEnvValues: { HOME: string | undefined };
				beforeEach(() => {
					originalEnvValues = { HOME: env['HOME'] };
					env['HOME'] = '/home/user';
					remoteConnection = { remoteAuthority: 'some-remote' };
					fileScheme = Schemas.vscodeRemote;
					filePath = '/home/user/.local/share/fish/fish_history';
				});
				afterEach(() => {
					if (originalEnvValues['HOME'] === undefined) {
						delete env['HOME'];
					} else {
						env['HOME'] = originalEnvValues['HOME'];
					}
				});
				it('current OS', async () => {
					filePath = '/home/user/.local/share/fish/fish_history';
					deepStrictEqual((await instantiationService.invokeFunction(fetchFishHistory))!.commands, expectedCommands);
				});
			});

			describe('local (overriden path)', () => {
				let originalEnvValues: { XDG_DATA_HOME: string | undefined };
				beforeEach(() => {
					originalEnvValues = { XDG_DATA_HOME: env['XDG_DATA_HOME'] };
					env['XDG_DATA_HOME'] = '/home/user/data-home';
					remoteConnection = { remoteAuthority: 'some-remote' };
					fileScheme = Schemas.vscodeRemote;
					filePath = '/home/user/data-home/fish/fish_history';
				});
				afterEach(() => {
					if (originalEnvValues['XDG_DATA_HOME'] === undefined) {
						delete env['XDG_DATA_HOME'];
					} else {
						env['XDG_DATA_HOME'] = originalEnvValues['XDG_DATA_HOME'];
					}
				});
				it('current OS', async () => {
					filePath = '/home/user/data-home/fish/fish_history';
					deepStrictEqual((await instantiationService.invokeFunction(fetchFishHistory))!.commands, expectedCommands);
				});
			});
		}
		describe('remote', () => {
			let originalEnvValues: { HOME: string | undefined };
			beforeEach(() => {
				originalEnvValues = { HOME: env['HOME'] };
				env['HOME'] = '/home/user';
				remoteConnection = { remoteAuthority: 'some-remote' };
				fileScheme = Schemas.vscodeRemote;
				filePath = '/home/user/.local/share/fish/fish_history';
			});
			afterEach(() => {
				if (originalEnvValues['HOME'] === undefined) {
					delete env['HOME'];
				} else {
					env['HOME'] = originalEnvValues['HOME'];
				}
			});
			it('Windows', async () => {
				remoteEnvironment = { os: OperatingSystem.Windows };
				strictEqual(await instantiationService.invokeFunction(fetchFishHistory), undefined);
			});
			it('macOS', async () => {
				remoteEnvironment = { os: OperatingSystem.Macintosh };
				deepStrictEqual((await instantiationService.invokeFunction(fetchFishHistory))!.commands, expectedCommands);
			});
			it('Linux', async () => {
				remoteEnvironment = { os: OperatingSystem.Linux };
				deepStrictEqual((await instantiationService.invokeFunction(fetchFishHistory))!.commands, expectedCommands);
			});
		});

		describe('remote (overriden path)', () => {
			let originalEnvValues: { XDG_DATA_HOME: string | undefined };
			beforeEach(() => {
				originalEnvValues = { XDG_DATA_HOME: env['XDG_DATA_HOME'] };
				env['XDG_DATA_HOME'] = '/home/user/data-home';
				remoteConnection = { remoteAuthority: 'some-remote' };
				fileScheme = Schemas.vscodeRemote;
				filePath = '/home/user/data-home/fish/fish_history';
			});
			afterEach(() => {
				if (originalEnvValues['XDG_DATA_HOME'] === undefined) {
					delete env['XDG_DATA_HOME'];
				} else {
					env['XDG_DATA_HOME'] = originalEnvValues['XDG_DATA_HOME'];
				}
			});
			it('Windows', async () => {
				remoteEnvironment = { os: OperatingSystem.Windows };
				strictEqual(await instantiationService.invokeFunction(fetchFishHistory), undefined);
			});
			it('macOS', async () => {
				remoteEnvironment = { os: OperatingSystem.Macintosh };
				deepStrictEqual((await instantiationService.invokeFunction(fetchFishHistory))!.commands, expectedCommands);
			});
			it('Linux', async () => {
				remoteEnvironment = { os: OperatingSystem.Linux };
				deepStrictEqual((await instantiationService.invokeFunction(fetchFishHistory))!.commands, expectedCommands);
			});
		});

		describe('sanitizeFishHistoryCmd', () => {
			it('valid new-lines', () => {
				/**
				 * Valid new-lines have odd number of leading backslashes: \n, \\\n, \\\\\n
				 */
				const cases = [
					'\\n',
					'\\n at start',
					'some \\n in the middle',
					'at the end \\n',
					'\\\\\\n',
					'\\\\\\n valid at start',
					'valid \\\\\\n in the middle',
					'valid in the end \\\\\\n',
					'\\\\\\\\\\n',
					'\\\\\\\\\\n valid at start',
					'valid \\\\\\\\\\n in the middle',
					'valid in the end \\\\\\\\\\n',
					'mixed valid \\r\\n',
					'mixed valid \\\\\\r\\n',
					'mixed valid \\r\\\\\\n',
				];

				for (const x of cases) {
					ok(sanitizeFishHistoryCmd(x).includes('\n'));
				}
			});

			it('invalid new-lines', () => {
				/**
				 * Invalid new-lines have even number of leading backslashes: \\n, \\\\n, \\\\\\n
				 */
				const cases = [
					'\\\\n',
					'\\\\n invalid at start',
					'invalid \\\\n in the middle',
					'invalid in the end \\\\n',
					'\\\\\\\\n',
					'\\\\\\\\n invalid at start',
					'invalid \\\\\\\\n in the middle',
					'invalid in the end \\\\\\\\n',
					'mixed invalid \\r\\\\n',
					'mixed invalid \\r\\\\\\\\n',
					'echo "\\\\n"',
				];

				for (const x of cases) {
					ok(!sanitizeFishHistoryCmd(x).includes('\n'));
				}
			});

		});
	});
});
