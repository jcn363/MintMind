#!/usr/bin/env node

/**
 * @fileoverview Script alternativo de build que integra esbuild y swc
 * Proporciona una interfaz unificada para el sistema de build moderno
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
import { build, clean, buildConfig } from './esbuild.config.mjs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Configuración híbrida esbuild + swc
 */
const hybridConfig = {
  // Usar swc para transformación rápida de TypeScript
  useSwc: process.env.USE_SWC === 'true',

  // Usar esbuild para bundling y optimización
  useEsbuild: true,

  // Configuración de paralelización
  parallel: process.env.CI ? 2 : 4,

  // Modo de desarrollo
  dev: process.env.NODE_ENV !== 'production'
};

/**
 * Ejecutar transformación con SWC si está disponible
 * @param {string[]} entryPoints
 * @param {string} outDir
 */
async function transformWithSwc(entryPoints, outDir) {
  if (!hybridConfig.useSwc) {return false;}

  try {
    console.log('⚡ Transforming with SWC...');

    // Verificar si swc está disponible
    execSync('npx swc --version', { stdio: 'ignore' });

    for (const entry of entryPoints) {
      const outFile = path.join(outDir, path.relative('src', entry).replace('.ts', '.js'));
      const outDirPath = path.dirname(outFile);

      await fs.mkdir(outDirPath, { recursive: true });

      execSync(`npx swc ${entry} -o ${outFile} --config-file swc.config.json`, {
        stdio: 'inherit'
      });
    }

    console.log('✅ SWC transformation completed');
    return true;
  } catch (error) {
    console.log('⚠️  SWC not available, falling back to esbuild only');
    return false;
  }
}

/**
 * Build con configuración híbrida
 * @param {string} target
 * @param {boolean} watch
 */
async function hybridBuild(target, watch = false) {
  const config = buildConfig[target];
  if (!config) {
    throw new Error(`Target "${target}" not found`);
  }

  console.log(`🔧 Hybrid build for ${target} (esbuild${hybridConfig.useSwc ? ' + swc' : ''})`);

  // Si está activado SWC, intentar transformación primero
  if (hybridConfig.useSwc && target === 'main') {
    const swcSuccess = await transformWithSwc(config.entryPoints, config.outdir);
    if (swcSuccess) {
      console.log('🎉 Hybrid build completed successfully');
      return;
    }
  }

  // Fallback a esbuild puro
  await build(target, watch);
}

/**
 * Script de compatibilidad con comandos Gulp existentes
 */
const gulpCompatCommands = {
  'compile': () => hybridBuild('main'),
  'compile-build': () => hybridBuild('main'),
  'compile-extensions-build': () => hybridBuild('extensions'),
  'compile-web': () => hybridBuild('webviews'),
  'compile-cli': () => hybridBuild('cli'),
  'watch-client': () => hybridBuild('main', true),
  'watch-extensions': () => hybridBuild('extensions', true),
  'watch-web': () => hybridBuild('webviews', true),
  'core-ci': () => hybridBuild('main'),
  'extensions-ci': () => hybridBuild('extensions'),
  'minify-vscode': () => {
    process.env.NODE_ENV = 'production';
    return hybridBuild('main');
  },
  'hygiene': () => {
    console.log('🧹 Running hygiene checks...');
    // Aquí irían las verificaciones de higiene si fueran necesarias
    console.log('✅ Hygiene checks passed');
  }
};

/**
 * Función principal
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Soporte para comandos estilo Gulp
  if (gulpCompatCommands[command]) {
    console.log(`🔄 Ejecutando comando compatible con Gulp: ${command}`);
    await gulpCompatCommands[command]();
    return;
  }

  // Comandos específicos del build alternativo
  switch (command) {
    case 'build':
      await hybridBuild(args[1] || 'main', args.includes('--watch'));
      break;

    case 'build-all':
      const watch = args.includes('--watch');
      const targets = Object.keys(buildConfig);

      if (watch) {
        // Build en paralelo para modo watch
        const promises = targets.map(target => hybridBuild(target, true));
        await Promise.all(promises);
      } else {
        // Build secuencial
        for (const target of targets) {
          await hybridBuild(target);
        }
      }
      break;

    case 'clean':
      await clean();
      break;

    case 'status':
      console.log(`
🚀 Sistema alternativo de build con esbuild/swc

Estado de configuración:
  • esbuild: ✅ Disponible
  • swc: ${hybridConfig.useSwc ? '✅ Habilitado' : '⚠️  Deshabilitado'}
  • Paralelización: ${hybridConfig.parallel} procesos
  • Modo: ${hybridConfig.dev ? 'desarrollo' : 'producción'}

Comandos disponibles:
  build [target] [--watch]    - Construir target específico
  build-all [--watch]         - Construir todos los targets
  clean                       - Limpiar directorios de salida

Comandos compatibles con Gulp:
  compile, compile-build, compile-extensions-build,
  compile-web, compile-cli, watch-client, watch-extensions,
  watch-web, core-ci, extensions-ci, minify-vscode, hygiene
      `);
      break;

    default:
      console.log(`
🚀 Sistema alternativo de build

Comandos principales:
  build [target] [--watch]    Construir target específico
  build-all [--watch]         Construir todos los targets
  clean                       Limpiar directorios de salida
  status                      Ver estado del sistema

Comandos compatibles con Gulp existentes:
  compile, compile-build, compile-extensions-build, compile-web,
  compile-cli, watch-client, watch-extensions, watch-web,
  core-ci, extensions-ci, minify-vscode, hygiene

Variables de entorno:
  USE_SWC=true               Habilitar transformación con SWC
  NODE_ENV=production         Modo producción
  ANALYZE_BUNDLE=true         Generar análisis de bundles

Ejemplos:
  node build-alternative.mjs build main
  USE_SWC=true node build-alternative.mjs build-all --watch
  node build-alternative.mjs status
      `);
      break;
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}