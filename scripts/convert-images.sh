#!/bin/bash

# Instalar sharp temporalmente
echo "Instalando sharp temporalmente..."
npm install --no-save sharp

# Verificar si la instalación fue exitosa
if [ $? -ne 0 ]; then
  echo "Error al instalar sharp. Intentando con --legacy-peer-deps..."
  npm install --legacy-peer-deps --no-save sharp

  if [ $? -ne 0 ]; then
    echo "No se pudo instalar sharp. Por favor, instálalo manualmente con:"
    echo "npm install --save-dev sharp"
    exit 1
  fi
fi

# Ejecutar el script de conversión
echo "Iniciando conversión de imágenes a RGBA..."
node scripts/convertToRGBA.js

# Desinstalar sharp
echo "Eliminando sharp..."
npm uninstall sharp

echo "Proceso completado."
