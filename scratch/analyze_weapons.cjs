const fs = require('fs');
const path = require('path');
const { setup } = require('../analysis/combat-benchmark.cjs');
const { app, context } = setup(1);
const vm = require('vm');

const weaponsDB = vm.runInContext('WEAPONS_DB', context);
const balance = vm.runInContext('BALANCE', context);
const reforges = vm.runInContext('BOSS_WEAPON_REFORGES', context);
const statsMeta = vm.runInContext('STAT_META', context);

console.log('Total weapons in DB:', Object.keys(weaponsDB).length);

// Analyze each weapon
const results = [];

for (const [id, w] of Object.entries(weaponsDB)) {
    const factsT1 = app.getWeaponFacts({ id, tier: w.minTier });
    const combatT1 = app.getWeaponCombatStats({ id, tier: w.minTier });

    results.push({
        id,
        name: w.name,
        minTier: w.minTier,
        isBoss: !!w.exclusiveBossId,
        behavior: w.behavior,
        baseDmg: w.baseDmg,
        cd: w.cd,
        range: w.range,
        crit: w.crit,
        critMult: combatT1.critMultiplier || 1.75,
        pierce: w.pierce || 1,
        synergy: (w.synergy || []).join('/'),
        scale: JSON.stringify(w.scale || {}),
        facts: {
            damageText: factsT1.damage,
            reach: factsT1.reach,
            cadence: factsT1.cadence,
            cores: (factsT1.cores || []).join('/')
        }
    });
}

fs.writeFileSync(path.join(__dirname, 'weapons_raw.json'), JSON.stringify(results, null, 2));
console.log('Weapons raw written successfully!');
