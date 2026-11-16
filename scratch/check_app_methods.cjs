const fs = require('fs');
const lines = fs.readFileSync('terrabrotato.html', 'utf8').split('\n');
for (let i = 1880; i <= 2080; i++) {
    console.log(i + 1, lines[i]);
}
