const fs = require('fs');
const testFiles = fs.readdirSync('tests').filter(f => f.endsWith('.test.cjs'));
for (const f of testFiles) {
    const src = fs.readFileSync('tests/' + f, 'utf8');
    if (src.includes('localStorage') || src.includes('difficulty')) {
        console.log(f, 'has mentions');
        const lines = src.split('\n');
        lines.forEach((l, i) => {
            if (l.includes('localStorage') || l.includes('ember-difficulty')) {
                console.log('  L' + (i+1) + ': ' + l.trim());
            }
        });
    }
}
