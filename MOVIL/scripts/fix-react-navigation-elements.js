/**
 * Crea los assets PNG faltantes en @react-navigation/elements.
 * Ejecutar después de npm install si el paquete no incluye los assets.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-navigation',
  'elements',
  'lib',
  'module',
  'assets'
);

// 1x1 transparent PNG (67 bytes)
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const files = [
  'back-icon.png',
  'back-icon-mask.png',
  'clear-icon.png',
  'close-icon.png',
  'search-icon.png',
];

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

for (const f of files) {
  fs.writeFileSync(path.join(dir, f), png);
}

console.log('fix-react-navigation-elements: creados', files.length, 'assets');
