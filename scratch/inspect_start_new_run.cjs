const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

const pos = src.indexOf('startNewRun(');
console.log(src.substring(pos, pos + 2000));
