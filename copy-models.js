const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, 'src/models');
const destDir = path.resolve(__dirname, 'dist/models');

fs.mkdirSync(destDir, { recursive: true });

fs.readdirSync(srcDir).forEach(file => {
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
});
