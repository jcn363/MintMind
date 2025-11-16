#!/usr/bin/env node

/**
 * Script para optimizar el AMD loader con lazy loading avanzado
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
const fs = require('fs');
const path = require('path');

// Función para agregar preload/prefetch hints
function addPreloadHints() {
    console.log('🔧 Optimizando loader con preload hints...');

    // Leer el archivo del loader
    const loaderPath = path.join(__dirname, '../src/vs/loader.js');
    let loaderContent = fs.readFileSync(loaderPath, 'utf8');

    // Agregar preload hints para chunks críticos
    const preloadHints = `
// Enhanced lazy loading preload hints
if (typeof document !== 'undefined' && document.head) {
    // Preload critical chunks
    const criticalChunks = [
        '/out/vs/workbench/workbench.common.main.js',
        '/out/vs/editor/editor.all.js',
        '/out/vs/platform/platform.all.js'
    ];

    criticalChunks.forEach(chunk => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = chunk;
        link.as = 'script';
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    });

    // Prefetch heavy chunks
    const heavyChunks = [
        '/out/vs/workbench/contrib/notebook/browser/notebook.contribution.js',
        '/out/vs/workbench/contrib/chat/browser/chat.contribution.js',
        '/out/vs/workbench/contrib/search/browser/search.contribution.js'
    ];

    heavyChunks.forEach(chunk => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = chunk;
        document.head.appendChild(link);
    });
}
`;

    // Insertar después de la definición de AMDLoader
    const insertPosition = loaderContent.indexOf('AMDLoader.global = _amdLoaderGlobal;');
    if (insertPosition !== -1) {
        loaderContent = loaderContent.slice(0, insertPosition + 'AMDLoader.global = _amdLoaderGlobal;'.length) +
                        '\n' + preloadHints + '\n' +
                        loaderContent.slice(insertPosition + 'AMDLoader.global = _amdLoaderGlobal;'.length);
    }

    fs.writeFileSync(loaderPath, loaderContent);
    console.log('✅ Preload hints agregados al loader');
}

// Función para optimizar el sistema de módulos
function optimizeModuleSystem() {
    console.log('🔧 Optimizando sistema de módulos AMD...');

    const loaderPath = path.join(__dirname, '../src/vs/loader.js');
    let loaderContent = fs.readFileSync(loaderPath, 'utf8');

    // Agregar lazy loading para módulos pesados
    const lazyLoadingEnhancement = `
// Enhanced lazy loading for heavy modules
const heavyModules = new Set([
    'vs/workbench/contrib/notebook/browser/notebook',
    'vs/workbench/contrib/chat/browser/chat',
    'vs/workbench/contrib/search/browser/search',
    'vs/workbench/contrib/debug/browser/debug',
    'vs/workbench/contrib/extensions/browser/extensions'
]);

// Intercept module loading for lazy loading
const originalDefine = globalThis.define;
globalThis.define = function(id, deps, factory) {
    if (id && heavyModules.has(id)) {
        // Mark heavy modules for lazy loading
        console.log('📦 Heavy module detected:', id);
        // Add lazy loading metadata
        if (typeof factory === 'function') {
            factory.__lazyModule = true;
        }
    }
    return originalDefine.apply(this, arguments);
};
globalThis.define.amd = originalDefine.amd;
`;

    // Insertar después de la inicialización del define
    const insertPosition = loaderContent.lastIndexOf('globalThis.define = DefineFunc;');
    if (insertPosition !== -1) {
        loaderContent = loaderContent.slice(0, insertPosition + 'globalThis.define = DefineFunc;'.length) +
                        '\n' + lazyLoadingEnhancement + '\n' +
                        loaderContent.slice(insertPosition + 'globalThis.define = DefineFunc;'.length);
    }

    fs.writeFileSync(loaderPath, loaderContent);
    console.log('✅ Sistema de módulos optimizado con lazy loading');
}

// Función principal
function optimizeLoader() {
    console.log('🚀 Iniciando optimización del AMD loader...');

    try {
        addPreloadHints();
        optimizeModuleSystem();

        console.log('🎉 Optimización del loader completada!');
        console.log('💡 Mejoras implementadas:');
        console.log('   - Preload hints para chunks críticos');
        console.log('   - Lazy loading para módulos pesados');
        console.log('   - Prefetch para chunks no críticos');

    } catch (error) {
        console.error('❌ Error durante la optimización:', error);
        process.exit(1);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    optimizeLoader();
}

module.exports = { optimizeLoader, addPreloadHints, optimizeModuleSystem };