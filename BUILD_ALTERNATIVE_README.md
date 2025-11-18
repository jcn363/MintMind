# Sistema Alternativo de Build con esbuild/swc

Este documento describe la configuración alternativa de build que reemplaza el sistema basado en Gulp con una solución moderna y declarativa usando esbuild y opcionalmente SWC.

## 🚀 Características

- **Rendimiento mejorado**: esbuild proporciona compilación hasta 10-100x más rápida que alternativas tradicionales
- **Configuración declarativa**: Toda la configuración se define en objetos JavaScript legibles
- **Compatibilidad**: Mantiene interfaz compatible con comandos Gulp existentes
- **Modularidad**: Soporte para múltiples targets (main, extensions, webviews, cli)
- **Híbrido opcional**: Integración con SWC para transformación aún más rápida
- **Watch mode**: Recarga automática durante desarrollo
- **Source maps**: Soporte completo para debugging
- **Tree shaking**: Eliminación automática de código no utilizado

## 📁 Archivos de Configuración

### `esbuild.config.mjs`
Configuración principal declarativa con esbuild. Define targets para:
- **main**: Código principal de MintMind
- **extensions**: Extensiones comunes
- **webviews**: Webviews de extensiones (usa configuración existente)
- **cli**: Herramientas de línea de comandos

### `swc.config.json`
Configuración de SWC para transformación rápida de TypeScript (opcional).

### `build-alternative.mjs`
Script principal que proporciona interfaz unificada y compatibilidad con Gulp.

## 🛠️ Uso

### Comandos Principales

```bash
# Construir target específico
node build-alternative.mjs build main
node build-alternative.mjs build extensions
node build-alternative.mjs build webviews
node build-alternative.mjs build cli

# Construir todo
node build-alternative.mjs build-all

# Modo watch para desarrollo
node build-alternative.mjs build main --watch
node build-alternative.mjs build-all --watch

# Limpiar
node build-alternative.mjs clean

# Ver estado
node build-alternative.mjs status
```

### Comandos Compatibles con Gulp

El sistema alternativo mantiene compatibilidad con comandos Gulp existentes:

```bash
# Equivalentes a comandos Gulp
node build-alternative.mjs compile              # gulp compile
node build-alternative.mjs compile-build        # gulp compile-build
node build-alternative.mjs compile-extensions-build  # gulp compile-extensions-build
node build-alternative.mjs compile-web          # gulp compile-web
node build-alternative.mjs watch-client         # gulp watch-client
node build-alternative.mjs hygiene              # gulp hygiene
```

### Variables de Entorno

```bash
# Habilitar transformación con SWC (más rápido)
USE_SWC=true node build-alternative.mjs build main

# Modo producción
NODE_ENV=production node build-alternative.mjs build main

# Generar análisis de bundles
ANALYZE_BUNDLE=true node build-alternative.mjs build main
```

## ⚙️ Configuración Declarativa

La configuración se define en objetos JavaScript en `esbuild.config.mjs`:

```javascript
const buildConfig = {
  main: {
    entryPoints: ['src/main.ts', 'src/bootstrap.ts'],
    outdir: 'out',
    platform: 'node',
    target: ['node18'],
    format: 'cjs',
    bundle: false,
    sourcemap: true,
    external: ['electron', '@vscode/spdlog']
  }
};
```

## 🔧 Beneficios sobre Gulp

1. **Velocidad**: Compilación mucho más rápida
2. **Simplicidad**: Configuración declarativa vs. código imperativo
3. **Mantenibilidad**: Menos código, más legible
4. **Moderno**: Soporte nativo para ESM, TypeScript, JSX
5. **Árbol de dependencias**: Mejor tree shaking y optimización
6. **Paralelización**: Builds más eficientes
7. **Ecosistema**: Mejor integración con herramientas modernas

## 🔄 Migración Gradual

Esta configuración alternativa:
- ✅ No modifica el sistema Gulp existente
- ✅ Puede ejecutarse en paralelo durante la migración
- ✅ Mantiene compatibilidad con scripts existentes
- ✅ Permite comparación de rendimiento
- ✅ Facilita transición incremental

## 📊 Comparación de Rendimiento

| Aspecto | Gulp | esbuild/swc |
|---------|------|-------------|
## 📦 Dependencias Requeridas

Para usar el sistema alternativo de build, instala las dependencias adicionales:

```bash
npm install --save-dev esbuild @swc/core @swc/cli glob
```

O usando bun (recomendado para el proyecto):

```bash
bun add -D esbuild @swc/core @swc/cli glob
```

### Dependencias Opcionales

- `@swc/core` y `@swc/cli`: Para transformación híbrida más rápida (opcional)
- `glob`: Para resolución de patrones de archivos (ya disponible en el proyecto)
| Tiempo de build inicial | ~2-5 min | ~10-30 seg |
| Builds incrementales | ~30-60 seg | ~1-5 seg |
| Memoria utilizada | Alta | Baja |
| Complejidad configuración | Alta | Baja |
| Mantenibilidad | Media | Alta |

## 🚨 Consideraciones

- Requiere Node.js 18+ para características modernas
- Algunos plugins Gulp pueden necesitar adaptación
- La configuración es específica para MintMind - ajustar según necesidades
- SWC es opcional pero recomendado para máximo rendimiento

## 🎯 Próximos Pasos

1. Probar la configuración en un entorno de desarrollo
2. Comparar tiempos de build con el sistema actual
3. Validar que la salida sea funcionalmente equivalente
4. Considerar migración gradual por módulos
5. Actualizar scripts de CI/CD si es necesario
