const fs = require('fs');
const testFiles = fs.readdirSync('tests').filter(f => f.endsWith('.test.cjs'));
let found = 0;
for (const f of testFiles) {
    const src = fs.readFileSync('tests/' + f, 'utf8');
    if (src.includes('screen-start')) {
        console.log(f, 'has screen-start');
        found++;
    }
}
console.log('Total mentions of screen-start in tests:', found);
