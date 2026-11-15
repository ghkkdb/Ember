const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

const pausePos = src.indexOf('id="screen-pause"');
console.log('--- screen-pause ---');
console.log(src.substring(pausePos, pausePos + 1000));

const overPos = src.indexOf('id="screen-gameover"');
console.log('--- screen-gameover ---');
console.log(src.substring(overPos, overPos + 1000));
