const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

const bodyPos = src.indexOf('<body');
const canvasPos = src.indexOf('<canvas');
const screenStartPos = src.indexOf('id="screen-start"');

console.log('bodyPos:', bodyPos);
console.log('canvasPos:', canvasPos);
console.log('screenStartPos:', screenStartPos);

console.log(src.substring(bodyPos, screenStartPos));
