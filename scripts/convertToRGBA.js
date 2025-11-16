const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const sharp = require('sharp');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const rename = promisify(fs.rename);

// Formatos de imagen soportados
const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

// Directorios a ignorar
const IGNORE_DIRS = [
	'node_modules',
	'.git',
	'out',
	'dist',
	'build',
	'target'
];

async function isImage(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	return SUPPORTED_EXTENSIONS.includes(ext);
}

async function convertToRGBA(filePath) {
	try {
		const tempPath = `${filePath}.tmp`;

		// Convertir la imagen a PNG con canal alfa (RGBA)
		await sharp(filePath)
			.ensureAlpha()  // Asegurar que tenga canal alfa
			.toFile(tempPath);

		// Reemplazar el archivo original
		await unlink(filePath);
		await rename(tempPath, filePath);

		console.log(`Convertido a RGBA: ${filePath}`);
		return true;
	} catch (error) {
		console.error(`Error procesando ${filePath}:`, error.message);
		return false;
	}
}

async function processDirectory(directory) {
	try {
		const items = await readdir(directory, { withFileTypes: true });

		for (const item of items) {
			const fullPath = path.join(directory, item.name);

			// Saltar directorios ignorados
			if (item.isDirectory()) {
				if (!IGNORE_DIRS.includes(item.name)) {
					await processDirectory(fullPath);
				}
				continue;
			}

			// Procesar archivos de imagen
			if (await isImage(fullPath)) {
				await convertToRGBA(fullPath);
			}
		}
	} catch (error) {
		console.error(`Error accediendo al directorio ${directory}:`, error.message);
	}
}

// Directorio raíz del proyecto
const rootDir = path.join(__dirname, '..');

console.log('Iniciando conversión de imágenes a RGBA...');
processDirectory(rootDir)
	.then(() => console.log('Conversión completada.'))
	.catch(error => console.error('Error durante la conversión:', error));
