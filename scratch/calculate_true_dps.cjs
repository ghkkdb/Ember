const fs = require('fs');
const path = require('path');
const { setup } = require('../analysis/combat-benchmark.cjs');
const { app, context } = setup(1);
const vm = require('vm');

const weaponsDB = vm.runInContext('WEAPONS_DB', context);
const neutralStats = {
    maxHp: 25, hpRegen: 0, lifeSteal: 0, dmgPct: 0,
    meleeDmg: 0, rangedDmg: 0, magicDmg: 0,
    attackSpeed: 0, critChance: 5, critEffectPct: 0,
    rangePct: 0, armor: 0, dodge: 0, speed: 0, luck: 0, harvesting: 0
};

const results = [];

for (const [id, def] of Object.entries(weaponsDB)) {
    app.stats = { ...neutralStats };
    app.selectedCoreId = null;

    let dpsT1 = 0;
    try {
        dpsT1 = app.getBuildDpsCeiling([{ id, tier: def.minTier }], neutralStats);
    } catch (e) {
        // fallback
        const st = app.getWeaponCombatStats({ id, tier: def.minTier }, neutralStats);
        dpsT1 = st.dmg / st.cd;
    }

    // Tier 4 DPS
    let dpsT4 = null;
    if (!def.exclusiveBossId) {
        try {
            dpsT4 = app.getBuildDpsCeiling([{ id, tier: 4 }], neutralStats);
        } catch (e) {
            const st = app.getWeaponCombatStats({ id, tier: 4 }, neutralStats);
            dpsT4 = st.dmg / st.cd;
        }
    }

    // Flat scaling test (+10 primary stat)
    const scaleKey = Object.keys(def.scale || {})[0] || 'meleeDmg';
    const scaleRatio = def.scale ? def.scale[scaleKey] : 1.0;
    let dpsStat10 = 0;
    try {
        dpsStat10 = app.getBuildDpsCeiling([{ id, tier: def.minTier }], { ...neutralStats, [scaleKey]: 10 });
    } catch (e) {
        dpsStat10 = dpsT1;
    }
    const statGain = dpsStat10 - dpsT1;

    // Attack speed test (+20% Aspd)
    let dpsAspd20 = 0;
    try {
        dpsAspd20 = app.getBuildDpsCeiling([{ id, tier: def.minTier }], { ...neutralStats, attackSpeed: 20 });
    } catch (e) {
        dpsAspd20 = dpsT1;
    }
    const aspdGain = dpsAspd20 - dpsT1;

    const st = app.getWeaponCombatStats({ id, tier: def.minTier }, neutralStats);

    results.push({
        id,
        name: def.name,
        minTier: def.minTier,
        isBoss: !!def.exclusiveBossId,
        synergies: def.synergy || [],
        behavior: def.behavior,
        baseDmg: def.baseDmg,
        cd: def.cd,
        range: Number((st.range).toFixed(2)),
        crit: st.crit,
        trueSingleDps: Number(dpsT1.toFixed(2)),
        trueT4Dps: dpsT4 ? Number(dpsT4.toFixed(2)) : null,
        t4Multiplier: dpsT4 ? Number((dpsT4 / dpsT1).toFixed(2)) : null,
        scaleKey,
        scaleRatio,
        statGainPer10: Number(statGain.toFixed(2)),
        aspdGainPer20: Number(aspdGain.toFixed(2))
    });
}

fs.writeFileSync(path.join(__dirname, 'true_dps_results.json'), JSON.stringify(results, null, 2));
console.log('True DPS calculated successfully for', results.length, 'weapons!');
