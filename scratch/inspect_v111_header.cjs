const fs = require('fs');
const src = fs.readFileSync('tests/v111.test.cjs', 'utf8');

const lines = src.split('\n');
console.log(lines.slice(0, 45).join('\n'));
