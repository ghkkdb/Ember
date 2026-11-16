const fs = require('fs');
const s = fs.readFileSync('terrabrotato.html', 'utf8');

// Find all elements with class containing 'fixed' or 'absolute' and 'z-'
const lines = s.split('\n');
lines.forEach((line, idx) => {
    if ((line.includes('fixed') || line.includes('absolute')) && (line.includes('inset-0') || line.includes('z-') || line.includes('pointer-events'))) {
        console.log(`Line ${idx + 1}: ${line.trim().slice(0, 140)}`);
    }
});
