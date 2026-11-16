const fs = require('fs');
const src = fs.readFileSync('terrabrotato.html', 'utf8');

// Mock browser globals
global.document = {
    createElement(tag) {
        return {
            getContext() {
                return {
                    fillStyle: '',
                    fillRect() {}
                };
            },
            toDataURL() {
                return 'data:image/png;base64,MOCK_DATA';
            }
        };
    }
};

global.THREE = {
    BoxGeometry: class {},
    CircleGeometry: class {},
    MeshBasicMaterial: class {},
    MeshStandardMaterial: class {},
    Group: class { add() {} }
};

// Extract class App or execute the script body inside HTML
// The script tag is between <script> and </script>
const scriptStart = src.indexOf('<script>');
const scriptEnd = src.lastIndexOf('</script>');
const jsCode = src.substring(scriptStart + 8, scriptEnd);

// Run in context
const vm = require('vm');
const context = vm.createContext({
    document: global.document,
    THREE: global.THREE,
    window: {},
    console: console,
    Math: Math,
    Object: Object,
    Array: Array,
    String: String,
    Number: Number,
    Boolean: Boolean,
    RegExp: RegExp,
    Date: Date,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval
});

try {
    vm.runInContext(jsCode, context);
    console.log('Script loaded successfully in context!');

    const factory = vm.runInContext('new VoxelArtFactory()', context);
    const weapons = vm.runInContext('WEAPONS_DB', context);
    const items = vm.runInContext('ITEMS_DB', context);

    console.log('Patterns count:', Object.keys(factory.patterns).length);
    console.log('URLs count:', Object.keys(factory.urls).length);

    let missingW = 0;
    for (const [id, w] of Object.entries(weapons)) {
        if (!factory.urls[w.id] && !factory.urls[w.sprite]) {
            console.log('Missing weapon:', id);
            missingW++;
        }
    }
    console.log('Weapons missing (out of ' + Object.keys(weapons).length + '):', missingW);

    let missingI = 0;
    for (const item of items) {
        if (!factory.urls[item.id] && !factory.urls['item_' + item.id] && !factory.urls[item.sprite]) {
            console.log('Missing item:', item.id);
            missingI++;
        }
    }
    console.log('Items missing (out of ' + items.length + '):', missingI);

} catch (err) {
    console.error('Error:', err);
}
