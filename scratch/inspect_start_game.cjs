const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

const pos = src.indexOf('startGame() {');
console.log('startGame pos:', pos);
console.log(src.substring(pos, pos + 2500));
