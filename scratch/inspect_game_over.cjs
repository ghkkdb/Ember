const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

const pos = src.indexOf('triggerGameOver');
console.log('triggerGameOver pos:', pos);
console.log(src.substring(pos, pos + 1500));
