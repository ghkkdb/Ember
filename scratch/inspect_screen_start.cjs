const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

const startIdx = src.indexOf('id="screen-start"');
const endIdx = src.indexOf('id="screen-weapon-guide"');

console.log(src.substring(startIdx, endIdx));
