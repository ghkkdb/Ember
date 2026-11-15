const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

const pos = src.indexOf('class TerraBrotatoApp');
console.log(src.substring(pos, pos + 2500));
