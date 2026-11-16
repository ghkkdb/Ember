const assert = require('assert');

// Mock localStorage
const mockStorage = new Map();
global.localStorage = {
    getItem(key) { return mockStorage.get(key) || null; },
    setItem(key, value) { mockStorage.set(key, String(value)); },
    removeItem(key) { mockStorage.delete(key); },
    clear() { mockStorage.clear(); }
};

const EmberStorage = {
    CAREER_KEY: 'ember-career',
    ACTIVE_RUN_KEY: 'ember-active-run',
    DIFFICULTY_KEY: 'ember-difficulty',

    getDefaultCareer() {
        return {
            highestDifficulty: 1,
            totalRuns: 0,
            totalWins: 0,
            highestWave: 0,
            totalKills: 0,
            totalBossKills: 0,
            totalCoinsEarned: 0,
            heroStats: {
                guide: { runs: 0, wins: 0, highestWave: 0 },
                warrior: { runs: 0, wins: 0, highestWave: 0 },
                ranger: { runs: 0, wins: 0, highestWave: 0 },
                mage: { runs: 0, wins: 0, highestWave: 0 },
                ninja: { runs: 0, wins: 0, highestWave: 0 },
                summoner: { runs: 0, wins: 0, highestWave: 0 }
            },
            settings: {
                soundEnabled: true,
                sfxVolume: 0.8,
                bloomEnabled: true,
                camMode: 'ortho',
                damageNumbers: true
            }
        };
    },

    getCareer() {
        try {
            if (typeof localStorage === 'undefined') return this.getDefaultCareer();
            const raw = localStorage.getItem(this.CAREER_KEY);
            if (!raw) {
                const legacyDiff = Number(localStorage.getItem(this.DIFFICULTY_KEY)) || 1;
                const career = this.getDefaultCareer();
                career.highestDifficulty = Math.max(1, Math.min(5, legacyDiff));
                return career;
            }
            const data = JSON.parse(raw);
            return { ...this.getDefaultCareer(), ...data };
        } catch (e) {
            return this.getDefaultCareer();
        }
    },

    saveCareer(data) {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(this.CAREER_KEY, JSON.stringify(data));
            if (data.highestDifficulty) {
                localStorage.setItem(this.DIFFICULTY_KEY, String(data.highestDifficulty));
            }
        } catch (e) {}
    },

    getActiveRun() {
        try {
            if (typeof localStorage === 'undefined') return null;
            const raw = localStorage.getItem(this.ACTIVE_RUN_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    },

    saveActiveRun(app) {
        try {
            if (typeof localStorage === 'undefined' || !app || app.state === 'GAMEOVER') return;
            const runData = {
                savedAt: Date.now(),
                wave: app.wave,
                difficulty: app.difficulty || 1,
                biomeIndex: app.biomeIndex || 0,
                charId: app.selectedCharId || 'guide',
                level: app.level || 1,
                xp: app.xp || 0,
                xpNext: app.xpNext || 16,
                gold: app.gold || 0,
                baggedGold: app.baggedGold || 0,
                baseStats: { ...app.baseStats },
                weapons: (app.weapons || []).map(w => ({ id: w.id, tier: w.tier, rank: w.rank || 0, branch: w.branch || null })),
                ownedItems: (app.ownedItems || []).map(it => it.id),
                selectedCoreId: app.selectedCoreId || null,
                totalKills: app.totalKills || 0,
                totalDmg: app.totalDmg || 0
            };
            localStorage.setItem(this.ACTIVE_RUN_KEY, JSON.stringify(runData));
        } catch (e) {}
    },

    clearActiveRun() {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.removeItem(this.ACTIVE_RUN_KEY);
        } catch (e) {}
    },

    recordRunEnd(app, victory = false) {
        try {
            const career = this.getCareer();
            career.totalRuns++;
            if (victory) career.totalWins++;
            career.highestWave = Math.max(career.highestWave, app.wave || 1);
            career.totalKills += (app.totalKills || 0);
            career.totalCoinsEarned += Math.max(0, (app.gold || 0) + (app.baggedGold || 0));

            const charId = app.selectedCharId || 'guide';
            if (career.heroStats[charId]) {
                career.heroStats[charId].runs++;
                if (victory) career.heroStats[charId].wins++;
                career.heroStats[charId].highestWave = Math.max(career.heroStats[charId].highestWave, app.wave || 1);
            }

            if (victory && app.difficulty >= career.highestDifficulty && career.highestDifficulty < 5) {
                career.highestDifficulty = Math.min(5, app.difficulty + 1);
            }

            this.saveCareer(career);
            this.clearActiveRun();
            return career;
        } catch (e) {
            return this.getDefaultCareer();
        }
    }
};

// Unit test cases
console.log('Test 1: Default career');
const c1 = EmberStorage.getCareer();
assert.equal(c1.highestDifficulty, 1);
assert.equal(c1.totalRuns, 0);

console.log('Test 2: Save active run');
const mockApp = {
    wave: 8,
    difficulty: 2,
    biomeIndex: 1,
    selectedCharId: 'warrior',
    level: 7,
    xp: 45,
    xpNext: 80,
    gold: 142,
    baggedGold: 20,
    baseStats: { maxHp: 35 },
    weapons: [{ id: 'boss_hammer', tier: 2, rank: 1, branch: 'single' }],
    ownedItems: [{ id: 'insulator' }, { id: 'shackle' }],
    selectedCoreId: 'heavy',
    totalKills: 128,
    totalDmg: 3450
};
EmberStorage.saveActiveRun(mockApp);
const savedRun = EmberStorage.getActiveRun();
assert.ok(savedRun);
assert.equal(savedRun.wave, 8);
assert.equal(savedRun.charId, 'warrior');
assert.equal(savedRun.gold, 142);
assert.equal(savedRun.weapons[0].id, 'boss_hammer');
assert.equal(savedRun.ownedItems.length, 2);

console.log('Test 3: Record run victory and difficulty unlock');
mockApp.difficulty = 2;
mockApp.wave = 20;
EmberStorage.recordRunEnd(mockApp, true);
const c2 = EmberStorage.getCareer();
assert.equal(c2.totalRuns, 1);
assert.equal(c2.totalWins, 1);
assert.equal(c2.highestWave, 20);
assert.equal(c2.highestDifficulty, 3);
assert.equal(localStorage.getItem('ember-difficulty'), '3');
assert.equal(EmberStorage.getActiveRun(), null); // active run cleared!

console.log('All EmberStorage tests passed 100%!');
