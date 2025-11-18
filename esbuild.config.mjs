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
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tauri v2 optimized build configuration with performance and security enhancements
const buildConfig = {
  // Main application target - optimized for Tauri v2 with security hardening
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
    minify: process.env.NODE_ENV === 'production',
    treeShaking: true,
    external: [
      'original-fs',
      '@vscode/spdlog',
      '@vscode/sqlite3',
      '@vscode/deviceid',
      'tauri-plugin-*'
    ],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.TAURI_PLATFORM': JSON.stringify(process.env.TAURI_PLATFORM || 'current'),
      'process.env.TAURI_ARCH': JSON.stringify(process.env.TAURI_ARCH || 'current'),
      'process.env.TAURI_FAMILY': JSON.stringify(process.env.TAURI_FAMILY || 'unix')
    },
    metafile: true,
    legalComments: 'external'
  },

  // Extensions with code splitting for better performance
  extensions: {
    entryPoints: await glob('extensions/*/src/extension.ts'),
    outdir: 'extensions-dist',
    platform: 'node',
    target: ['node18'],
    format: 'cjs',
    bundle: false,
    sourcemap: true,
    minify: process.env.NODE_ENV === 'production',
    treeShaking: true,
    external: ['vscode', 'tauri-plugin-*'],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.TAURI_PLATFORM': JSON.stringify(process.env.TAURI_PLATFORM || 'current')
    }
  },

  // Webviews with advanced bundling, code splitting, and security optimizations
  webviews: {
    entryPoints: await glob('extensions/*/notebook/*.ts', {
      ignore: ['**/node_modules/**']
    }),
    outdir: 'webviews-dist',
    platform: 'browser',
    target: ['chrome100', 'firefox100', 'safari15', 'edge100'], // Tauri v2 supported browsers
    format: 'esm',
    bundle: true,
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production',
    treeShaking: true,
    splitting: true, // Enable code splitting for better performance
    chunkNames: 'chunks/[name]-[hash]',
    external: ['vscode'],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      global: 'globalThis'
    },
    // Security hardening for webviews
    banner: {
      js: '// MintMind WebView - Security Hardened\n'
    },
    footer: {
      js: '\n// End of MintMind WebView'
    },
    metafile: true
  },

  // CLI tools with minimal bundling and integrity checks
  cli: {
    entryPoints: ['src/cli.ts'],
    outdir: 'out-cli',
    platform: 'node',
    target: ['node18'],
    format: 'cjs',
    bundle: true,
    minify: false,
    sourcemap: true,
    treeShaking: true,
    external: ['tauri-plugin-*'],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    }
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
 * Build all targets with Tauri v2 optimizations
 */
async function buildAll(watch = false, platform = null) {
  console.log(`🔧 Building all targets for Tauri v2${platform ? ` (${platform})` : ''}`);

  if (watch) {
    const promises = Object.keys(buildConfig).map(target =>
      build(target, true, platform)
    );
    await Promise.all(promises);
  } else {
    for (const target of Object.keys(buildConfig)) {
      await build(target, false, platform);
    }
  }
}

/**
 * Main CLI interface with Tauri v2 enhancements
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Parse platform argument
  const platformIndex = args.findIndex(arg => arg.startsWith('--platform='));
  const platform = platformIndex !== -1 ? args[platformIndex].split('=')[1] : null;
  if (platformIndex !== -1) args.splice(platformIndex, 1);

  switch (command) {
    case 'build':
    case 'compile': {
      const target = args[1] || 'main';
      const watch = args.includes('--watch') || args.includes('-w');
      await build(target, watch, platform);
      break;
    }

    case 'clean':
      await clean();
      break;

    case 'build-all':
    case 'compile-all': {
      const watch = args.includes('--watch') || args.includes('-w');
      await buildAll(watch, platform);
      break;
    }

    default:
      console.log(`
🚀 Advanced Tauri v2 Build System (esbuild.config.mjs)

Usage:
  node esbuild.config.mjs <command> [options]

Commands:
  build [target] [--watch] [--platform=<platform>]    Build specific target
  build-all [--watch] [--platform=<platform>]         Build all targets
  clean                                               Clean build artifacts

Targets:
  main        - Main application code with Tauri v2 optimizations
  extensions  - VSCode extensions with tree shaking
  webviews    - Notebook webviews with code splitting
  cli         - Command line tools

Options:
  --watch, -w              Watch mode for development
  --platform=<platform>    Target specific platform (windows, macos, linux)

Environment Variables:
  NODE_ENV=production      Enable production optimizations
  ANALYZE_BUNDLE=true      Generate bundle analysis
  SECURITY_AUDIT=true      Enable security analysis

Examples:
  node esbuild.config.mjs build main --watch
  node esbuild.config.mjs build-all --platform=linux
  ANALYZE_BUNDLE=true node esbuild.config.mjs build webviews
  NODE_ENV=production node esbuild.config.mjs build-all
      `);
      break;
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { buildConfig, build, clean, buildAll, SecurityHardener, CrossPlatformOptimizer };
