#!/usr/bin/env node

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

/**
 * Script avanzado para análisis de bundles con métricas de optimización
 */

class BundleAnalyzer {
    constructor() {
        this.reportsDir = path.join(__dirname, '../bundle-reports');
        this.metrics = {
            totalSize: 0,
            chunkCount: 0,
            largestChunk: { name: '', size: 0 },
            vendorSize: 0,
            asyncChunks: 0,
            lazyLoadedModules: 0
        };
    }

    analyzeBundle() {
        console.log('📊 Iniciando análisis avanzado de bundles...\n');

        // Buscar archivos de estadísticas
        const statsFiles = this.findStatsFiles();
        if (statsFiles.length === 0) {
            console.log('⚠️  No se encontraron archivos de estadísticas de webpack.');
            return;
        }

        statsFiles.forEach(statsFile => {
            this.analyzeStatsFile(statsFile);
        });

        this.generateOptimizationReport();
        this.generateRecommendations();
    }

    findStatsFiles() {
        if (!fs.existsSync(this.reportsDir)) {
            console.log('📁 Creando directorio de reportes...');
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }

        const outDir = path.join(__dirname, '../out');
        if (!fs.existsSync(outDir)) {
            return [];
        }

        return fs.readdirSync(outDir)
            .filter(file => file.endsWith('-stats.json') || file.includes('webpack-stats'))
            .map(file => path.join(outDir, file));
    }

    analyzeStatsFile(statsPath) {
        try {
            console.log(`🔍 Analizando: ${path.basename(statsPath)}`);
            const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));

            if (stats.assets) {
                this.analyzeAssets(stats.assets);
            }

            if (stats.chunks) {
                this.analyzeChunks(stats.chunks);
            }

        } catch (error) {
            console.error(`❌ Error analizando ${statsPath}:`, error.message);
        }
    }

    analyzeAssets(assets) {
        assets.forEach(asset => {
            const size = asset.size || 0;
            this.metrics.totalSize += size;

            if (size > this.metrics.largestChunk.size) {
                this.metrics.largestChunk = { name: asset.name, size };
            }

            // Detectar chunks de vendor
            if (asset.name.includes('vendor') || asset.name.includes('vendors')) {
                this.metrics.vendorSize += size;
            }
        });
    }

    analyzeChunks(chunks) {
        this.metrics.chunkCount = chunks.length;

        chunks.forEach(chunk => {
            if (chunk.entry === false) {
                this.metrics.asyncChunks++;
            }

            // Analizar módulos lazy loaded
            if (chunk.modules) {
                chunk.modules.forEach(module => {
                    if (this.isLazyLoadedModule(module)) {
                        this.metrics.lazyLoadedModules++;
                    }
                });
            }
        });
    }

    isLazyLoadedModule(module) {
        // Detectar patrones de lazy loading
        const lazyPatterns = [
            /import\(/,
            /require\.ensure/,
            /webpackChunkName/,
            /lazy/
        ];

        return lazyPatterns.some(pattern =>
            pattern.test(module.identifier || module.name || '')
        );
    }

    generateOptimizationReport() {
        console.log('\n📈 === REPORTE DE OPTIMIZACIÓN DE BUNDLES ===\n');

        console.log(`📊 Tamaño total del bundle: ${(this.metrics.totalSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`🧩 Número total de chunks: ${this.metrics.chunkCount}`);
        console.log(`⚡ Chunks asíncronos (lazy): ${this.metrics.asyncChunks}`);
        console.log(`📦 Chunk más grande: ${this.metrics.largestChunk.name} (${(this.metrics.largestChunk.size / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`🏪 Tamaño de vendor libraries: ${(this.metrics.vendorSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`🔄 Módulos lazy loaded detectados: ${this.metrics.lazyLoadedModules}`);

        // Calcular métricas de optimización
        const asyncRatio = this.metrics.chunkCount > 0 ? (this.metrics.asyncChunks / this.metrics.chunkCount * 100).toFixed(1) : 0;
        const vendorRatio = this.metrics.totalSize > 0 ? (this.metrics.vendorSize / this.metrics.totalSize * 100).toFixed(1) : 0;

        console.log(`\n📈 Métricas de Optimización:`);
        console.log(`   • Ratio de chunks asíncronos: ${asyncRatio}%`);
        console.log(`   • Ratio de vendor code: ${vendorRatio}%`);

        // Puntaje de optimización
        let score = 100;
        if (parseFloat(asyncRatio) < 30) {score -= 20;}
        if (parseFloat(vendorRatio) > 50) {score -= 15;}
        if (this.metrics.largestChunk.size > 5 * 1024 * 1024) {score -= 10;} // > 5MB

        console.log(`   • Puntaje de optimización: ${score}/100`);
    }

    generateRecommendations() {
        console.log('\n💡 === RECOMENDACIONES DE OPTIMIZACIÓN ===\n');

        const recommendations = [];

        if (this.metrics.asyncChunks / this.metrics.chunkCount < 0.3) {
            recommendations.push('🔄 Aumentar el uso de lazy loading - menos del 30% de chunks son asíncronos');
        }

        if (this.metrics.vendorSize / this.metrics.totalSize > 0.5) {
            recommendations.push('📦 Optimizar vendor libraries - más del 50% del bundle es código de terceros');
        }

        if (this.metrics.largestChunk.size > 3 * 1024 * 1024) {
            recommendations.push(`🎯 Dividir el chunk más grande (${this.metrics.largestChunk.name}) - excede 3MB`);
        }

        if (this.metrics.lazyLoadedModules < 10) {
            recommendations.push('🚀 Implementar más lazy loading de módulos - pocos módulos lazy loaded detectados');
        }

        if (recommendations.length === 0) {
            console.log('✅ ¡Excelente! El bundle está bien optimizado.');
        } else {
            recommendations.forEach(rec => console.log(`   • ${rec}`));
        }
    }

    saveReport() {
        const reportPath = path.join(this.reportsDir, `optimization-report-${Date.now()}.json`);

        const report = {
            timestamp: new Date().toISOString(),
            metrics: this.metrics,
            recommendations: this.generateRecommendationsText()
        };

        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n💾 Reporte guardado: ${path.relative(process.cwd(), reportPath)}`);
    }

    generateRecommendationsText() {
        // Simplified version for JSON report
        return [
            this.metrics.asyncChunks / this.metrics.chunkCount < 0.3 ? 'Increase lazy loading usage' : null,
            this.metrics.vendorSize / this.metrics.totalSize > 0.5 ? 'Optimize vendor libraries' : null,
            this.metrics.largestChunk.size > 3 * 1024 * 1024 ? 'Split large chunks' : null,
            this.metrics.lazyLoadedModules < 10 ? 'Implement more lazy loading' : null
        ].filter(Boolean);
    }
}

// Ejecutar análisis
if (require.main === module) {
    const analyzer = new BundleAnalyzer();
    analyzer.analyzeBundle();
    analyzer.saveReport();
}

module.exports = BundleAnalyzer;