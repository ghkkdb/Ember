const fs = require('fs');
const src = fs.readFileSync('analysis/combat-benchmark.cjs', 'utf8');

const pos = src.indexOf('function setup');
console.log('setup pos:', pos);
console.log(src.substring(pos, pos + 2500));
