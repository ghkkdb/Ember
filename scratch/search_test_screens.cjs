const fs = require('fs');
const testFiles = fs.readdirSync('tests').filter(f => f.endsWith('.test.cjs'));
for (const f of testFiles) {
    const src = fs.readFileSync('tests/' + f, 'utf8');
    ['screen-start', 'startGame', 'screen-pause', 'closeWeaponGuide'].forEach(term => {
        if (src.includes(term)) {
            console.log(f, 'has', term);
            const lines = src.split('\n');
            lines.forEach((l, i) => {
                if (l.includes(term)) console.log('  L' + (i+1) + ': ' + l.trim());
            });
        }
    });
}
