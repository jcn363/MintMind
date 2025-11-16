# Análisis y Eliminación de Código Muerto

## Proceso de Limpieza

1. **Detección**:
   - ESLint con reglas personalizadas
   - ts-prune para exportaciones no utilizadas
   - Análisis de cobertura de pruebas

2. **Eliminación Segura**:
   - Eliminación en pequeños lotes
   - Pruebas después de cada eliminación
   - Revisión de dependencias

3. **Automatización**:
   - GitHub Actions para CI
   - Verificación en cada PR
   - Reportes de cobertura

## Guía Rápida

```bash
# Instalar dependencias
npm install

# Ejecutar análisis de código muerto
npm run analyze:deadcode

# Ejecutar pruebas con cobertura
npm run test:coverage

# Ver dependencias no utilizadas
npm run clean:deps\
