const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

const pos = src.indexOf('startRun()');
console.log('startRun pos:', pos);
console.log(src.substring(pos, pos + 2500));
