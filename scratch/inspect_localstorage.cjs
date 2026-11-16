const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

const regex = /localStorage/g;
let count = 0;
let idx = 0;
while ((idx = src.indexOf('localStorage', idx)) !== -1) {
    count++;
    console.log(src.substring(Math.max(0, idx - 40), idx + 60));
    idx += 12;
}
console.log('localStorage occurrences:', count);
