const fs = require('fs');
const s = fs.readFileSync('terrabrotato.html', 'utf8');
console.log(s.slice(18600, 19000));
