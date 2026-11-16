const fs = require('fs');
const path = require('path');
const { setup } = require('../analysis/combat-benchmark.cjs');
const { app, context } = setup(1);
const vm = require('vm');

const weaponsDB = vm.runInContext('WEAPONS_DB', context);
const balance = vm.runInContext('BALANCE', context);
const bossRules = vm.runInContext('BOSS_WEAPON_RULES', context);
const statsMeta = vm.runInContext('STAT_META', context);

const neutralStats = {
    maxHp: 25, hpRegen: 0, lifeSteal: 0, dmgPct: 0,
    meleeDmg: 0, rangedDmg: 0, magicDmg: 0,
    attackSpeed: 0, critChance: 5, critEffectPct: 0,
    rangePct: 0, armor: 0, dodge: 0, speed: 0, luck: 0, harvesting: 0
};

function getExpectedHit(damage, critRate, critMult = 1.75) {
    const c = Math.max(0, Math.min(100, critRate)) / 100;
    return damage + (Math.round(damage * critMult) - damage) * c;
}

const analysis = [];

for (const [id, def] of Object.entries(weaponsDB)) {
    app.stats = { ...neutralStats };
    app.selectedCoreId = null;

    const combatT1 = app.getWeaponCombatStats({ id, tier: def.minTier });
    const factsT1 = app.getWeaponFacts({ id, tier: def.minTier }, neutralStats);

    // Calculate baseline DPS
    const baseHit = combatT1.dmg;
    const critRate = combatT1.crit;
    const critMult = combatT1.critMultiplier || 1.75;
    const cd = combatT1.cd;
    const reach = combatT1.range;
    const expHit = getExpectedHit(baseHit, critRate, critMult);
    const baseDps = expHit / cd;

    // Scaling analysis: test +10 flat primary stat
    const scaleKey = Object.keys(def.scale || {})[0] || 'meleeDmg';
    const scaleRatio = def.scale ? def.scale[scaleKey] : 1.0;

    app.stats = { ...neutralStats, [scaleKey]: 10 };
    const combatWithStat = app.getWeaponCombatStats({ id, tier: def.minTier });
    const hitWithStat = getExpectedHit(combatWithStat.dmg, combatWithStat.crit, combatWithStat.critMultiplier);
    const dpsWithStat = hitWithStat / combatWithStat.cd;
    const dpsGainPer10Stat = dpsWithStat - baseDps;

    // Scaling analysis: test +20% Attack Speed
    app.stats = { ...neutralStats, attackSpeed: 20 };
    const combatWithAspd = app.getWeaponCombatStats({ id, tier: def.minTier });
    const dpsWithAspd = expHit / combatWithAspd.cd;
    const dpsGainPer20Aspd = dpsWithAspd - baseDps;

    // Tier 4 comparison (if not exclusive)
    let t4Dps = null;
    let t4Hit = null;
    if (!def.exclusiveBossId) {
        app.stats = { ...neutralStats };
        const combatT4 = app.getWeaponCombatStats({ id, tier: 4 });
        t4Hit = getExpectedHit(combatT4.dmg, combatT4.crit, combatT4.critMultiplier);
        t4Dps = t4Hit / combatT4.cd;
    }

    // Determine target capacity & AoE classification
    let aoeType = 'Single';
    let maxTargets = 1;
    let aoeMultiplier = 1.0;

    if (['sweep', 'sweep_beam', 'charge_melee'].includes(def.behavior)) {
        aoeType = 'Melee Cleave';
        maxTargets = 4;
        aoeMultiplier = 3.0;
    } else if (def.behavior === 'chain') {
        aoeType = 'Chain Arc';
        maxTargets = 3;
        aoeMultiplier = 1.9; // e.g. 10 + 6 + 3 = 19 vs 10
    } else if (def.behavior === 'field') {
        aoeType = 'Area Pulse';
        maxTargets = 5;
        aoeMultiplier = 4.0;
    } else if (def.behavior === 'corrosion' || def.behavior === 'vortex') {
        aoeType = 'Cone DoT';
        maxTargets = 3;
        aoeMultiplier = 2.0;
    } else if (def.behavior === 'boomerang' || def.behavior === 'zenith' || def.behavior === 'orbit') {
        aoeType = 'Return / Orbit';
        maxTargets = 3;
        aoeMultiplier = 2.0;
    } else if (def.behavior === 'scatter') {
        aoeType = 'Spread Blast';
        maxTargets = 3;
        aoeMultiplier = 1.8;
    } else if (def.pierce && def.pierce > 1) {
        aoeType = 'Piercing Line';
        maxTargets = def.pierce;
        aoeMultiplier = Math.min(2.5, 1 + (def.pierce - 1) * 0.5);
    } else if (def.behavior === 'turret') {
        aoeType = 'Sentry Construct';
        maxTargets = 2;
        aoeMultiplier = 1.5;
    }

    const estimatedAoeDps = baseDps * aoeMultiplier;

    analysis.push({
        id,
        name: def.name,
        minTier: def.minTier,
        isBoss: !!def.exclusiveBossId,
        synergies: def.synergy || [],
        behavior: def.behavior,
        aoeType,
        maxTargets,
        baseHit,
        cd: Number(cd.toFixed(2)),
        reach: Number(reach.toFixed(2)),
        critRate,
        critMult,
        expHit: Number(expHit.toFixed(2)),
        baseDps: Number(baseDps.toFixed(2)),
        aoeDps: Number(estimatedAoeDps.toFixed(2)),
        scaleKey,
        scaleRatio,
        dpsGainPer10Stat: Number(dpsGainPer10Stat.toFixed(2)),
        dpsGainPer20Aspd: Number(dpsGainPer20Aspd.toFixed(2)),
        t4Dps: t4Dps ? Number(t4Dps.toFixed(2)) : null,
        t4Ratio: t4Dps ? Number((t4Dps / baseDps).toFixed(2)) : null,
        cores: factsT1.cores || []
    });
}

// Compute summary stats
const tier1List = analysis.filter(w => w.minTier === 1 && !w.isBoss);
const dpsList = tier1List.map(w => w.baseDps);
const meanDps = dpsList.reduce((a, b) => a + b, 0) / dpsList.length;
const sortedDps = [...dpsList].sort((a, b) => a - b);
const medianDps = sortedDps[Math.floor(sortedDps.length / 2)];
const minDps = Math.min(...dpsList);
const maxDps = Math.max(...dpsList);
const stdDev = Math.sqrt(dpsList.reduce((acc, v) => acc + Math.pow(v - meanDps, 2), 0) / dpsList.length);

const summary = {
    totalWeapons: analysis.length,
    tier1Count: tier1List.length,
    tier1MeanDps: Number(meanDps.toFixed(2)),
    tier1MedianDps: Number(medianDps.toFixed(2)),
    tier1MinDps: Number(minDps.toFixed(2)),
    tier1MaxDps: Number(maxDps.toFixed(2)),
    tier1StdDev: Number(stdDev.toFixed(2)),
    weapons: analysis
};

fs.writeFileSync(path.join(__dirname, 'weapon_balance_metrics.json'), JSON.stringify(summary, null, 2));
console.log('Balance metrics generated successfully!');
console.log('Tier 1 Mean DPS:', meanDps, 'Median:', medianDps, 'Min:', minDps, 'Max:', maxDps, 'StdDev:', stdDev);
