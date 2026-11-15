const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

const pos = src.indexOf('window.startGame =');
console.log(src.substring(pos - 300, pos + 800));
