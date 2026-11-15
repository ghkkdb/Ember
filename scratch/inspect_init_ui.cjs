const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

const pos = src.indexOf('initUI()');
console.log('initUI pos:', pos);
console.log(src.substring(pos, pos + 1500));
