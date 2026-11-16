const fs = require('fs');
const s = fs.readFileSync('terrabrotato.html', 'utf8');
const indices = [];
let pos = 0;
while ((pos = s.indexOf('id="screen-main-menu"', pos)) !== -1) {
    indices.push(pos);
    pos += 20;
}
console.log('Indices of screen-main-menu:', indices);
