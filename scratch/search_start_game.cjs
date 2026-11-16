const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

let idx = 0;
while ((idx = src.indexOf('startGame', idx)) !== -1) {
    console.log('startGame at:', idx, src.substring(Math.max(0, idx - 20), idx + 60));
    idx += 9;
}
