const fs = require('fs');
const assert = require('assert');

// Mock DOM & window & localStorage
class MockLocalStorage {
    constructor() {
        this.store = new Map();
    }
    getItem(key) {
        return this.store.has(key) ? this.store.get(key) : null;
    }
    setItem(key, value) {
        this.store.set(key, String(value));
    }
    removeItem(key) {
        this.store.delete(key);
    }
    clear() {
        this.store.clear();
    }
}

const mockStorage = new MockLocalStorage();
global.localStorage = mockStorage;
global.window = global;
global.document = {
    getElementById: (id) => ({
        id,
        classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); }
        },
        style: {},
        innerHTML: '',
        textContent: '',
        value: '',
        checked: false
    }),
    querySelectorAll: () => []
};

// Read terrabrotato.html and evaluate JS part
const html = fs.readFileSync('terrabrotato.html', 'utf8');
const scriptMatches = [...html.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/g)];
const mainScript = scriptMatches[scriptMatches.length - 1][1];
assert(mainScript && mainScript.length > 100000, "Found main game script block");
const jsContent = mainScript;

// We can extract EmberStorage and test it directly
console.log("Evaluating EmberStorage & TerraBrotatoApp...");

// Safely execute in VM or eval
const vm = require('vm');
const context = vm.createContext({
    localStorage: mockStorage,
    window: {
        addEventListener: () => {},
        requestAnimationFrame: () => {},
        cancelAnimationFrame: () => {},
        innerWidth: 1920,
        innerHeight: 1080
    },
    document: global.document,
    console: console,
    Math: Math,
    Date: Date,
    JSON: JSON,
    Set: Set,
    Map: Map,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    THREE: {
        Scene: function() { return { add: () => {}, remove: () => {} }; },
        PerspectiveCamera: function() { return { position: { set: () => {} }, lookAt: () => {}, aspect: 1, updateProjectionMatrix: () => {} }; },
        WebGLRenderer: function() { return { setPixelRatio: () => {}, setSize: () => {}, render: () => {}, domElement: {} }; },
        Color: function() {},
        AmbientLight: function() {},
        DirectionalLight: function() { return { position: { set: () => {} } }; },
        Vector3: function() { return { set: () => {}, copy: () => {}, clone: () => this }; },
        BoxGeometry: function() {},
        MeshStandardMaterial: function() {},
        MeshBasicMaterial: function() {},
        Mesh: function() { return { position: { set: () => {} }, rotation: { set: () => {} } }; },
        Group: function() { return { add: () => {}, remove: () => {}, children: [] }; },
        Clock: function() { return { getElapsedTime: () => 0, getDelta: () => 0.016 }; }
    }
});

// Run script
try {
    vm.runInContext(jsContent, context);
    console.log("Evaluated script successfully in VM context!");
} catch (e) {
    console.error("Evaluation error:", e);
    process.exit(1);
}

// 1. Verify EmberStorage
const EmberStorage = context.window.EmberStorage;
assert(EmberStorage, "EmberStorage should exist");

// Fresh storage test
mockStorage.clear();
const career1 = EmberStorage.getCareer();
assert.strictEqual(career1.totalRuns, 0);
assert.strictEqual(career1.highestDifficulty, 1);
assert.strictEqual(career1.totalKills, 0);

// Record a run end (app mock)
EmberStorage.recordRunEnd({
    selectedCharId: 'ranger',
    difficulty: 3,
    wave: 15,
    totalKills: 240,
    gold: 1000,
    baggedGold: 350
}, false);

const career2 = EmberStorage.getCareer();
assert.strictEqual(career2.totalRuns, 1);
assert.strictEqual(career2.totalWins, 0);
assert.strictEqual(career2.highestWave, 15);
assert.strictEqual(career2.highestDifficulty, 1); // Only victory upgrades highestDifficulty
assert.strictEqual(career2.totalKills, 240);
assert.strictEqual(career2.totalCoinsEarned, 1350);
assert.strictEqual(career2.heroStats['ranger'].runs, 1);

// Record a victory at difficulty 3 -> should unlock diff 4
EmberStorage.recordRunEnd({
    selectedCharId: 'ranger',
    difficulty: 3,
    wave: 20,
    totalKills: 350,
    gold: 1500,
    baggedGold: 700
}, true);
const career3 = EmberStorage.getCareer();
assert.strictEqual(career3.totalRuns, 2);
assert.strictEqual(career3.totalWins, 1);
assert.strictEqual(career3.highestWave, 20);
assert.strictEqual(career3.highestDifficulty, 4);
assert.strictEqual(career3.heroStats['ranger'].wins, 1);
assert.strictEqual(mockStorage.getItem('ember-difficulty'), '4', "Legacy difficulty must sync");

// Active Run Persistence
assert.strictEqual(EmberStorage.getActiveRun(), null);
const mockAppForSave = {
    state: 'SHOP',
    wave: 8,
    difficulty: 2,
    biomeIndex: 0,
    selectedCharId: 'warrior',
    level: 7,
    xp: 45,
    xpNext: 60,
    gold: 340,
    baggedGold: 20,
    baseStats: { maxHp: 120, hp: 110 },
    weapons: [{ id: 'copper_shortsword', tier: 1, rank: 2, branch: 'light' }],
    ownedItems: [{ id: 'medkit' }, { id: 'scope' }],
    selectedCoreId: 'core_slash',
    totalKills: 85,
    totalDmg: 4500
};
EmberStorage.saveActiveRun(mockAppForSave);
const loadedRun = EmberStorage.getActiveRun();
assert(loadedRun, "Active run must exist");
assert.strictEqual(loadedRun.charId, 'warrior');
assert.strictEqual(loadedRun.wave, 8);
assert.strictEqual(loadedRun.weapons[0].id, 'copper_shortsword');
assert.strictEqual(loadedRun.weapons[0].rank, 2);
assert.strictEqual(loadedRun.ownedItems.length, 2);
assert.strictEqual(loadedRun.selectedCoreId, 'core_slash');

EmberStorage.clearActiveRun();
assert.strictEqual(EmberStorage.getActiveRun(), null);

// Settings Persistence in Career
const initialSettings = EmberStorage.getCareer().settings;
assert.strictEqual(initialSettings.soundEnabled, true);
assert.strictEqual(initialSettings.bloomEnabled, true);
assert.strictEqual(initialSettings.camMode, 'ortho');

// Update settings
const c = EmberStorage.getCareer();
c.settings.soundEnabled = false;
c.settings.bloomEnabled = false;
c.settings.camMode = 'iso';
EmberStorage.saveCareer(c);

const loadedSettings = EmberStorage.getCareer().settings;
assert.strictEqual(loadedSettings.soundEnabled, false);
assert.strictEqual(loadedSettings.bloomEnabled, false);
assert.strictEqual(loadedSettings.camMode, 'iso');

console.log("All EmberStorage unit & integration checks PASSED!");

console.log("All EmberStorage unit & integration checks PASSED!");
