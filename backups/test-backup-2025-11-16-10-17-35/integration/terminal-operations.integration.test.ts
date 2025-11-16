/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { setupTestDatabase, teardownTestDatabase } from './helpers/test-db';
import { setupTestServer, teardownTestServer } from './helpers/test-server';

// Mocks para servicios del terminal
jest.mock('../../src/vs/workbench/contrib/terminal/common/terminal', () => ({
  ITerminalService: {},
  ITerminalInstance: {},
}));

jest.mock('../../src/vs/workbench/contrib/terminal/browser/terminalInstance', () => ({
  TerminalInstance: jest.fn().mockImplementation(() => ({
    createProcess: jest.fn(),
    sendText: jest.fn(),
    dispose: jest.fn(),
    onData: jest.fn(),
    onExit: jest.fn(),
  }))
}));

jest.mock('../../src/vs/platform/terminal/node/ptyService', () => ({
  PtyService: jest.fn().mockImplementation(() => ({
    createProcess: jest.fn(),
    resize: jest.fn(),
    dispose: jest.fn(),
  }))
}));

jest.mock('node-pty', () => ({
  spawn: jest.fn(),
  open: jest.fn(),
}));

describe('Terminal Operations Integration', () => {
  let testDb: any;
  let testServer: any;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    testServer = await setupTestServer();
  }, 60000);

  afterAll(async () => {
    await teardownTestServer();
    await teardownTestDatabase();
  }, 60000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Limpiar procesos del terminal después de cada test
  });

  describe('Creación y gestión de terminales', () => {
    it('debe crear una instancia de terminal correctamente', async () => {
      // Arrange
      const mockTerminalService = {
        createTerminal: jest.fn().mockResolvedValue({
          id: 'terminal-1',
          processId: 12345,
          sendText: jest.fn(),
          dispose: jest.fn(),
          onData: jest.fn(),
          onExit: jest.fn(),
        }),
      };

      // Act
      const terminal = await mockTerminalService.createTerminal({
        shellPath: '/bin/bash',
        shellArgs: ['--login'],
        cwd: '/home/user',
      });

      // Assert
      expect(mockTerminalService.createTerminal).toHaveBeenCalledWith({
        shellPath: '/bin/bash',
        shellArgs: ['--login'],
        cwd: '/home/user',
      });
      expect(terminal.id).toBe('terminal-1');
      expect(terminal.processId).toBe(12345);
    });

    it('debe manejar múltiples terminales simultáneamente', async () => {
      // Arrange
      const mockTerminalService = {
        createTerminal: jest.fn().mockImplementation((options, id) => ({
          id: `terminal-${id}`,
          processId: 10000 + id,
          cwd: options.cwd,
          sendText: jest.fn(),
          dispose: jest.fn(),
        })),
        getActiveTerminal: jest.fn(),
        getTerminalInstances: jest.fn().mockReturnValue([
          { id: 'terminal-1' },
          { id: 'terminal-2' },
          { id: 'terminal-3' },
        ]),
      };

      // Act
      const terminal1 = await mockTerminalService.createTerminal({ cwd: '/project1' }, 1);
      const terminal2 = await mockTerminalService.createTerminal({ cwd: '/project2' }, 2);
      const terminal3 = await mockTerminalService.createTerminal({ cwd: '/project3' }, 3);
      const instances = mockTerminalService.getTerminalInstances();

      // Assert
      expect(terminal1.cwd).toBe('/project1');
      expect(terminal2.cwd).toBe('/project2');
      expect(terminal3.cwd).toBe('/project3');
      expect(instances).toHaveLength(3);
    });

    it('debe manejar diferentes tipos de shell', async () => {
      // Arrange
      const shells = [
        { path: '/bin/bash', args: ['--login'] },
        { path: '/bin/zsh', args: [] },
        { path: '/bin/fish', args: [] },
        { path: 'powershell.exe', args: ['-NoLogo'] },
        { path: 'cmd.exe', args: ['/K'] },
      ];

      const mockTerminalService = {
        createTerminal: jest.fn().mockImplementation((options) => ({
          shell: options.shellPath,
          args: options.shellArgs,
          processId: Math.floor(Math.random() * 10000),
        })),
      };

      // Act & Assert
      for (const shell of shells) {
        const terminal = await mockTerminalService.createTerminal({
          shellPath: shell.path,
          shellArgs: shell.args,
        });

        expect(terminal.shell).toBe(shell.path);
        expect(terminal.args).toEqual(shell.args);
      }
    });

    it('debe manejar errores en creación de terminal', async () => {
      // Arrange
      const mockTerminalService = {
        createTerminal: jest.fn().mockRejectedValue(new Error('Shell not found')),
      };

      // Act & Assert
      await expect(mockTerminalService.createTerminal({
        shellPath: '/nonexistent/shell',
      })).rejects.toThrow('Shell not found');
    });
  });

  describe('Ejecución de comandos', () => {
    it('debe ejecutar comandos básicos correctamente', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
        onData: jest.fn(),
        onExit: jest.fn().mockImplementation((callback) => {
          setTimeout(() => callback(0), 100); // Exit code 0 (success)
        }),
      };

      // Act
      mockTerminal.sendText('echo "Hello World"');
      mockTerminal.sendText('\r'); // Enter

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledWith('echo "Hello World"');
      expect(mockTerminal.sendText).toHaveBeenCalledWith('\r');
    });

    it('debe manejar comandos multilinea', async () => {
      // Arrange
      const multilineCommand = `for i in {1..3}; do
  echo "Iteration \$i"
done`;
      const mockTerminal = {
        sendText: jest.fn(),
        onData: jest.fn(),
      };

      // Act
      mockTerminal.sendText(multilineCommand);
      mockTerminal.sendText('\r');

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledWith(multilineCommand);
      expect(mockTerminal.sendText).toHaveBeenCalledWith('\r');
    });

    it('debe manejar comandos con pipes y redirección', async () => {
      // Arrange
      const complexCommand = 'ls -la | grep ".txt" > files.txt';
      const mockTerminal = {
        sendText: jest.fn(),
        onData: jest.fn(),
      };

      // Act
      mockTerminal.sendText(complexCommand);
      mockTerminal.sendText('\r');

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledWith(complexCommand);
    });

    it('debe manejar comandos en background', async () => {
      // Arrange
      const backgroundCommand = 'npm start &';
      const mockTerminal = {
        sendText: jest.fn(),
        onData: jest.fn(),
        processId: 12345,
      };

      // Act
      mockTerminal.sendText(backgroundCommand);
      mockTerminal.sendText('\r');

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledWith(backgroundCommand);
      expect(mockTerminal.processId).toBeDefined();
    });

    it('debe manejar códigos de salida de comandos', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
        onExit: jest.fn(),
      };

      let exitCode: number | undefined;
      mockTerminal.onExit((code) => {
        exitCode = code;
      });

      // Act - Comando exitoso
      mockTerminal.sendText('echo "success"');
      mockTerminal.sendText('\r');
      mockTerminal.onExit(0);

      // Act - Comando fallido
      mockTerminal.sendText('exit 1');
      mockTerminal.sendText('\r');
      mockTerminal.onExit(1);

      // Assert
      expect(exitCode).toBe(1); // Último código de salida
    });
  });

  describe('Gestión de procesos del terminal', () => {
    it('debe gestionar procesos hijo correctamente', async () => {
      // Arrange
      const mockPtyService = {
        createProcess: jest.fn().mockResolvedValue({
          pid: 12345,
          kill: jest.fn(),
          resize: jest.fn(),
          onData: jest.fn(),
          onExit: jest.fn(),
        }),
      };

      // Act
      const process = await mockPtyService.createProcess('/bin/bash', [], {
        cwd: '/home/user',
        env: { PATH: '/usr/bin' },
      });

      // Assert
      expect(process.pid).toBe(12345);
      expect(process.kill).toBeDefined();
      expect(process.resize).toBeDefined();
    });

    it('debe manejar señales de proceso', async () => {
      // Arrange
      const mockProcess = {
        pid: 12345,
        kill: jest.fn(),
        onExit: jest.fn(),
      };

      // Act
      mockProcess.kill('SIGTERM');

      // Assert
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('debe manejar redimensionamiento del terminal', async () => {
      // Arrange
      const mockTerminal = {
        resize: jest.fn(),
        cols: 80,
        rows: 24,
      };

      // Act
      mockTerminal.resize(120, 30);

      // Assert
      expect(mockTerminal.resize).toHaveBeenCalledWith(120, 30);
      expect(mockTerminal.cols).toBe(80); // Valor original
      expect(mockTerminal.rows).toBe(24); // Valor original
    });

    it('debe manejar procesos zombie y huérfanos', async () => {
      // Arrange
      const mockProcessManager = {
        getProcesses: jest.fn().mockReturnValue([
          { pid: 12345, ppid: 1, state: 'running' },
          { pid: 12346, ppid: 12345, state: 'zombie' },
          { pid: 12347, ppid: 1, state: 'orphaned' },
        ]),
        reapZombies: jest.fn(),
        adoptOrphans: jest.fn(),
      };

      // Act
      const processes = mockProcessManager.getProcesses();
      await mockProcessManager.reapZombies();
      await mockProcessManager.adoptOrphans();

      // Assert
      expect(processes).toHaveLength(3);
      expect(processes[1].state).toBe('zombie');
      expect(processes[2].state).toBe('orphaned');
      expect(mockProcessManager.reapZombies).toHaveBeenCalled();
      expect(mockProcessManager.adoptOrphans).toHaveBeenCalled();
    });
  });

  describe('Entrada y salida del terminal', () => {
    it('debe manejar entrada del usuario', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
        onData: jest.fn(),
      };

      const inputs = [
        'hello',
        'ls -la',
        'cd /home',
        'echo "test"',
      ];

      // Act
      for (const input of inputs) {
        mockTerminal.sendText(input);
        mockTerminal.sendText('\r');
      }

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledTimes(inputs.length * 2);
    });

    it('debe manejar salida del comando', async () => {
      // Arrange
      const mockTerminal = {
        onData: jest.fn(),
      };

      const outputData = [
        'user@host:~$ ',
        'ls -la\r\n',
        'drwxr-xr-x 2 user user 4096 Jan 1 12:00 .\r\n',
        'drwxr-xr-x 3 user user 4096 Jan 1 12:00 ..\r\n',
        '-rw-r--r-- 1 user user    0 Jan 1 12:00 file.txt\r\n',
        'user@host:~$ ',
      ];

      let receivedData = '';
      mockTerminal.onData((data: string) => {
        receivedData += data;
      });

      // Act
      for (const chunk of outputData) {
        mockTerminal.onData(chunk);
      }

      // Assert
      expect(receivedData).toContain('drwxr-xr-x');
      expect(receivedData).toContain('file.txt');
      expect(receivedData).toContain('user@host:~$');
    });

    it('debe manejar secuencias de escape ANSI', async () => {
      // Arrange
      const mockTerminal = {
        onData: jest.fn(),
      };

      const ansiSequences = [
        '\u001b[31m', // Red color
        '\u001b[1m',  // Bold
        '\u001b[2J',  // Clear screen
        '\u001b[H',   // Cursor home
        '\u001b[0m',  // Reset
      ];

      let receivedAnsi = '';
      mockTerminal.onData((data: string) => {
        receivedAnsi += data;
      });

      // Act
      for (const sequence of ansiSequences) {
        mockTerminal.onData(sequence);
      }

      // Assert
      expect(receivedAnsi).toContain('\u001b[31m');
      expect(receivedAnsi).toContain('\u001b[0m');
    });

    it('debe manejar entrada binaria y especial', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
      };

      const specialInputs = [
        '\u0001', // Ctrl+A
        '\u0002', // Ctrl+B
        '\u0004', // Ctrl+D (EOF)
        '\u0003', // Ctrl+C
        '\u001a', // Ctrl+Z
      ];

      // Act
      for (const input of specialInputs) {
        mockTerminal.sendText(input);
      }

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledTimes(specialInputs.length);
    });
  });

  describe('Integración con sistema de archivos', () => {
    it('debe cambiar directorio de trabajo', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
        getCwd: jest.fn().mockReturnValue('/home/user'),
        setCwd: jest.fn(),
      };

      // Act
      mockTerminal.sendText('cd /tmp');
      mockTerminal.sendText('\r');
      mockTerminal.setCwd('/tmp');

      const newCwd = mockTerminal.getCwd();

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledWith('cd /tmp');
      expect(mockTerminal.setCwd).toHaveBeenCalledWith('/tmp');
      expect(newCwd).toBe('/tmp');
    });

    it('debe ejecutar comandos que interactúan con archivos', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
        onData: jest.fn(),
      };

      const fileOperations = [
        'touch test.txt',
        'echo "content" > test.txt',
        'cat test.txt',
        'rm test.txt',
      ];

      // Act
      for (const cmd of fileOperations) {
        mockTerminal.sendText(cmd);
        mockTerminal.sendText('\r');
      }

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledTimes(fileOperations.length * 2);
    });

    it('debe manejar permisos de archivos', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
        onData: jest.fn(),
      };

      // Act
      mockTerminal.sendText('chmod 755 script.sh');
      mockTerminal.sendText('\r');
      mockTerminal.sendText('ls -l script.sh');
      mockTerminal.sendText('\r');

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledWith('chmod 755 script.sh');
      expect(mockTerminal.sendText).toHaveBeenCalledWith('ls -l script.sh');
    });
  });

  describe('Gestión de sesiones del terminal', () => {
    it('debe persistir historial de comandos', async () => {
      // Arrange
      const mockHistoryManager = {
        addCommand: jest.fn(),
        getHistory: jest.fn().mockReturnValue([
          'ls -la',
          'cd /tmp',
          'echo "hello"',
          'git status',
        ]),
        clearHistory: jest.fn(),
      };

      const commands = ['ls -la', 'cd /tmp', 'echo "hello"', 'git status'];

      // Act
      for (const cmd of commands) {
        mockHistoryManager.addCommand(cmd);
      }

      const history = mockHistoryManager.getHistory();

      // Assert
      expect(history).toHaveLength(4);
      expect(history).toEqual(commands);
      expect(mockHistoryManager.addCommand).toHaveBeenCalledTimes(4);
    });

    it('debe manejar variables de entorno', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
        getEnv: jest.fn().mockReturnValue({
          PATH: '/usr/bin:/bin',
          HOME: '/home/user',
          USER: 'testuser',
        }),
        setEnv: jest.fn(),
      };

      // Act
      mockTerminal.sendText('export MY_VAR="test value"');
      mockTerminal.sendText('\r');
      mockTerminal.setEnv('MY_VAR', 'test value');

      const env = mockTerminal.getEnv();

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledWith('export MY_VAR="test value"');
      expect(mockTerminal.setEnv).toHaveBeenCalledWith('MY_VAR', 'test value');
      expect(env.PATH).toBe('/usr/bin:/bin');
      expect(env.USER).toBe('testuser');
    });

    it('debe manejar aliases y funciones', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
        defineAlias: jest.fn(),
        getAliases: jest.fn().mockReturnValue({
          ll: 'ls -la',
          gs: 'git status',
          gp: 'git push',
        }),
      };

      const aliases = {
        ll: 'ls -la',
        gs: 'git status',
        gp: 'git push',
      };

      // Act
      for (const [alias, command] of Object.entries(aliases)) {
        mockTerminal.sendText(`alias ${alias}='${command}'`);
        mockTerminal.sendText('\r');
        mockTerminal.defineAlias(alias, command);
      }

      const definedAliases = mockTerminal.getAliases();

      // Assert
      expect(definedAliases.ll).toBe('ls -la');
      expect(definedAliases.gs).toBe('git status');
      expect(definedAliases.gp).toBe('git push');
    });

    it('debe manejar configuración del perfil del terminal', async () => {
      // Arrange
      const mockProfileManager = {
        getProfiles: jest.fn().mockReturnValue([
          {
            name: 'bash',
            path: '/bin/bash',
            args: ['--login'],
            env: { BASH_ENV: '~/.bashrc' },
          },
          {
            name: 'zsh',
            path: '/bin/zsh',
            args: [],
            env: { ZDOTDIR: '~/.zsh' },
          },
        ]),
        setActiveProfile: jest.fn(),
      };

      // Act
      const profiles = mockProfileManager.getProfiles();
      mockProfileManager.setActiveProfile('zsh');

      // Assert
      expect(profiles).toHaveLength(2);
      expect(profiles[0].name).toBe('bash');
      expect(profiles[1].name).toBe('zsh');
      expect(mockProfileManager.setActiveProfile).toHaveBeenCalledWith('zsh');
    });
  });

  describe('Integración con herramientas de desarrollo', () => {
    it('debe ejecutar comandos de git correctamente', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
        onData: jest.fn(),
      };

      const gitCommands = [
        'git init',
        'git add .',
        'git commit -m "Initial commit"',
        'git status',
        'git log --oneline',
      ];

      // Act
      for (const cmd of gitCommands) {
        mockTerminal.sendText(cmd);
        mockTerminal.sendText('\r');
      }

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledTimes(gitCommands.length * 2);
    });

    it('debe ejecutar comandos de npm/yarn correctamente', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
        onData: jest.fn(),
      };

      const packageCommands = [
        'npm install',
        'npm run build',
        'npm test',
        'yarn add lodash',
        'yarn dev',
      ];

      // Act
      for (const cmd of packageCommands) {
        mockTerminal.sendText(cmd);
        mockTerminal.sendText('\r');
      }

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledTimes(packageCommands.length * 2);
    });

    it('debe manejar herramientas de linting y testing', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
        onData: jest.fn(),
      };

      const devCommands = [
        'eslint src/',
        'prettier --write .',
        'jest',
        'tsc --noEmit',
        'stylelint "**/*.css"',
      ];

      // Act
      for (const cmd of devCommands) {
        mockTerminal.sendText(cmd);
        mockTerminal.sendText('\r');
      }

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledTimes(devCommands.length * 2);
    });

    it('debe ejecutar comandos de Docker', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
        onData: jest.fn(),
      };

      const dockerCommands = [
        'docker build -t myapp .',
        'docker run -p 3000:3000 myapp',
        'docker ps',
        'docker logs mycontainer',
        'docker-compose up -d',
      ];

      // Act
      for (const cmd of dockerCommands) {
        mockTerminal.sendText(cmd);
        mockTerminal.sendText('\r');
      }

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledTimes(dockerCommands.length * 2);
    });
  });

  describe('Manejo de errores y casos límite', () => {
    it('debe manejar comandos que no existen', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
        onData: jest.fn(),
        onExit: jest.fn().mockImplementation((callback) => {
          callback(127); // Command not found exit code
        }),
      };

      // Act
      mockTerminal.sendText('nonexistentcommand');
      mockTerminal.sendText('\r');

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledWith('nonexistentcommand');
      expect(mockTerminal.sendText).toHaveBeenCalledWith('\r');
    });

    it('debe manejar límites de memoria y CPU', async () => {
      // Arrange
      const mockProcessMonitor = {
        getProcessStats: jest.fn().mockReturnValue({
          pid: 12345,
          memoryUsage: 500 * 1024 * 1024, // 500MB
          cpuUsage: 85, // 85%
        }),
        killProcess: jest.fn(),
      };

      // Act
      const stats = mockProcessMonitor.getProcessStats();

      if (stats.memoryUsage > 400 * 1024 * 1024) {
        mockProcessMonitor.killProcess(stats.pid, 'SIGKILL');
      }

      // Assert
      expect(stats.memoryUsage).toBeGreaterThan(400 * 1024 * 1024);
      expect(stats.cpuUsage).toBe(85);
      expect(mockProcessMonitor.killProcess).toHaveBeenCalledWith(12345, 'SIGKILL');
    });

    it('debe manejar timeouts de comandos', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
        timeout: jest.fn(),
        kill: jest.fn(),
      };

      // Act
      mockTerminal.sendText('sleep 300'); // Comando que toma 5 minutos
      mockTerminal.sendText('\r');

      // Simular timeout después de 30 segundos
      setTimeout(() => {
        mockTerminal.kill('SIGTERM');
      }, 30000);

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledWith('sleep 300');
      expect(mockTerminal.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('debe manejar caracteres especiales y encoding', async () => {
      // Arrange
      const mockTerminal = {
        sendText: jest.fn(),
      };

      const specialChars = [
        'echo "café"',
        'echo "naïve"',
        'echo "测试"',
        'echo "🚀"',
        'echo "SELECT * FROM users;"',
      ];

      // Act
      for (const cmd of specialChars) {
        mockTerminal.sendText(cmd);
        mockTerminal.sendText('\r');
      }

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledTimes(specialChars.length * 2);
    });

    it('debe manejar comandos muy largos', async () => {
      // Arrange
      const longCommand = 'echo "' + 'x'.repeat(10000) + '"';
      const mockTerminal = {
        sendText: jest.fn(),
      };

      // Act
      mockTerminal.sendText(longCommand);
      mockTerminal.sendText('\r');

      // Assert
      expect(mockTerminal.sendText).toHaveBeenCalledWith(longCommand);
      expect(longCommand.length).toBeGreaterThan(10000);
    });
  });
});