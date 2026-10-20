// The web and desktop apps share the exact same renderer and artwork.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
fs.mkdirSync(output, { recursive: true });
for (const name of ['index.html', 'script.js', 'ink.js', 'closed-books-3d.js', 'starter-library.js', 'reader-ui.js', 'book-fonts.js', 'spine-ornaments.js', 'page-workshop.js', 'book-art.js', 'style.css']) {
  fs.copyFileSync(path.join(root, name), path.join(output, name));
}
fs.cpSync(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true, filter:source=>!source.split(path.sep).includes('local-fonts') });
console.log('Static browser build: ' + output);
