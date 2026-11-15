const fs = require('fs');
const lines = fs.readFileSync('terrabrotato.html', 'utf8').split('\n');
for (let i = 5770; i < lines.length; i++) {
    console.log(i + 1, lines[i]);
}
