# Reportes de Análisis de Bundles

Este directorio contiene reportes automáticos de análisis de tamaño de bundles generados durante el proceso de CI/CD.

## Contenido de los Reportes

Los reportes incluyen:
- `bundle-report-*.html`: Reporte visual interactivo generado por webpack-bundle-analyzer
- `bundle-stats-*.json`: Datos en formato JSON para análisis programático

## Acceso a Reportes en CI/CD

### GitHub Actions
Los reportes se generan automáticamente en cada PR y push a las ramas principales:

1. **Artifacts en GitHub Actions**: Los reportes se suben como artifacts con nombres como:
   - `bundle-analysis-reports-{run_id}`
   - `bundle-analysis-results-{run_id}`

2. **Comentarios en PR**: Cada PR recibe un comentario automático con:
   - Resumen del estado de los bundles
   - Enlaces a los artifacts
   - Información sobre límites excedidos

### Cómo acceder

1. Ve a la pestaña "Actions" del repositorio
2. Selecciona el workflow "Bundle Analysis"
3. En la ejecución deseada, desplázate a la sección "Artifacts"
4. Descarga los archivos comprimidos
5. Abre los archivos `.html` en tu navegador para análisis visual

### Límites de Tamaño Configurados

- ⚠️ **Límite recomendado**: 5MB (warning)
- ❌ **Límite máximo**: 10MB (error)

Si un bundle excede estos límites, la CI fallará automáticamente.

## Configuración del Workflow

El análisis se ejecuta automáticamente en:
- Pull requests a `main` y ramas `release/*`
- Pushes a `main` y ramas `release/*`
- Ejecuciones manuales (workflow_dispatch)

Los reportes se generan después de cada build con `ANALYZE_BUNDLE=true`.