#!/usr/bin/env node

/**
 * @fileoverview Configuración alternativa de build con esbuild/swc
 * Sistema de build moderno y declarativo que reemplaza Gulp
 * Mantiene compatibilidad con la funcionalidad existente
 */

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import esbuild from 'esbuild';
import path from 'node:path';
import { glob } from 'glob';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuración declarativa del build
const buildConfig = {
  // Configuración principal de VSCode
  main: {
    entryPoints: [
      'src/main.ts',
      'src/bootstrap.ts',
      'src/bootstrap-cli.ts',
      'src/bootstrap-fork.ts'
    ],
    outdir: 'out',
    platform: 'node',
    target: ['node18'],
    format: 'cjs',
    bundle: false,
    sourcemap: true,
    external: [
      'electron',
      'original-fs',
      '@vscode/spdlog',
      '@vscode/sqlite3',
      '@vscode/deviceid'
    ]
  },

  // Configuración de extensiones comunes
  extensions: {
    entryPoints: await glob('extensions/*/src/extension.ts'),
    outdir: 'extensions-dist',
    platform: 'node',
    target: ['node18'],
    format: 'cjs',
    bundle: false,
    sourcemap: true,
    external: ['vscode']
  },

  // Configuración de webviews con esbuild (ya existente pero centralizada)
  webviews: {
    entryPoints: await glob('extensions/*/notebook/*.ts', {
      ignore: ['**/node_modules/**']
    }),
    outdir: 'webviews-dist',
    platform: 'browser',
    target: ['es2024'],
    format: 'esm',
    bundle: true,
    minify: true,
    sourcemap: false,
    external: ['vscode']
  },

  // Configuración CLI
  cli: {
    entryPoints: ['src/cli.ts'],
    outdir: 'out-cli',
    platform: 'node',
    target: ['node18'],
    format: 'cjs',
    bundle: true,
    minify: false,
    sourcemap: true
  }
};

/**
 * Función de build principal
 * @param {keyof typeof buildConfig} target
 * @param {boolean} watch
 */
async function build(target, watch = false) {
  const config = buildConfig[target];
  if (!config) {
    throw new Error(`Target "${target}" not found in build config`);
  }

  console.log(`🏗️  Building ${target}...`);

  const esbuildConfig = {
    ...config,
    logLevel: 'info',
    color: true,
    metafile: true,
    plugins: [
      {
        name: 'log-build',
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length > 0) {
              console.error(`❌ Build failed for ${target}`);
              return;
            }

            console.log(`✅ Build completed for ${target}`);
            console.log(`📦 Output: ${config.outdir}`);

            // Generar análisis de bundle si es necesario
            if (process.env.ANALYZE_BUNDLE === 'true' && result.metafile) {
              await fs.writeFile(
                `${target}-meta.json`,
                JSON.stringify(result.metafile, null, 2)
              );
            }
          });
        }
      }
    ]
  };

  if (watch) {
    const ctx = await esbuild.context(esbuildConfig);
    await ctx.watch();
    console.log(`👀 Watching ${target} for changes...`);
  } else {
    const result = await esbuild.build(esbuildConfig);
    return result;
  }
}

/**
 * Función de limpieza
 */
async function clean() {
  const dirs = Object.values(buildConfig).map(config => config.outdir);
  const uniqueDirs = [...new Set(dirs)];

  for (const dir of uniqueDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      console.log(`🧹 Cleaned ${dir}`);
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  }
}

/**
 * Función principal
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'build':
    case 'compile': {
      const target = args[1] || 'main';
      const watch = args.includes('--watch') || args.includes('-w');
      await build(target, watch);
      break;
    }

    case 'clean':
      await clean();
      break;

    case 'build-all':
    case 'compile-all': {
      const watch = args.includes('--watch') || args.includes('-w');

      if (watch) {
        // Build all targets in watch mode concurrently
        const promises = Object.keys(buildConfig).map(target =>
          build(target, true)
        );
        await Promise.all(promises);
      } else {
        // Build all targets sequentially
        for (const target of Object.keys(buildConfig)) {
          await build(target, false);
        }
      }
      break;
    }

    default:
      console.log(`
🚀 Configuración alternativa de build con esbuild

Comandos disponibles:
  build [target] [--watch]    Construir target específico (main, extensions, webviews, cli)
  build-all [--watch]         Construir todos los targets
  clean                       Limpiar directorios de salida

Targets disponibles:
  main        - Código principal de VSCode
  extensions  - Extensiones comunes
  webviews    - Webviews de extensiones
  cli         - Herramientas CLI

Ejemplos:
  node esbuild.config.mjs build main
  node esbuild.config.mjs build-all --watch
  node esbuild.config.mjs clean
      `);
      break;
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { buildConfig, build, clean };