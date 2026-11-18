// 使用真实购买、拾取、升级与奖励流程，记录固定脚本前五波；不代表真人胜率。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { setup } = require('./combat-benchmark.cjs');
const policies = {
    output: { character: 'ranger', reserve: 0, rerolls: 0, items: true },
    refresh: { character: 'ranger', reserve: 0, rerolls: 3, items: true },
    economy: { character: 'guide', reserve: 20, rerolls: 1, items: true },
    saver: { character: 'guide', reserve: 80, rerolls: 0, items: false }
};
function steer(app) {
    const boss = app.activeBoss;
    const danger = boss?.hp > 0 && ['warn', 'leap', 'charge'].includes(boss.ai.phase);
    let target;
    if (danger) {
        const ai = boss.ai;
        if (boss.bossId) {
            // 新Boss锁定几何预警；不能读取旧眼球专用坐标，否则会产生NaN走位。
            const p=app.playerPos;
            if(ai.ring){
                const dx=p.x-ai.ring.x,dz=p.z-ai.ring.z,d=Math.hypot(dx,dz)||1;
                target={x:ai.ring.x+(dx||1)/d*(ai.ring.outer+2),z:ai.ring.z+dz/d*(ai.ring.outer+2)};
            }else if(ai.shapes?.length){
                const s=[...ai.shapes].sort((a,b)=>app.pointToSegmentDist(p.x,p.z,a.x,a.z,a.ex,a.ez)-app.pointToSegmentDist(p.x,p.z,b.x,b.z,b.ex,b.ez))[0];
                const dx=s.ex-s.x,dz=s.ez-s.z,d=Math.hypot(dx,dz);
                let nx=d?-dz/d:p.x-s.x,nz=d?dx/d:p.z-s.z;
                const normal=Math.hypot(nx,nz)||1;nx/=normal;nz/=normal;
                if(!nx&&!nz)nx=1;
                const sign=(p.x-s.x)*nx+(p.z-s.z)*nz>=0?1:-1;
                target={x:p.x+nx*8*sign,z:p.z+nz*8*sign};
            }else target={x:p.x+8,z:p.z};
        }else target = { x: app.playerPos.x + (boss.behavior === 'king_slime' ? 8 : ai.endZ - ai.startZ), z: app.playerPos.z + (boss.behavior === 'king_slime' ? 0 : ai.startX - ai.endX) };
    } else {
        const candidates = app.pickups.filter(p => p.type !== 'heart' || app.hp < app.stats.maxHp);
        candidates.sort((a, b) => Math.hypot(a.mesh.position.x - app.playerPos.x, a.mesh.position.z - app.playerPos.z) - Math.hypot(b.mesh.position.x - app.playerPos.x, b.mesh.position.z - app.playerPos.z));
        target = candidates[0]?.mesh.position || { x: Math.cos(app.combatElapsed * .5) * 9, z: Math.sin(app.combatElapsed * .5) * 9 };
    }
    let dx = Math.max(-18, Math.min(18, target.x)) - app.playerPos.x;
    let dz = Math.max(-18, Math.min(18, target.z)) - app.playerPos.z;
    // 靠近普通敌人时侧移，避免固定脚本一直迎面撞怪。
    if (!danger) for (const enemy of app.enemies) {
        if (enemy.hp <= 0) continue;
        const ex = app.playerPos.x - enemy.group.position.x, ez = app.playerPos.z - enemy.group.position.z;
        const distance = Math.hypot(ex, ez);
        if (distance < enemy.radius + 2) { dx += ex * 8; dz += ez * 8; }
    }
    const length = Math.hypot(dx, dz) || 1;
    app.joyVec = { x: dx / length, y: dz / length };
    if (danger && !app.dashTimer) app.tryDash();
}
function run(seed, policyName, maxWave = 5) {
    const engine = setup(seed), { app, context } = engine, policy = policies[policyName];
    const proto = vm.runInContext('TerraBrotatoApp.prototype', context);
    const character = vm.runInContext(`CHARACTERS.find(c=>c.id==='${policy.character}')`, context);
    for (const [key, value] of Object.entries(character.mods)) app.baseStats[key] += value;
    Object.assign(app, { selectedCharId:policy.character,xp: 0, xpNext: 16, pendingCrates: 0, pendingLevelUps: 0, shopCards: [], gold: 30, rewardSeed:seed, selectedCoreId: null, pendingCoreChoice: false });
    app.weaponOrbitGroup = new app.entitiesGroup.constructor();
    for (const method of ['gainXP', 'spawnTerraProp', 'endWave', 'triggerGameOver']) app[method] = proto[method];
    app.testingMode=true;
    app.addWeapon(character.starter, 1);
    const rows = [], actions = [];
    let earned = 0, spent = 0;
    for (let wave = 1; wave <= maxWave; wave++) {
        const openingGold = app.gold;
        app.startWave(wave);
        for (let frame = 0; frame < 120 * 60 && app.state === 'WAVE'; frame++) {
            steer(app); engine.advance(1 / 60);
            if(!Number.isFinite(app.playerPos.x)||!Number.isFinite(app.playerPos.z)||!Number.isFinite(app.hp))throw new Error('战斗模拟产生非有限坐标或生命，拒绝输出无效结果');
        }
        if (app.state === 'WAVE') { rows.push({ wave, state: 'TIMEOUT' }); break; }
        const combatGold = app.gold;
        let guard = 0;
        while (['WAVE_REPORT', 'CRATE', 'LEVELUP', 'CORE', 'BOSS_REWARD'].includes(app.state) && guard++ < 100) {
            if (app.state === 'WAVE_REPORT') app.closeWaveReport();
            else if (app.state === 'CRATE') app.resolveCrate(true);
            else if (app.state === 'BOSS_REWARD') {
                const held=app.weapons.find(w=>w.id===app.pendingBossReward.weaponId);
                app.pickBossReward(held?'single':app.weapons.length<6?6:0);
            }
            else if (app.state === 'CORE') app.pickCore('none');
            else {
                const priority = policyName === 'economy' ? ['harvesting', 'maxHp', 'rangedDmg', 'attackSpeed'] : ['rangedDmg', 'attackSpeed', 'maxHp', 'armor'];
                const choices = [...app.levelUpChoices].sort((a, b) => (priority.indexOf(a.key) < 0 ? 99 : priority.indexOf(a.key)) - (priority.indexOf(b.key) < 0 ? 99 : priority.indexOf(b.key)));
                app.pickUpgrade(choices[0].key, choices[0].val);
            }
        }
        const shopOpening = app.gold;
        earned += shopOpening - openingGold;
        if (app.state === 'SHOP') for (let roll = 0; roll <= policy.rerolls; roll++) {
            const choices = app.shopCards.map((card, index) => ({ card, index })).sort((a, b) => Number(b.card.kind === 'weapon') - Number(a.card.kind === 'weapon') || a.card.price - b.card.price);
            for (const { card, index } of choices) {
                if (card.bought || app.gold - card.price < policy.reserve || (card.kind === 'item' && !policy.items)) continue;
                const before = app.gold;
                if(card.kind==='boss_upgrade')app.buyBossUpgrade(index,app.weapons.find(w=>w.instanceId===card.instanceId)?.branch||'single');
                else app.buyShopCard(index);
                if (app.gold < before) actions.push({ wave, kind: card.kind, id: card.id, tier: card.tier, cost: before - app.gold });
            }
            if (roll === policy.rerolls || app.gold - app.shopRerollCost < policy.reserve) break;
            const cost = app.shopRerollCost;
            app.gold -= cost; app.shopRerolls++; app.shopRerollCost = vm.runInContext(`getShopRerollCost(${wave},${app.shopRerolls})`, context);
            app.generateShopCards(); actions.push({ wave, kind: 'reroll', cost });
        }
        spent += shopOpening - app.gold;
        rows.push({ wave, state: app.state, openingGold, combatGold, shopOpening, closingGold: app.gold, bank: app.baggedGold, level: app.level, hp: app.hp, weapons: app.weapons.map(w => ({ id: w.id, tier: w.tier })), items: app.ownedItems.length, metrics: app.runHistory.at(-1) });
        if (app.state !== 'SHOP') break;
    }
    return { seed, policy: policyName, earned, spent, closingGold: app.gold, outcome: app.runHistory.at(-1)?.outcome || null, rows, actions };
}
function screenshotCase(seed) {
    const engine = setup(seed), { app } = engine; app.rewardSeed=seed;
    Object.assign(app.baseStats, { maxHp: 26, dmgPct: -6, meleeDmg: 6, rangedDmg: 12, attackSpeed: 30, critChance: 22, dodge: 25, speed: 12, luck: 26, harvesting: 17 });
    for (const [id, tier] of [['minishark', 2], ['light_disc', 2], ['minishark', 1], ['megashark', 2], ['water_bolt', 2], ['copper_sword', 2]]) {
        // 保留截图的旧构筑作为压力测试，不受新商店开放规则约束。
        const mesh = new app.entitiesGroup.constructor();
        app.weapons.push({ id, tier, cd: .2, mesh, recoil: mesh.position.clone() });
    }
    const withSynergies = app.calculateBuildStats(app.weapons).stats;
    for (const key of Object.keys(app.baseStats)) app.baseStats[key] -= withSynergies[key] - app.baseStats[key];
    app.startWave(5); app.queueEnemySpawn = () => {};
    for (let i = 0; i < 90 * 60 && app.activeBoss.hp > 0 && app.state === 'WAVE'; i++) { steer(app); engine.advance(1 / 60); }
    return { seed, bossKilledAt: app.waveMetrics.bossKillSeconds, hp: app.hp, state: app.state, bossHp: app.activeBoss?.hp, theoreticalDps: app.getBuildDpsCeiling(app.weapons, app.stats) };
}
if (require.main === module) {
    const result = { sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', 'terrabrotato.html'))).digest('hex'), method: '真实战斗、掉落、拾取、购买、升级、宝箱与跨波储蓄；固定60Hz、脚本收集与避敌，无无敌或额外资源。4种固定购买策略各3个种子，并非最优打法或真人胜率。截图压力场重建截图属性与武器，未选择Boss击杀后才获得的核心；水矢品质按II阶近似，不能重现原局走位、随机状态和逐帧输出。', results: Object.keys(policies).flatMap(policy => [11, 29, 47].map(seed => run(seed, policy))), screenshot: [11, 29, 47].map(screenshotCase) };
    fs.writeFileSync(process.argv[2] || path.join(__dirname, 'early-game-benchmark.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ runs: result.results.map(r => ({ policy: r.policy, seed: r.seed, earned: r.earned, spent: r.spent, gold: r.closingGold, final: r.rows.at(-1)?.state, wave: r.rows.at(-1)?.wave })), screenshot: result.screenshot }, null, 2));
}
module.exports = { run, screenshotCase };
