/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint-disable local/code-no-test-async-suite */
import { deepStrictEqual, ok, strictEqual } from 'assert';
import { homedir, userInfo } from 'os';
import { isWindows } from '../../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { NullLogService } from '../../../log/common/log.js';
import { IProductService } from '../../../product/common/productService.js';
import { ITerminalProcessOptions } from '../../common/terminal.js';
import { IShellIntegrationConfigInjection, getShellIntegrationInjection, getWindowsBuildNumber, type IShellIntegrationInjectionFailure } from '../../node/terminalEnvironment.js';

const enabledProcessOptions: ITerminalProcessOptions = { shellIntegration: { enabled: true, suggestEnabled: false, nonce: '' }, windowsEnableConpty: true, windowsUseConptyDll: false, environmentVariableCollections: undefined, workspaceFolder: undefined, isScreenReaderOptimized: false };
const disabledProcessOptions: ITerminalProcessOptions = { shellIntegration: { enabled: false, suggestEnabled: false, nonce: '' }, windowsEnableConpty: true, windowsUseConptyDll: false, environmentVariableCollections: undefined, workspaceFolder: undefined, isScreenReaderOptimized: false };
const winptyProcessOptions: ITerminalProcessOptions = { shellIntegration: { enabled: true, suggestEnabled: false, nonce: '' }, windowsEnableConpty: false, windowsUseConptyDll: false, environmentVariableCollections: undefined, workspaceFolder: undefined, isScreenReaderOptimized: false };
const pwshExe = process.platform === 'win32' ? 'pwsh.exe' : 'pwsh';
const repoRoot = process.platform === 'win32' ? process.cwd()[0].toLowerCase() + process.cwd().substring(1) : process.cwd();
const logService = new NullLogService();
const productService = { applicationName: 'vscode' } as IProductService;
const defaultEnvironment = {};

function deepStrictEqualIgnoreStableVar(actual: IShellIntegrationConfigInjection | IShellIntegrationInjectionFailure | undefined, expected: IShellIntegrationConfigInjection) {
  if (actual?.type === 'injection' && actual.envMixin) {
    delete actual.envMixin['MINTMIND_STABLE'];
  }
  deepStrictEqual(actual, expected);
}

describe('platform - terminalEnvironment', async () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  describe('getShellIntegrationInjection', async () => {
    describe('should not enable', async () => {
      // This test is only expected to work on Windows 10 build 18309 and above
      (getWindowsBuildNumber() < 18309 ? test.skip : test)('when isFeatureTerminal or when no executable is provided', async () => {
        strictEqual((await getShellIntegrationInjection({ executable: pwshExe, args: ['-l', '-NoLogo'], isFeatureTerminal: true }, enabledProcessOptions, defaultEnvironment, logService, productService, true)).type, 'failure');
        strictEqual((await getShellIntegrationInjection({ executable: pwshExe, args: ['-l', '-NoLogo'], isFeatureTerminal: false }, enabledProcessOptions, defaultEnvironment, logService, productService, true)).type, 'injection');
      });
      if (isWindows) {
        it('when on windows with conpty false', async () => {
          strictEqual((await getShellIntegrationInjection({ executable: pwshExe, args: ['-l'], isFeatureTerminal: false }, winptyProcessOptions, defaultEnvironment, logService, productService, true)).type, 'failure');
        });
      }
    });

    // These tests are only expected to work on Windows 10 build 18309 and above
    (getWindowsBuildNumber() < 18309 ? suite.skip : suite)('pwsh', async () => {
      const expectedPs1 = process.platform === 'win32'
        ? `try { . "${repoRoot}\\out\\vs\\workbench\\contrib\\terminal\\common\\scripts\\shellIntegration.ps1" } catch {}`
        : `. "${repoRoot}/out/vs/workbench/contrib/terminal/common/scripts/shellIntegration.ps1"`;
      describe('should override args', async () => {
        const enabledExpectedResult = Object.freeze<IShellIntegrationConfigInjection>({
          type: 'injection',
          newArgs: [
            '-noexit',
            '-command',
            expectedPs1
          ],
          envMixin: {
            MINTMIND_A11Y_MODE: '0',
            MINTMIND_INJECTION: '1'
          }
        });
        it('when undefined, []', async () => {
          deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: pwshExe, args: [] }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
          deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: pwshExe, args: undefined }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
        });
        describe('when no logo', async () => {
          it('array - case insensitive', async () => {
            deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: pwshExe, args: ['-NoLogo'] }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
            deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: pwshExe, args: ['-NOLOGO'] }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
            deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: pwshExe, args: ['-nol'] }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
            deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: pwshExe, args: ['-NOL'] }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
          });
          it('string - case insensitive', async () => {
            deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: pwshExe, args: '-NoLogo' }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
            deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: pwshExe, args: '-NOLOGO' }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
            deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: pwshExe, args: '-nol' }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
            deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: pwshExe, args: '-NOL' }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
          });
        });
      });
      describe('should incorporate login arg', async () => {
        const enabledExpectedResult = Object.freeze<IShellIntegrationConfigInjection>({
          type: 'injection',
          newArgs: [
            '-l',
            '-noexit',
            '-command',
            expectedPs1
          ],
          envMixin: {
            MINTMIND_A11Y_MODE: '0',
            MINTMIND_INJECTION: '1'
          }
        });
        it('when array contains no logo and login', async () => {
          deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: pwshExe, args: ['-l', '-NoLogo'] }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
        });
        it('when string', async () => {
          deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: pwshExe, args: '-l' }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
        });
      });
      describe('should not modify args', async () => {
        it('when shell integration is disabled', async () => {
          strictEqual((await getShellIntegrationInjection({ executable: pwshExe, args: ['-l'] }, disabledProcessOptions, defaultEnvironment, logService, productService, true)).type, 'failure');
          strictEqual((await getShellIntegrationInjection({ executable: pwshExe, args: '-l' }, disabledProcessOptions, defaultEnvironment, logService, productService, true)).type, 'failure');
          strictEqual((await getShellIntegrationInjection({ executable: pwshExe, args: undefined }, disabledProcessOptions, defaultEnvironment, logService, productService, true)).type, 'failure');
        });
        it('when using unrecognized arg', async () => {
          strictEqual((await getShellIntegrationInjection({ executable: pwshExe, args: ['-l', '-NoLogo', '-i'] }, disabledProcessOptions, defaultEnvironment, logService, productService, true)).type, 'failure');
        });
        it('when using unrecognized arg (string)', async () => {
          strictEqual((await getShellIntegrationInjection({ executable: pwshExe, args: '-i' }, disabledProcessOptions, defaultEnvironment, logService, productService, true)).type, 'failure');
        });
      });
    });

    if (process.platform !== 'win32') {
      describe('zsh', async () => {
        describe('should override args', async () => {
          const username = userInfo().username;
          const expectedDir = new RegExp(`.+\/${username}-vscode-zsh`);
          const customZdotdir = '/custom/zsh/dotdir';
          const expectedDests = [
            new RegExp(`.+\\/${username}-vscode-zsh\\/\\.zshrc`),
            new RegExp(`.+\\/${username}-vscode-zsh\\/\\.zprofile`),
            new RegExp(`.+\\/${username}-vscode-zsh\\/\\.zshenv`),
            new RegExp(`.+\\/${username}-vscode-zsh\\/\\.zlogin`)
          ];
          const expectedSources = [
            /.+\/out\/vs\/workbench\/contrib\/terminal\/common\/scripts\/shellIntegration-rc.zsh/,
            /.+\/out\/vs\/workbench\/contrib\/terminal\/common\/scripts\/shellIntegration-profile.zsh/,
            /.+\/out\/vs\/workbench\/contrib\/terminal\/common\/scripts\/shellIntegration-env.zsh/,
            /.+\/out\/vs\/workbench\/contrib\/terminal\/common\/scripts\/shellIntegration-login.zsh/
          ];
          function assertIsEnabled(result: IShellIntegrationConfigInjection, globalZdotdir = homedir()) {
            strictEqual(Object.keys(result.envMixin!).length, 3);
            ok(result.envMixin!['ZDOTDIR']?.match(expectedDir));
            strictEqual(result.envMixin!['USER_ZDOTDIR'], globalZdotdir);
            ok(result.envMixin!['MINTMIND_INJECTION']?.match('1'));
            strictEqual(result.filesToCopy?.length, 4);
            ok(result.filesToCopy[0].dest.match(expectedDests[0]));
            ok(result.filesToCopy[1].dest.match(expectedDests[1]));
            ok(result.filesToCopy[2].dest.match(expectedDests[2]));
            ok(result.filesToCopy[3].dest.match(expectedDests[3]));
            ok(result.filesToCopy[0].source.match(expectedSources[0]));
            ok(result.filesToCopy[1].source.match(expectedSources[1]));
            ok(result.filesToCopy[2].source.match(expectedSources[2]));
            ok(result.filesToCopy[3].source.match(expectedSources[3]));
          }
          it('when undefined, []', async () => {
            const result1 = await getShellIntegrationInjection({ executable: 'zsh', args: [] }, enabledProcessOptions, defaultEnvironment, logService, productService, true) as IShellIntegrationConfigInjection;
            deepStrictEqual(result1?.newArgs, ['-i']);
            assertIsEnabled(result1);
            const result2 = await getShellIntegrationInjection({ executable: 'zsh', args: undefined }, enabledProcessOptions, defaultEnvironment, logService, productService, true) as IShellIntegrationConfigInjection;
            deepStrictEqual(result2?.newArgs, ['-i']);
            assertIsEnabled(result2);
          });
          describe('should incorporate login arg', async () => {
            it('when array', async () => {
              const result = await getShellIntegrationInjection({ executable: 'zsh', args: ['-l'] }, enabledProcessOptions, defaultEnvironment, logService, productService, true) as IShellIntegrationConfigInjection;
              deepStrictEqual(result?.newArgs, ['-il']);
              assertIsEnabled(result);
            });
          });
          describe('should not modify args', async () => {
            it('when shell integration is disabled', async () => {
              strictEqual((await getShellIntegrationInjection({ executable: 'zsh', args: ['-l'] }, disabledProcessOptions, defaultEnvironment, logService, productService, true)).type, 'failure');
              strictEqual((await getShellIntegrationInjection({ executable: 'zsh', args: undefined }, disabledProcessOptions, defaultEnvironment, logService, productService, true)).type, 'failure');
            });
            it('when using unrecognized arg', async () => {
              strictEqual((await getShellIntegrationInjection({ executable: 'zsh', args: ['-l', '-fake'] }, disabledProcessOptions, defaultEnvironment, logService, productService, true)).type, 'failure');
            });
          });
          describe('should incorporate global ZDOTDIR env variable', async () => {
            it('when custom ZDOTDIR', async () => {
              const result1 = await getShellIntegrationInjection({ executable: 'zsh', args: [] }, enabledProcessOptions, { ...defaultEnvironment, ZDOTDIR: customZdotdir }, logService, productService, true) as IShellIntegrationConfigInjection;
              deepStrictEqual(result1?.newArgs, ['-i']);
              assertIsEnabled(result1, customZdotdir);
            });
            it('when undefined', async () => {
              const result1 = await getShellIntegrationInjection({ executable: 'zsh', args: [] }, enabledProcessOptions, undefined, logService, productService, true) as IShellIntegrationConfigInjection;
              deepStrictEqual(result1?.newArgs, ['-i']);
              assertIsEnabled(result1);
            });
          });
        });
      });
      describe('bash', async () => {
        describe('should override args', async () => {
          it('when undefined, [], empty string', async () => {
            const enabledExpectedResult = Object.freeze<IShellIntegrationConfigInjection>({
              type: 'injection',
              newArgs: [
                '--init-file',
                `${repoRoot}/out/vs/workbench/contrib/terminal/common/scripts/shellIntegration-bash.sh`
              ],
              envMixin: {
                MINTMIND_INJECTION: '1'
              }
            });
            deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: 'bash', args: [] }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
            deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: 'bash', args: '' }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
            deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: 'bash', args: undefined }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
          });
          describe('should set login env variable and not modify args', async () => {
            const enabledExpectedResult = Object.freeze<IShellIntegrationConfigInjection>({
              type: 'injection',
              newArgs: [
                '--init-file',
                `${repoRoot}/out/vs/workbench/contrib/terminal/common/scripts/shellIntegration-bash.sh`
              ],
              envMixin: {
                MINTMIND_INJECTION: '1',
                MINTMIND_SHELL_LOGIN: '1'
              }
            });
            it('when array', async () => {
              deepStrictEqualIgnoreStableVar(await getShellIntegrationInjection({ executable: 'bash', args: ['-l'] }, enabledProcessOptions, defaultEnvironment, logService, productService, true), enabledExpectedResult);
            });
          });
          describe('should not modify args', async () => {
            it('when shell integration is disabled', async () => {
              strictEqual((await getShellIntegrationInjection({ executable: 'bash', args: ['-l'] }, disabledProcessOptions, defaultEnvironment, logService, productService, true)).type, 'failure');
              strictEqual((await getShellIntegrationInjection({ executable: 'bash', args: undefined }, disabledProcessOptions, defaultEnvironment, logService, productService, true)).type, 'failure');
            });
            it('when custom array entry', async () => {
              strictEqual((await getShellIntegrationInjection({ executable: 'bash', args: ['-l', '-i'] }, disabledProcessOptions, defaultEnvironment, logService, productService, true)).type, 'failure');
            });
          });
        });
      });
    }

    describe('custom shell integration nonce', async () => {
      it('should fail for unsupported shell but nonce should still be available', async () => {
        const customProcessOptions: ITerminalProcessOptions = {
          shellIntegration: { enabled: true, suggestEnabled: false, nonce: 'custom-nonce-12345' },
          windowsEnableConpty: true,
          windowsUseConptyDll: false,
          environmentVariableCollections: undefined,
          workspaceFolder: undefined,
          isScreenReaderOptimized: false
        };

        // Test with an unsupported shell (julia)
        const result = await getShellIntegrationInjection(
          { executable: 'julia', args: ['-i'] },
          customProcessOptions,
          defaultEnvironment,
          logService,
          productService,
          true
        );

        // Should fail due to unsupported shell
        strictEqual(result.type, 'failure');

        // But the nonce should be available in the process options for the terminal process to use
        strictEqual(customProcessOptions.shellIntegration.nonce, 'custom-nonce-12345');
      });
    });
  });
});
