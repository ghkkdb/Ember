const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

const startIdx = src.indexOf('id="screen-start"');
console.log('screen-start index:', startIdx);
console.log(src.substring(startIdx - 100, startIdx + 300));
