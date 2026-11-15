const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

const shopPos = src.indexOf('id="screen-shop"');
console.log('screen-shop pos:', shopPos);
console.log(src.substring(shopPos, shopPos + 2500));
