const fs = require('fs');
const lines = fs.readFileSync('terrabrotato.html', 'utf8').split('\n');
for (let i = 135; i <= 375; i++) {
    if (lines[i].includes('id="screen-')) {
        console.log(`Line ${i+1}: ${lines[i].trim()}`);
    }
}
