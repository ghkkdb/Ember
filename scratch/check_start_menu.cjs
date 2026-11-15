const fs = require('fs');
const s = fs.readFileSync('terrabrotato.html', 'utf8');
const idx = s.indexOf('renderStartMenu() {');
console.log(s.slice(idx, idx + 2000));
