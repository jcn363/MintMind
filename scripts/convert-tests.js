const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Función para buscar archivos recursivamente
function findFiles(dir, pattern) {
  const results = [];
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      results.push(...findFiles(fullPath, pattern));
    } else if (pattern.test(file.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

// Función para reemplazar usando función regular
function replaceWithPattern(content, pattern, replacement) {
  if (typeof replacement === 'function') {
    return content.replace(pattern, replacement);
  }
  return content.replace(pattern, replacement);
}

// Convertir archivos de prueba
function convertTests() {
  console.log('Buscando archivos de prueba...');
  const testFiles = findFiles(path.join(__dirname, '..', 'src'), /\.(test|spec)\.ts$/);

  console.log(`Encontrados ${testFiles.length} archivos de prueba`);

  // Crear un archivo temporal con la lista de archivos
  const tempFile = path.join(__dirname, 'temp-test-files.txt');
  fs.writeFileSync(tempFile, testFiles.join('\n'));

  console.log('Iniciando conversión a Jest...');

  try {
    // Usar jest-codemods para convertir los archivos con --force
    console.log('Ejecutando jest-codemods...');
    execSync(`cat ${tempFile} | xargs -n 1 -P 8 -I {} sh -c 'npx jest-codemods --mocha --force {} && echo "Convertido: {}"'`, {
      stdio: 'inherit'
    });

    // Reemplazar manualmente los patrones comunes
    console.log('Aplicando reemplazos adicionales...');
    testFiles.forEach(file => {
      try {
        if (!fs.existsSync(file)) {
          console.log(`Archivo no encontrado: ${file}`);
          return;
        }

        let content = fs.readFileSync(file, 'utf8');

        // Reemplazos comunes
        content = replaceWithPattern(content, /suite\(/g, 'describe(');
        content = replaceWithPattern(content, /suite\.only\(/g, 'describe.only(');
        content = replaceWithPattern(content, /suite\.skip\(/g, 'describe.skip(');
        content = replaceWithPattern(content, /test\(/g, 'it(');
        content = replaceWithPattern(content, /test\.only\(/g, 'it.only(');
        content = replaceWithPattern(content, /test\.skip\(/g, 'it.skip(');
        content = replaceWithPattern(content, /setup\(/g, 'beforeEach(');
        content = replaceWithPattern(content, /teardown\(/g, 'afterEach(');
        content = replaceWithPattern(content, /suiteSetup\(/g, 'beforeAll(');
        content = replaceWithPattern(content, /suiteTeardown\(/g, 'afterAll(');

        fs.writeFileSync(file, content);
        console.log(`Actualizado: ${file}`);
      } catch (error) {
        console.error(`Error procesando ${file}:`, error.message);
      }
    });

    console.log('¡Conversión completada!');
  } catch (error) {
    console.error('Error durante la conversión:', error.message);
  } finally {
    // Limpiar archivo temporal
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

convertTests();
