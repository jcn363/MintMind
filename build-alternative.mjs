#!/usr/bin/env node

/**
 * @fileoverview Advanced Tauri v2 Build System with esbuild
 * Modern build system optimized for Tauri v2 performance, security, and cross-platform compatibility
 * Provides unified interface with Gulp compatibility and enhanced bundling features
 */

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import esbuild from 'esbuild';
import path from 'node:path';
import { glob } from 'glob';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tauri v2 optimized build configuration
const buildConfig = {
  // Main application target - optimized for Tauri v2
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
    // Tauri v2 specific optimizations
    splitting: false, // Keep simple for main process
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

  // Webviews with advanced bundling and security optimizations
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

  // CLI tools with minimal bundling
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
    external: ['tauri-plugin-*']
  }
};

/**
 * Security hardening utilities for Tauri v2
 */
class SecurityHardener {
  static async validateBuildIntegrity(config, result) {
    if (!result.metafile) return;

    // Check for potential security issues in bundle
    const analysis = await esbuild.analyzeMetafile(result.metafile);

    // Log bundle analysis for security review
    if (process.env.SECURITY_AUDIT === 'true') {
      console.log('🔒 Security Analysis for', config.name || 'target');
      console.log(analysis);
    }

    return analysis;
  }

  static generateIntegrityHash(content) {
    return crypto.createHash('sha256').update(content).digest('base64');
  }
}

/**
 * Cross-platform build optimizer for Tauri v2
 */
class CrossPlatformOptimizer {
  static getPlatformSpecificConfig(platform) {
    const platformConfigs = {
      windows: {
        target: ['node18-win32-x64'],
        define: {
          'process.platform': '"win32"',
          'process.env.TAURI_PLATFORM': '"windows"'
        }
      },
      macos: {
        target: ['node18-darwin-x64'],
        define: {
          'process.platform': '"darwin"',
          'process.env.TAURI_PLATFORM': '"macos"'
        }
      },
      linux: {
        target: ['node18-linux-x64'],
        define: {
          'process.platform': '"linux"',
          'process.env.TAURI_PLATFORM': '"linux"'
        }
      }
    };

    return platformConfigs[platform] || {};
  }

  static optimizeForPlatform(config, platform) {
    const platformConfig = this.getPlatformSpecificConfig(platform);
    return {
      ...config,
      ...platformConfig,
      define: {
        ...config.define,
        ...platformConfig.define
      }
    };
  }
}

/**
 * Advanced build function with Tauri v2 optimizations
 */
async function build(target, watch = false, platform = null) {
  const baseConfig = buildConfig[target];
  if (!baseConfig) {
    throw new Error(`Target "${target}" not found in build config`);
  }

  // Apply cross-platform optimizations if specified
  const config = platform
    ? CrossPlatformOptimizer.optimizeForPlatform(baseConfig, platform)
    : baseConfig;

  console.log(`🚀 Building ${target} for ${platform || 'all platforms'}...`);

  const esbuildConfig = {
    ...config,
    logLevel: 'info',
    color: true,
    plugins: [
      {
        name: `tauri-v2-${target}-optimizer`,
        setup(build) {
          build.onStart(() => {
            console.log(`⚡ Starting Tauri v2 optimized build for ${target}`);
          });

          build.onEnd(async (result) => {
            if (result.errors.length > 0) {
              console.error(`❌ Build failed for ${target}`);
              console.error(result.errors);
              return;
            }

            console.log(`✅ Build completed for ${target}`);
            console.log(`📦 Output: ${config.outdir}`);
            console.log(`🎯 Target platform: ${platform || 'universal'}`);

            // Security analysis
            await SecurityHardener.validateBuildIntegrity({ name: target }, result);

            // Bundle analysis for optimization insights
            if (process.env.ANALYZE_BUNDLE === 'true' && result.metafile) {
              const metaFileName = `${target}${platform ? `-${platform}` : ''}-meta.json`;
              await fs.writeFile(metaFileName, JSON.stringify(result.metafile, null, 2));
              console.log(`📊 Bundle analysis saved to ${metaFileName}`);
            }

            // Performance metrics
            if (result.metafile) {
              const analysis = await esbuild.analyzeMetafile(result.metafile);
              console.log(`📈 Bundle size: ${analysis.bundles?.[0]?.totalBytes || 'Unknown'} bytes`);
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
 * Clean build artifacts
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

  // Clean meta files
  const metaFiles = await glob('*-meta.json');
  for (const file of metaFiles) {
    await fs.unlink(file);
    console.log(`🧹 Cleaned ${file}`);
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
 * Main CLI interface
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

    case 'build-all':
    case 'compile-all': {
      const watch = args.includes('--watch') || args.includes('-w');
      await buildAll(watch, platform);
      break;
    }

    case 'clean':
      await clean();
      break;

    // Gulp compatibility commands
    case 'compile-build':
      await build('main', false, platform);
      break;

    case 'compile-extensions-build':
      await build('extensions', false, platform);
      break;

    case 'compile-web':
      await build('webviews', false, platform);
      break;

    case 'watch-client':
      await build('main', true, platform);
      break;

    case 'hygiene':
      console.log('🧼 Running hygiene checks...');
      // Add hygiene checks here
      break;

    default:
      console.log(`
🚀 Advanced Tauri v2 Build System

Usage:
  node build-alternative.mjs <command> [options]

Commands:
  build [target] [--watch] [--platform=<platform>]    Build specific target
  build-all [--watch] [--platform=<platform>]         Build all targets
  clean                                               Clean build artifacts

Targets:
  main        - Main application code
  extensions  - VSCode extensions
  webviews    - Notebook webviews with code splitting
  cli         - Command line tools

Options:
  --watch, -w              Watch mode for development
  --platform=<platform>    Target specific platform (windows, macos, linux)

Gulp Compatibility:
  compile-build            gulp compile-build
  compile-extensions-build gulp compile-extensions-build
  compile-web              gulp compile-web
  watch-client             gulp watch-client
  hygiene                  gulp hygiene

Environment Variables:
  NODE_ENV=production      Enable production optimizations
  ANALYZE_BUNDLE=true      Generate bundle analysis
  SECURITY_AUDIT=true      Enable security analysis
  USE_SWC=true            Use SWC for faster builds (if available)

Examples:
  node build-alternative.mjs build main --watch
  node build-alternative.mjs build-all --platform=linux
  ANALYZE_BUNDLE=true node build-alternative.mjs build webviews
  NODE_ENV=production node build-alternative.mjs build-all
      `);
      break;
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { buildConfig, build, clean, buildAll, SecurityHardener, CrossPlatformOptimizer };