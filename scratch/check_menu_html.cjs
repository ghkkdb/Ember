const fs = require('fs');
const s = fs.readFileSync('terrabrotato.html', 'utf8');
const idx = s.indexOf('id="screen-main-menu"');
console.log(s.slice(idx, idx + 3000));
