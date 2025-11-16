/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ok, strictEqual } from 'assert';
import { dedupeRules, isPowerShell } from '../../browser/runInTerminalHelpers.js';
import { OperatingSystem } from '../../../../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { ConfigurationTarget } from '../../../../../../platform/configuration/common/configuration.js';
import type { IAutoApproveRule, ICommandApprovalResultWithReason } from '../../browser/commandLineAutoApprover.js';

describe('isPowerShell', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	describe('PowerShell executables', () => {
		it('should detect powershell.exe', () => {
			ok(isPowerShell('powershell.exe', OperatingSystem.Windows));
			ok(isPowerShell('powershell', OperatingSystem.Linux));
		});

		it('should detect pwsh.exe', () => {
			ok(isPowerShell('pwsh.exe', OperatingSystem.Windows));
			ok(isPowerShell('pwsh', OperatingSystem.Linux));
		});

		it('should detect powershell-preview', () => {
			ok(isPowerShell('powershell-preview.exe', OperatingSystem.Windows));
			ok(isPowerShell('powershell-preview', OperatingSystem.Linux));
		});

		it('should detect pwsh-preview', () => {
			ok(isPowerShell('pwsh-preview.exe', OperatingSystem.Windows));
			ok(isPowerShell('pwsh-preview', OperatingSystem.Linux));
		});
	});

	describe('PowerShell with full paths', () => {
		it('should detect Windows PowerShell with full path', () => {
			ok(isPowerShell('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', OperatingSystem.Windows));
		});

		it('should detect PowerShell Core with full path', () => {
			ok(isPowerShell('C:\\Program Files\\PowerShell\\7\\pwsh.exe', OperatingSystem.Windows));
		});

		it('should detect PowerShell on Linux/macOS with full path', () => {
			ok(isPowerShell('/usr/bin/pwsh', OperatingSystem.Linux));
		});

		it('should detect PowerShell preview with full path', () => {
			ok(isPowerShell('/opt/microsoft/powershell/7-preview/pwsh-preview', OperatingSystem.Linux));
		});

		it('should detect nested path with powershell', () => {
			ok(isPowerShell('/some/deep/path/to/powershell.exe', OperatingSystem.Windows));
		});
	});

	describe('Case sensitivity', () => {
		it('should detect PowerShell regardless of case', () => {
			ok(isPowerShell('PowerShell.exe', OperatingSystem.Windows));
			ok(isPowerShell('POWERSHELL.EXE', OperatingSystem.Windows));
			ok(isPowerShell('Pwsh.exe', OperatingSystem.Windows));
		});
	});

	describe('Non-PowerShell shells', () => {
		it('should not detect bash', () => {
			ok(!isPowerShell('bash', OperatingSystem.Linux));
		});

		it('should not detect zsh', () => {
			ok(!isPowerShell('zsh', OperatingSystem.Linux));
		});

		it('should not detect sh', () => {
			ok(!isPowerShell('sh', OperatingSystem.Linux));
		});

		it('should not detect fish', () => {
			ok(!isPowerShell('fish', OperatingSystem.Linux));
		});

		it('should not detect cmd.exe', () => {
			ok(!isPowerShell('cmd.exe', OperatingSystem.Windows));
		});

		it('should not detect command.com', () => {
			ok(!isPowerShell('command.com', OperatingSystem.Windows));
		});

		it('should not detect dash', () => {
			ok(!isPowerShell('dash', OperatingSystem.Linux));
		});

		it('should not detect tcsh', () => {
			ok(!isPowerShell('tcsh', OperatingSystem.Linux));
		});

		it('should not detect csh', () => {
			ok(!isPowerShell('csh', OperatingSystem.Linux));
		});
	});

	describe('Non-PowerShell shells with full paths', () => {
		it('should not detect bash with full path', () => {
			ok(!isPowerShell('/bin/bash', OperatingSystem.Linux));
		});

		it('should not detect zsh with full path', () => {
			ok(!isPowerShell('/usr/bin/zsh', OperatingSystem.Linux));
		});

		it('should not detect cmd.exe with full path', () => {
			ok(!isPowerShell('C:\\Windows\\System32\\cmd.exe', OperatingSystem.Windows));
		});

		it('should not detect git bash', () => {
			ok(!isPowerShell('C:\\Program Files\\Git\\bin\\bash.exe', OperatingSystem.Windows));
		});
	});

	describe('Edge cases', () => {
		it('should handle empty string', () => {
			ok(!isPowerShell('', OperatingSystem.Windows));
		});

		it('should handle paths with spaces', () => {
			ok(isPowerShell('C:\\Program Files\\PowerShell\\7\\pwsh.exe', OperatingSystem.Windows));
			ok(!isPowerShell('C:\\Program Files\\Git\\bin\\bash.exe', OperatingSystem.Windows));
		});

		it('should not match partial strings', () => {
			ok(!isPowerShell('notpowershell', OperatingSystem.Linux));
			ok(!isPowerShell('powershellish', OperatingSystem.Linux));
			ok(!isPowerShell('mypwsh', OperatingSystem.Linux));
			ok(!isPowerShell('pwshell', OperatingSystem.Linux));
		});

		it('should handle strings containing powershell but not as basename', () => {
			ok(!isPowerShell('/powershell/bin/bash', OperatingSystem.Linux));
			ok(!isPowerShell('/usr/pwsh/bin/zsh', OperatingSystem.Linux));
			ok(!isPowerShell('C:\\powershell\\cmd.exe', OperatingSystem.Windows));
		});

		it('should handle special characters in path', () => {
			ok(isPowerShell('/path/with-dashes/pwsh.exe', OperatingSystem.Windows));
			ok(isPowerShell('/path/with_underscores/powershell', OperatingSystem.Linux));
			ok(isPowerShell('C:\\path\\with spaces\\pwsh.exe', OperatingSystem.Windows));
		});

		it('should handle relative paths', () => {
			ok(isPowerShell('./powershell.exe', OperatingSystem.Windows));
			ok(isPowerShell('../bin/pwsh', OperatingSystem.Linux));
			ok(isPowerShell('bin/powershell', OperatingSystem.Linux));
		});

		it('should not match similar named tools', () => {
			ok(!isPowerShell('powertool', OperatingSystem.Linux));
			ok(!isPowerShell('shell', OperatingSystem.Linux));
			ok(!isPowerShell('power', OperatingSystem.Linux));
			ok(!isPowerShell('pwshconfig', OperatingSystem.Linux));
		});
	});
});

describe('dedupeRules', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	function createMockRule(sourceText: string): IAutoApproveRule {
		return {
			regex: new RegExp(sourceText),
			regexCaseInsensitive: new RegExp(sourceText, 'i'),
			sourceText,
			sourceTarget: ConfigurationTarget.USER,
			isDefaultRule: false
		};
	}

	function createMockResult(result: 'approved' | 'denied' | 'noMatch', reason: string, rule?: IAutoApproveRule): ICommandApprovalResultWithReason {
		return {
			result,
			reason,
			rule
		};
	}

	it('should return empty array for empty input', () => {
		const result = dedupeRules([]);
		strictEqual(result.length, 0);
	});

	it('should return same array when no duplicates exist', () => {
		const result = dedupeRules([
			createMockResult('approved', 'approved by echo rule', createMockRule('echo')),
			createMockResult('approved', 'approved by ls rule', createMockRule('ls'))
		]);
		strictEqual(result.length, 2);
		strictEqual(result[0].rule?.sourceText, 'echo');
		strictEqual(result[1].rule?.sourceText, 'ls');
	});

	it('should deduplicate rules with same sourceText', () => {
		const result = dedupeRules([
			createMockResult('approved', 'approved by echo rule', createMockRule('echo')),
			createMockResult('approved', 'approved by echo rule again', createMockRule('echo')),
			createMockResult('approved', 'approved by ls rule', createMockRule('ls'))
		]);
		strictEqual(result.length, 2);
		strictEqual(result[0].rule?.sourceText, 'echo');
		strictEqual(result[1].rule?.sourceText, 'ls');
	});

	it('should preserve first occurrence when deduplicating', () => {
		const result = dedupeRules([
			createMockResult('approved', 'first echo rule', createMockRule('echo')),
			createMockResult('approved', 'second echo rule', createMockRule('echo'))
		]);
		strictEqual(result.length, 1);
		strictEqual(result[0].reason, 'first echo rule');
	});

	it('should filter out results without rules', () => {
		const result = dedupeRules([
			createMockResult('noMatch', 'no rule applied'),
			createMockResult('approved', 'approved by echo rule', createMockRule('echo')),
			createMockResult('denied', 'denied without rule')
		]);
		strictEqual(result.length, 1);
		strictEqual(result[0].rule?.sourceText, 'echo');
	});

	it('should handle mix of rules and no-rule results with duplicates', () => {
		const result = dedupeRules([
			createMockResult('approved', 'approved by echo rule', createMockRule('echo')),
			createMockResult('noMatch', 'no rule applied'),
			createMockResult('approved', 'approved by echo rule again', createMockRule('echo')),
			createMockResult('approved', 'approved by ls rule', createMockRule('ls')),
			createMockResult('denied', 'denied without rule')
		]);
		strictEqual(result.length, 2);
		strictEqual(result[0].rule?.sourceText, 'echo');
		strictEqual(result[1].rule?.sourceText, 'ls');
	});

	it('should handle multiple duplicates of same rule', () => {
		const result = dedupeRules([
			createMockResult('approved', 'npm rule 1', createMockRule('npm')),
			createMockResult('approved', 'npm rule 2', createMockRule('npm')),
			createMockResult('approved', 'npm rule 3', createMockRule('npm')),
			createMockResult('approved', 'git rule', createMockRule('git'))
		]);
		strictEqual(result.length, 2);
		strictEqual(result[0].rule?.sourceText, 'npm');
		strictEqual(result[0].reason, 'npm rule 1');
		strictEqual(result[1].rule?.sourceText, 'git');
	});
});
