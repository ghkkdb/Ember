const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

const regex = /id=['"](screen-[^'"]+)['"]/g;
let m;
const screens = [];
while ((m = regex.exec(src)) !== null) {
    screens.push(m[1]);
}
console.log('Screens found:', [...new Set(screens)]);

// Check where state === 'MENU' or similar
const stateRegex = /this\.state\s*=\s*['"]([A-Z_]+)['"]/g;
const states = [];
while ((m = stateRegex.exec(src)) !== null) {
    states.push(m[1]);
}
console.log('Game states:', [...new Set(states)]);

// Find HTML around screen-menu or first screen
const menuPos = src.indexOf('id="screen-');
console.log('First screen HTML:');
console.log(src.substring(menuPos, menuPos + 1500));
