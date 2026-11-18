const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// 直接执行产品脚本，用最小 DOM 替身验证状态与经济规则，不依赖浏览器和 CDN。
const html = fs.readFileSync(path.join(__dirname, '..', 'terrabrotato.html'), 'utf8');
const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).filter(script => script.trim()).join('\n');

function loadGame() {
    const elements = new Map();
    const context = vm.createContext({
        console,
        performance: { now: () => 0 },
        setTimeout() {},
        window: { addEventListener() {} },
        document: {
            getElementById(id) {
                if (!elements.has(id)) {
                    const classes = new Set();
                    elements.set(id, {
                        style: {},
                        classList: {
                            add: (...names) => names.forEach(name => classes.add(name)),
                            remove: (...names) => names.forEach(name => classes.delete(name)),
                            contains: name => classes.has(name),
                        },
                    });
                }
                return elements.get(id);
            },
        },
    });
    vm.runInContext(source, context);
    const evaluate = script => vm.runInContext(script, context);
    const app = evaluate('Object.create(TerraBrotatoApp.prototype)');
    Object.assign(app, {
        state: 'WAVE', wave: 1, waveTimer: 0, hp: 25, level: 1,
        gold: 30, baggedGold: 0, pendingCrates: 0, pendingLevelUps: 0,
        totalKills: 0, totalDmg: 0, waveBossDefeated: false,
        stats: { harvesting: 12, luck: 0, maxHp: 25 },
        baseStats: { harvesting: 12 },
        pickups: [], shopCards: [], ownedItems: [], weapons: [],
        gainXP(amount) { this.awardedXP = (this.awardedXP || 0) + amount; },
        recalcStats() {},
        clearEntities() { this.pickups = []; this.activeBoss = null; },
        advancePostWave() { this.state = 'SHOP'; },
        renderShopUI() {},
        updateHUD() {},
    });
    context.testApp = app;
    evaluate('app = testApp');
    return { app, context, evaluate, elements };
}

function prepareCombat(app) {
    const makeMesh = () => ({ position: { set(x, y, z) { Object.assign(this, { x, y, z }); } }, rotation: {}, scale: { set() {} } });
    Object.assign(app, {
        waveTimer: 10, playerPos: { x: 0, z: 0 }, keys: {}, joyVec: { x: 0, y: 0 },
        lastMoveDir: { x: 1, z: 0 }, dashTimer: 0, dashCooldown: 0, invulnTimer: 0,
        enemies: [], props: [], meleeAttacks: [], fallingStars: [],
        createMeleeVisual: makeMesh,
        disposeCombatMesh() {},
        spawnBurstParticles() {}, spawnFloatText() {},
    });
    return makeMesh;
}

function prepareBoss(app, behavior = 'king_slime') {
    prepareCombat(app);
    const boss = {
        behavior, isBoss: true, name: behavior === 'king_slime' ? '史莱姆王' : '克苏鲁之眼',
        hp: 540, maxHp: 540, speed: 3.9, dmg: behavior === 'king_slime' ? 8 : 12, radius: 2.15,
        group: { position: { x: 0, y: 0, z: -10 }, rotation: { y: 0 } },
        knockback: { x: 0, z: 0 }, phase1Face: { visible: true }, phase2Jaws: { visible: false },
        ai: { phase: 'chase', remaining: 2.5, duration: 2.5 }
    };
    app.createBossWarning = (...area) => ({ area });
    app.activeBoss = boss;
    app.enemies = [boss];
    app.updateBossBar();
    return boss;
}

test('史莱姆王锁定落点，完整预警与飞行后只结算一次跳砸', () => {
    const { app, elements } = loadGame();
    const boss = prepareBoss(app);
    const hits = [];
    app.damagePlayer = (damage, source) => hits.push({ damage, source });
    boss.ai.remaining = .01;
    app.updateBossBehavior(boss, .02);
    assert.equal(boss.ai.phase, 'warn');
    assert.match(elements.get('boss-name').textContent, /离开红圈/);
    app.updateBossBehavior(boss, .93);
    assert.equal(boss.ai.phase, 'warn');
    assert.equal(hits.length, 0);
    app.updateBossBehavior(boss, .31);
    assert.equal(boss.ai.phase, 'leap');
    assert.ok(boss.group.position.y > 6);
    assert.equal(hits.length, 0);
    app.updateBossBehavior(boss, .3);
    assert.equal(boss.ai.phase, 'recover');
    assert.equal(boss.group.position.y, 0);
    assert.equal(boss.bossWarning, null);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].damage, 14);
    assert.match(hits[0].source, /跳砸/);
    app.updateBossBehavior(boss, .5);
    assert.equal(hits.length, 1);
});

test('离开锁定红圈可避开跳砸，飞行阶段地面武器不能命中Boss', () => {
    const { app } = loadGame();
    const boss = prepareBoss(app);
    app.beginBossWarning(boss);
    app.playerPos.x = 8;
    let damage = 0;
    app.damagePlayer = () => damage++;
    app.updateBossBehavior(boss, .96);
    assert.equal(boss.ai.endX, 0);
    const hp = boss.hp;
    app.hitTarget(boss, 500, 100, 0, 0);
    assert.equal(boss.hp, hp);
    app.updateBossBehavior(boss, .6);
    assert.equal(damage, 0);
    assert.equal(boss.group.position.x, 0);
});

test('眼球锁定冲锋路线，大步长跨过玩家仍命中且每次冲锋只判定一次', () => {
    const { app } = loadGame();
    const boss = prepareBoss(app, 'eye_of_cthulhu');
    boss.ai.chargesLeft = 1;
    app.beginBossWarning(boss);
    const endpoint = boss.ai.endZ;
    const hits = [];
    app.damagePlayer = (damage, source) => hits.push({ damage, source });
    app.updateBossBehavior(boss, .84);
    assert.equal(boss.ai.phase, 'warn');
    assert.equal(hits.length, 0);
    app.playerPos.z = -5;
    app.updateBossBehavior(boss, .56);
    assert.equal(boss.ai.phase, 'recover');
    assert.equal(boss.group.position.z, endpoint);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].damage, 18);
    app.updateBossBehavior(boss, .5);
    assert.equal(hits.length, 1);
});

test('眼球半血两连冲各自完整预警，阶段变化不会缩短已开始的预警', () => {
    const { app } = loadGame();
    const boss = prepareBoss(app, 'eye_of_cthulhu');
    app.beginBossWarning(boss);
    boss.hp = boss.maxHp / 2;
    app.playerPos.x = 15;
    app.updateBossBehavior(boss, .1);
    assert.equal(boss.phase2, true);
    assert.equal(boss.phase1Face.visible, false);
    assert.equal(boss.phase2Jaws.visible, true);
    assert.equal(boss.ai.duration, .85);
    boss.ai.phase = 'chase'; boss.ai.remaining = .01;
    app.updateBossBehavior(boss, .01);
    assert.equal(boss.ai.chargesLeft, 2);
    assert.equal(boss.ai.duration, .65);
    app.damagePlayer = () => {};
    app.updateBossBehavior(boss, 1.2);
    assert.equal(boss.ai.phase, 'recover');
    assert.equal(boss.ai.chargesLeft, 1);
    app.updateBossBehavior(boss, .7);
    assert.equal(boss.ai.phase, 'warn');
    assert.equal(boss.ai.duration, .65);
    app.updateBossBehavior(boss, 1.2);
    assert.equal(boss.ai.phase, 'recover');
    assert.equal(boss.ai.chargesLeft, 0);
    assert.equal(boss.ai.duration, 1.25);
});

test('横向躲避和冲刺无敌均可躲过冲锋，被躲过的一次冲锋不重复追伤', () => {
    const { app } = loadGame();
    const boss = prepareBoss(app, 'eye_of_cthulhu');
    app.stats.dodge = 0; app.stats.armor = 0;
    app.beginBossWarning(boss);
    app.playerPos.x = 10;
    app.updateBossBehavior(boss, 1.4);
    assert.equal(app.hp, 25);
    boss.group.position.x = 0; boss.group.position.z = -10;
    app.playerPos.x = 0; app.playerPos.z = 0;
    boss.ai.chargesLeft = 1;
    app.beginBossWarning(boss);
    app.dashTimer = .45;
    app.updateBossBehavior(boss, 1.4);
    assert.equal(app.hp, 25);
    assert.equal(boss.ai.hitPlayer, true);
    app.dashTimer = 0;
    app.updateBossBehavior(boss, .1);
    assert.equal(app.hp, 25);
});

test('预警与硬直不产生Boss接触伤害，追击接触减半且读取移动后位置', () => {
    const { app } = loadGame();
    const boss = prepareBoss(app);
    boss.group.position.z = -2.8;
    const hits = [];
    app.damagePlayer = damage => hits.push(damage);
    app.updateEnemies(.1);
    assert.deepEqual(hits, [4]);
    hits.length = 0;
    app.beginBossWarning(boss);
    app.updateEnemies(.1);
    assert.equal(hits.length, 0);
    boss.ai.phase = 'recover'; boss.ai.remaining = 1; boss.ai.chargesLeft = 0;
    app.updateEnemies(.1);
    assert.equal(hits.length, 0);
});

test('暂停不推进Boss技能，墙边目标和重合方向保持有限且在场内', () => {
    const { app, evaluate } = loadGame();
    const boss = prepareBoss(app, 'eye_of_cthulhu');
    app.playerPos.z = -10;
    app.beginBossWarning(boss);
    assert.ok(Number.isFinite(boss.ai.endZ));
    const remaining = boss.ai.remaining;
    app.state = 'PAUSED';
    app.updateEnemies(10);
    app.updateBossBehavior(boss, 10);
    assert.equal(boss.ai.remaining, remaining);
    app.state = 'WAVE';
    app.playerPos.x = 1000; app.playerPos.z = 1000;
    app.beginBossWarning(boss);
    const bound = evaluate('ARENA_HALF') - boss.radius;
    assert.ok(Math.abs(boss.ai.endX) <= bound && Math.abs(boss.ai.endZ) <= bound);
});

test('Boss死亡、玩家死亡及清场均释放预警，决战中仍推进技能', () => {
    const { app, evaluate } = loadGame();
    const boss = prepareBoss(app);
    let disposed = 0;
    app.disposeCombatMesh = () => disposed++;
    app.beginBossWarning(boss);
    app.entitiesGroup = { remove() {}, children: [] };
    app.spawnPickup = () => {};
    app.hitTarget(boss, 9999, 0, 0, 0);
    assert.equal(disposed, 2, '预警与Boss模型均应释放');
    assert.equal(boss.bossWarning, null);
    const next = prepareBoss(app);
    app.waveTimer = 0;
    app.beginBossWarning(next);
    app.updateBossBehavior(next, 1.55);
    assert.equal(next.ai.phase, 'recover');
    app.beginBossWarning(next);
    app.triggerGameOver(false);
    assert.equal(next.bossWarning, null);
    app.state = 'WAVE';
    app.beginBossWarning(next);
    app.clearEntities = evaluate('TerraBrotatoApp.prototype.clearEntities');
    app.clearEntities();
    assert.equal(next.bossWarning, null);
    assert.equal(app.enemies.length, 0);
});

test('Boss阶段计时在30、60、120帧下保持一致', () => {
    const results = [30, 60, 120].map(fps => {
        const { app } = loadGame();
        const boss = prepareBoss(app, 'eye_of_cthulhu');
        boss.hp = boss.maxHp / 2;
        let hits = 0;
        app.damagePlayer = () => hits++;
        for (let frame = 0; frame < fps * 18; frame++) app.updateBossBehavior(boss, 1 / fps);
        return { phase: boss.ai.phase, remaining: boss.ai.remaining, x: boss.group.position.x, z: boss.group.position.z, hits };
    });
    for (const result of results.slice(1)) {
        assert.equal(result.phase, results[0].phase);
        assert.equal(result.hits, results[0].hits);
        for (const key of ['remaining', 'x', 'z']) assert.ok(Math.abs(result[key] - results[0][key]) < 1e-8);
    }
});

test('Boss技能致命后立即停止本帧敌人更新并记录技能来源', () => {
    const { app } = loadGame();
    const boss = prepareBoss(app, 'eye_of_cthulhu');
    app.hp = 1;
    let displayedHp = null;
    app.updateHUD = () => { displayedHp = app.hp; };
    app.stats.armor = 0; app.stats.dodge = 0;
    app.waveMetrics = { seconds: 1, damage: 0, bossSeconds: 1, bossDamage: 0, bossKillSeconds: null, attacks: 0, landedAttacks: 0, lifeStealHealing: 0, damageTaken: 0 };
    app.enemies = [{ get group() { throw new Error('死亡后不应继续更新下一个敌人'); } }, boss];
    boss.ai.chargesLeft = 1;
    app.beginBossWarning(boss);
    app.updateEnemies(1.4);
    assert.equal(app.state, 'GAMEOVER');
    assert.equal(app.hp, 0);
    assert.equal(app.runHistory[0].deathCause, '旧型巡游构装·冲锋');
    assert.equal(displayedHp, 0);
    assert.equal(boss.bossWarning, null);
});

test('品质按波次解锁，起始武器均为一阶', () => {
    const { evaluate } = loadGame();
    assert.equal(evaluate('[1,2,3,5,6,8,9,20].map(getUnlockedTier).join()'), '1,1,2,2,2,3,3,4');
    assert.equal(evaluate('getStarterWeaponIds().length'), 8);
    assert.equal(evaluate('getStarterWeaponIds().every(id => WEAPONS_DB[id].minTier === 1)'), true);
    assert.equal(evaluate('getStarterWeaponIds().includes("zenith")'), false);
});

test('商店以即将进入的波次限制品质，幸运不会越过上限', () => {
    const { app, evaluate } = loadGame();
    evaluate('Math.random = () => .99999');
    app.stats.luck = 999;
    for (const [wave, maximum] of [[1, 1], [2, 2], [7, 3], [13, 4]]) {
        app.wave = wave;
        app.shopCards = [];
        app.generateShopCards();
        assert.ok(app.shopCards.every(card => card.tier <= maximum));
        assert.equal(app.shopCards[0].tier, maximum);
        assert.ok(evaluate('testApp.shopCards.filter(c => c.kind === "weapon").every(c => WEAPONS_DB[c.id].minTier <= c.tier)'));
    }
});

test('六件羁绊保留四件奖励，平坦伤害与暴击升级按新曲线生效', () => {
    const { app, evaluate } = loadGame();
    app.baseStats = evaluate('Object.fromEntries(STAT_META.map(s => [s.key, 0]))');
    for (const id of ['grass_blade', 'light_disc']) {
        const four = app.calculateBuildStats(Array.from({ length: 4 }, () => ({ id, tier: 1 }))).stats;
        const six = app.calculateBuildStats(Array.from({ length: 6 }, () => ({ id, tier: 1 }))).stats;
        for (const key of Object.keys(four)) assert.ok(six[key] >= four[key], `${id} 的 ${key} 不应倒退`);
    }
    const stats = { ...app.baseStats, meleeDmg: 3 };
    const weapon = app.getWeaponCombatStats({ id: 'zenith', tier: 4 }, stats);
    assert.equal(weapon.dmg, 103);
    assert.ok(Math.abs(weapon.cd - .42) < 1e-12);
    assert.equal(evaluate('STAT_META.find(s => s.key === "critChance").upVal'), 8);
});

test('冷却保留余量，各帧率发数一致且空场不会蓄积连发', () => {
    const { app } = loadGame();
    const counts = [30, 60, 120].map(fps => {
        const weapon = { cd: .2 };
        let count = 0;
        for (let i = 0; i < fps * 10; i++) count += app.consumeWeaponCooldown(weapon, 1 / fps, .09, true);
        return count;
    });
    assert.equal(new Set(counts).size, 1);
    const weapon = { cd: .1 };
    assert.equal(app.consumeWeaponCooldown(weapon, 100, .09, false), 0);
    assert.equal(app.consumeWeaponCooldown(weapon, .01, .09, true), 1);
});

test('吸血共享滚动一秒上限，满血与非战斗不会消耗额度', () => {
    const { app } = loadGame();
    prepareCombat(app);
    app.hp = 10;
    app.combatElapsed = 0;
    assert.equal(app.applyLifeSteal(), 1);
    assert.equal(app.applyLifeSteal(), .25);
    assert.equal(app.applyLifeSteal(), 0);
    app.combatElapsed = .999;
    assert.equal(app.applyLifeSteal(), 0);
    app.combatElapsed = 1;
    assert.equal(app.applyLifeSteal(), 1);
    app.state = 'PAUSED';
    app.combatElapsed = 2;
    assert.equal(app.applyLifeSteal(), 0);
    app.state = 'WAVE';
    app.hp = 25;
    assert.equal(app.applyLifeSteal(), 0);
    app.hp = 24;
    assert.equal(app.applyLifeSteal(), 1);
});

test('合成预览计算整个构筑且不改变现有装备与属性', () => {
    const { app, evaluate } = loadGame();
    app.baseStats = evaluate('Object.fromEntries(STAT_META.map(s => [s.key, 0]))');
    app.weapons = Array.from({ length: 4 }, () => ({ id: 'grass_blade', tier: 1 }));
    app.wave=3;
    const original = JSON.stringify(app.weapons);
    const base = JSON.stringify(app.baseStats);
    const preview = app.getCombinePreview(0);
    assert.ok(preview.before > 0 && preview.after > 0);
    assert.equal(preview.changes,'','I阶合成II阶应保留原羁绊');
    assert.ok(preview.after>=preview.before*.8,'合成保留至少80%的理论输出并释放槽位');
    assert.equal(JSON.stringify(app.weapons), original);
    assert.equal(JSON.stringify(app.baseStats), base);
    assert.equal(app.getCombinePreview(8), null);
});

test('多段理论上限使用与攻击相同的剑气及星怒系数', () => {
    const { app } = loadGame();
    app.getWeaponCombatStats = () => ({ dmg: 100, crit: 0, cd: 1 });
    assert.equal(app.getBuildDpsCeiling([{ id: 'terra_blade', tier: 3 }], {}), 145);
    assert.equal(app.getBuildDpsCeiling([{ id: 'starfury', tier: 1 }], {}), 100);
});

test('波次统计只结算一次，输出与命中率保留各自分母', () => {
    const { app } = loadGame();
    app.waveMetrics = { seconds: 10, damage: 100, bossSeconds: 5, bossDamage: 60, attacks: 4, landedAttacks: 3, lifeStealHealing: 1.25, bossKillSeconds: 5 };
    app.recordWaveResult('cleared');
    app.recordWaveResult('cleared');
    assert.equal(app.runHistory.length, 1);
    assert.equal(app.runHistory[0].effectiveDps, 10);
    assert.equal(app.runHistory[0].bossEffectiveDps, 12);
    assert.equal(app.runHistory[0].attackHitRate, .75);
    assert.match(app.formatWaveSummary(app.runHistory[0]), /75%/);
});

test('宝箱按当前波次限制品质，不提前套用下一波上限', () => {
    const { app, evaluate } = loadGame();
    app.art = { urls: {} };
    app.pendingCrates = 1;
    evaluate('Math.random = () => .99999');
    for (const [wave, maximum] of [[2, 1], [5, 2], [8, 3], [9, 4]]) {
        app.wave = wave;
        app.openCratePhase();
        assert.ok(app.currentCrateItem.tier <= maximum);
    }
});

test('实际星怒与剑气采用新系数，多段共享一次释放记录', () => {
    const { app, evaluate } = loadGame();
    app.playerPos = {x:0,z:0};
    const target = { group: { position: { x: 3, z: 0 } } };
    const weapon = { id: 'starfury', recoil: { set() {} } };
    const hits = [];
    app.waveMetrics = { attacks: 0 };
    app.startMeleeAttack = (...args) => hits.push(args[4]);
    app.spawnFallingStar = (x, z, stats) => hits.push(stats);
    app.fireWeapon(weapon, evaluate('WEAPONS_DB.starfury'), { dmg: 100 }, 0, 0, target);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].dmg, 100);
    assert.equal(app.waveMetrics.attacks, 1);
    app.spawnProj = config => hits.push(config);
    app.fireWeapon({ ...weapon, id: 'terra_blade' }, evaluate('WEAPONS_DB.terra_blade'), { dmg: 100 }, 0, 0, target);
    assert.equal(hits.at(-1).dmg, 45);
});

test('有效伤害剔除过杀与场景道具，多段命中不重复计数', () => {
    const { app, evaluate } = loadGame();
    prepareCombat(app);
    evaluate('Math.random = () => .99');
    app.stats.lifeSteal = 100;
    app.waveMetrics = { damage: 0, landedAttacks: 0, kills: 0 };
    app.entitiesGroup = { remove() {} };
    app.spawnPickup = () => {};
    let healingCalls = 0;
    app.applyLifeSteal = () => healingCalls++;
    const enemy = hp => ({ hp, knockback: { x: 0, z: 0 }, group: { position: { x: 0, z: 0 } } });
    const attack = { tracked: true, hit: false };
    app.hitTarget(enemy(3), 100, 0, 0, 0, { attack });
    app.hitTarget(enemy(10), 2, 0, 0, 0, { attack });
    app.hitTarget({ ...enemy(20), isProp: true }, 2, 0, 0, 0, { vampire: true });
    assert.equal(app.totalDmg, 5);
    assert.equal(app.waveMetrics.damage, 5);
    assert.equal(app.waveMetrics.landedAttacks, 1);
    assert.equal(healingCalls, 2);
});

test('高幸运不会把商店品质变成必出传奇，概率之和为一且不越开放波次', () => {
    const { evaluate } = loadGame();
    for (const wave of [1, 2, 3, 5, 6, 8, 9, 14, 20, 100]) {
        for (const luck of [-200, -50, 0, 235, 100000]) {
            const p = evaluate(`getTierProbabilities(${wave}, ${luck})`);
            assert.ok(Math.abs(p.reduce((sum, x) => sum + x, 0) - 1) < 1e-12);
            assert.ok(p.every(x => x >= 0));
            assert.ok(p[3] <= .08 && p[2] + p[3] <= .25 + 1e-12);
            assert.ok(p[1] + p[2] + p[3] <= .6 + 1e-12);
            assert.ok(p.slice(evaluate(`getUnlockedTier(${wave})`)).every(x => x === 0));
        }
    }
    assert.equal(evaluate('getTierProbabilities(14, 235)[3].toFixed(5)'), '0.04623');
    assert.equal(evaluate('getTierProbabilities(100, 100000).map(x => x.toFixed(2)).join()'), '0.40,0.35,0.17,0.08');
});

test('固定种子抽样验证高幸运品质分布、先抽品质及同店去重', () => {
    const { app, evaluate } = loadGame();
    evaluate('let economySeed = 17; Math.random = () => ((economySeed = (Math.imul(economySeed, 1664525) + 1013904223) >>> 0) / 4294967296)');
    app.wave = 14;
    app.stats.luck = 235;
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 2500; i++) {
        app.shopCards = [];
        app.generateShopCards();
        assert.equal(new Set(app.shopCards.map(c => `${c.kind}:${c.id}:${c.tier}`)).size, 4);
        for (const card of app.shopCards) {
            counts[card.tier - 1]++;
            if (card.kind === 'weapon') assert.ok(evaluate(`WEAPONS_DB['${card.id}'].minTier`) <= card.tier);
        }
    }
    const expected = evaluate('getTierProbabilities(15, 235)');
    // 饰品传奇唯一池为空时会向下回退；本场景未持有天界壳，无需回退。
    counts.forEach((count, i) => assert.ok(Math.abs(count / 10000 - expected[i]) < .02, `品质${i + 1}分布异常`));
});

test('宝箱概率乘算幸运并随本波掉落递减，Boss保底不消耗随机计数', () => {
    const { app, evaluate } = loadGame();
    assert.equal(evaluate('getRandomCrateChance(true, 100, 0)'), .4);
    assert.equal(evaluate('getRandomCrateChance(true, 100, 1)'), .2);
    assert.ok(Math.abs(evaluate('getRandomCrateChance(true, 100, 2)') - .4 / 3) < 1e-12);
    assert.equal(evaluate('getRandomCrateChance(false, -100, 0)'), 0);
    prepareCombat(app);
    app.stats.luck = 0;
    evaluate('Math.random = () => .075');
    app.entitiesGroup = { remove() {} };
    app.updateBossBar = () => {};
    const drops = [];
    app.spawnPickup = type => drops.push(type);
    const prop = () => ({ hp: 1, isProp: true, group: { position: { x: 0, z: 0 } } });
    app.hitTarget(prop(), 2, 0, 0, 0);
    app.hitTarget(prop(), 2, 0, 0, 0);
    assert.equal(app.randomCratesDropped, 1);
    assert.equal(drops.filter(x => x === 'crate').length, 1);
    const boss = { hp: 1, isBoss: true, knockback: { x: 0, z: 0 }, group: { position: { x: 0, z: 0 } } };
    app.hitTarget(boss, 2, 0, 0, 0);
    assert.equal(drops.filter(x => x === 'crate').length, 1);
    assert.equal(app.randomCratesDropped, 1);
});

test('经济饰品达到上限后排除抽取与购买，过期锁定卡也被替换', () => {
    const { app, evaluate } = loadGame();
    const item = evaluate('ITEMS_DB.find(it => it.id === "horseshoe")');
    app.state = 'SHOP';
    app.baseStats.dmgPct = 0;
    app.baseStats.luck = 0;
    app.gold = 100;
    app.shopCards = [{ kind: 'item', id: item.id, tier: 1, price: 20 }];
    app.buyShopCard(0);
    assert.equal(app.baseStats.luck, 8);
    assert.equal(app.baseStats.dmgPct, -3);
    app.shopCards[0].bought = false;
    app.buyShopCard(0);
    app.shopCards[0].bought = false;
    app.shopCards[0].locked = true;
    app.buyShopCard(0);
    assert.equal(app.gold, 60);
    assert.equal(app.ownedItems.length, 2);
    assert.equal(app.canAcquireItem(item), false);
    evaluate('Math.random = () => 0');
    assert.notEqual(app.chooseItemForTier(1).id, 'horseshoe');
    app.generateShopCards();
    assert.ok(app.shopCards.every(card => card.id !== 'horseshoe'));
});

test('宝箱回收按当前售价的25%结算，领奖防重且空饰品池能继续流程', () => {
    const { app, evaluate, elements } = loadGame();
    app.wave = 14;
    app.stats.luck = 0;
    app.art = { urls: {} };
    app.pendingCrates = 1;
    app.openCratePhase();
    const item = app.currentCrateItem;
    const expected = Math.floor(Math.round(item.price * 1.25 * (1 + 14 * .08)) * .25);
    assert.equal(elements.get('crate-recycle-val').textContent, `+${expected}`);
    app.resolveCrate(false);
    app.resolveCrate(false);
    assert.equal(app.gold, 30 + expected);
    app.canAcquireItem = () => false;
    app.pendingCrates = 1;
    app.openCratePhase();
    assert.equal(app.currentCrateItem.coinReward, 14);
    app.resolveCrate(true);
    assert.equal(app.gold, 44 + expected);
    assert.equal(app.state, 'SHOP');
});

test('刷新按波次增加费用，金币不足不扣款，新商店重置次数', () => {
    const { app, context } = loadGame();
    app.wave = 14;
    app.openShopPhase();
    app.gold = 100;
    assert.equal(app.shopRerollCost, 15);
    context.window.rerollShop();
    assert.equal(app.gold, 85);
    assert.equal(app.shopRerollCost, 20);
    context.window.rerollShop();
    assert.equal(app.gold, 65);
    assert.equal(app.shopRerollCost, 25);
    app.gold = 24;
    context.window.rerollShop();
    assert.equal(app.gold, 24);
    assert.equal(app.shopRerollCost, 25);
    app.wave = 15;
    app.openShopPhase();
    assert.equal(app.shopRerolls, 0);
    assert.equal(app.shopRerollCost, 16);
});

test('冲刺采用当前输入或上次方向，冷却和暂停状态不能重复触发', () => {
    const { app } = loadGame();
    prepareCombat(app);
    assert.equal(app.tryDash(), true);
    assert.equal(app.dashDir.x, 1);
    assert.equal(app.dashCooldown, 3);
    assert.equal(app.tryDash(), false);
    app.updateDash(0.45);
    assert.ok(Math.abs(app.playerPos.x - 12.6) < 0.00001);
    assert.equal(app.dashTimer, 0);
    app.updateDash(3.05);
    app.keys = { KeyW: true, KeyD: true };
    assert.equal(app.tryDash(), true);
    assert.ok(Math.abs(Math.hypot(app.dashDir.x, app.dashDir.z) - 1) < 0.00001);
    assert.ok(app.dashDir.z < 0);
    app.dashCooldown = 0;
    app.dashTimer = 0;
    app.state = 'PAUSED';
    assert.equal(app.tryDash(), false);
});

test('冲刺扫过路径不会漏怪，同一敌人只受伤一次且玩家不越界', () => {
    const { app } = loadGame();
    prepareCombat(app);
    app.stats.meleeDmg = 6;
    const enemy = { hp: 100, radius: 0.2, group: { position: { x: 1.4, z: 0 } } };
    app.enemies = [enemy];
    const hits = [];
    app.hitTarget = (target, damage) => hits.push({ target, damage });
    app.tryDash();
    app.updateDash(0.1);
    app.updateDash(0.1);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].damage, 37);
    app.playerPos.x = 19.9;
    app.updateDash(0.1);
    assert.equal(app.playerPos.x, 20);
    app.damagePlayer(100);
    assert.equal(app.hp, 25);
    app.dashTimer = 0;
    app.invulnTimer = 0;
    Object.assign(app.stats, { dodge: 0, armor: 0 });
    app.damagePlayer(5);
    assert.equal(app.hp, 20);
});

test('线段距离覆盖端点、侧向距离和零长度路径', () => {
    const { app } = loadGame();
    assert.equal(app.pointToSegmentDist(2, 1, 0, 0, 4, 0), 1);
    assert.equal(app.pointToSegmentDist(6, 0, 0, 0, 4, 0), 2);
    assert.equal(app.pointToSegmentDist(3, 4, 0, 0, 0, 0), 5);
});

test('近战扫掠分帧经过目标，每次挥动仅命中一次且不打到背后', () => {
    const { app } = loadGame();
    prepareCombat(app);
    const target = angle => ({ hp: 100, radius: 0.1, group: { position: { x: Math.cos(angle) * 3, z: Math.sin(angle) * 3 } } });
    const front = target(-1), late = target(1), back = target(Math.PI);
    app.enemies = [front, late, back];
    const hits = [];
    app.hitTarget = enemy => hits.push(enemy);
    app.startMeleeAttack('sweep', 0, 0, 0, { range: 5, dmg: 20, crit: 0 }, 0);
    assert.equal(hits.length, 0);
    app.updateCombatEffects(0.06);
    assert.deepEqual(hits, [front]);
    app.updateCombatEffects(0.06);
    app.updateCombatEffects(0.06);
    assert.deepEqual(hits, [front, late]);
    assert.equal(app.meleeAttacks.length, 0);
});

test('低帧率一次跨过完整挥砍窗口时仍能扫到整个弧线', () => {
    const { app } = loadGame();
    prepareCombat(app);
    app.enemies = [-1, 0, 1].map(angle => ({ hp: 10, radius: 0.1, group: { position: { x: 3 * Math.cos(angle), z: 3 * Math.sin(angle) } } }));
    let count = 0;
    app.hitTarget = () => count++;
    app.startMeleeAttack('sweep', 0, 0, 0, { range: 5, dmg: 20, crit: 0 }, 0);
    app.updateCombatEffects(0.3);
    assert.equal(count, 3);
});

test('铜短剑使用窄胶囊走廊，伸出前不命中远端，也不会扇形误伤侧方', () => {
    const { app } = loadGame();
    prepareCombat(app);
    const near = { hp: 10, radius: 0.2, group: { position: { x: 1, z: 0.3 } } };
    const far = { hp: 10, radius: 0.2, group: { position: { x: 4, z: 0 } } };
    const side = { hp: 10, radius: 0.2, group: { position: { x: 4, z: 2 } } };
    app.enemies = [near, far, side];
    const hits = [];
    app.hitTarget = enemy => hits.push(enemy);
    app.startMeleeAttack('thrust', 0, 0, 0, { range: 4.8, dmg: 14, crit: 0 }, 0);
    app.updateCombatEffects(0.04);
    assert.deepEqual(hits, [near]);
    app.updateCombatEffects(0.12);
    assert.deepEqual(hits, [near], '单次突刺只命中一个目标');
    app.enemies = [far, side];
    app.startMeleeAttack('thrust', 0, 0, 0, { range: 4.8, dmg: 20, crit: 0, pierce: 1 }, 0);
    app.updateCombatEffects(.04);
    assert.deepEqual(hits, [near]);
    app.updateCombatEffects(.12);
    assert.deepEqual(hits, [near, far]);
});

test('落星落地前不造成爆炸伤害，落地按当前位置判定且只爆炸一次', () => {
    const { app } = loadGame();
    const makeMesh = prepareCombat(app);
    const mesh = makeMesh(), warning = makeMesh();
    const enemy = { hp: 10, radius: 0.2, group: { position: { x: 8, z: 0 } } };
    app.enemies = [enemy];
    app.fallingStars.push({ mesh, warning, x: 0, z: 0, age: 0, duration: 0.55, radius: 3.2, stats: { dmg: 20, crit: 0 } });
    let count = 0, disposed = 0;
    app.hitTarget = () => count++;
    app.disposeCombatMesh = () => disposed++;
    app.updateCombatEffects(0.3);
    assert.ok(mesh.position.y < 0.6);
    assert.equal(count, 0);
    enemy.group.position.x = 2;
    app.updateCombatEffects(0.3);
    app.updateCombatEffects(1);
    assert.equal(count, 1);
    assert.equal(disposed, 2);
    assert.equal(app.fallingStars.length, 0);
});

test('离开波次时清理尚未结束的挥砍、星体和预警', () => {
    const { app } = loadGame();
    const makeMesh = prepareCombat(app);
    app.meleeAttacks.push({ mesh: makeMesh() });
    app.fallingStars.push({ mesh: makeMesh(), warning: makeMesh() });
    let disposed = 0;
    app.disposeCombatMesh = () => disposed++;
    app.clearCombatEffects();
    assert.equal(disposed, 3);
    assert.equal(app.meleeAttacks.length, 0);
    assert.equal(app.fallingStars.length, 0);
});

test('当前配置可通过启动校验，旧版字段与失效引用会被拒绝', () => {
    const { evaluate } = loadGame();
    assert.doesNotThrow(() => evaluate('validateGameData()'));
    evaluate("WEAPONS_DB.bow.synergy = 'gun'");
    assert.throws(() => evaluate('validateGameData()'), /synergy/);
    evaluate("WEAPONS_DB.bow.synergy = ['gun']; delete WEAPONS_DB.bow.basePrice");
    assert.throws(() => evaluate('validateGameData()'), /basePrice/);
    evaluate("WEAPONS_DB.bow.basePrice = 14; CHARACTERS[0].starter = 'missing'");
    assert.throws(() => evaluate('validateGameData()'), /初始武器不存在/);
});

for (const wave of [5, 10, 20]) {
    test(`第 ${wave} 波计时结束但 Boss 存活时不能结算`, () => {
        const { app } = loadGame();
        app.wave = wave;
        app.activeBoss = { hp: 1400 };
        app.endWave();
        assert.equal(app.canEndWave(), false);
        assert.equal(app.state, 'WAVE');
        assert.equal(app.gold, 30);
        assert.equal(app.activeBoss.hp, 1400);
        app.activeBoss.hp = 0;
        assert.equal(app.canEndWave(), false, '必须有实际击杀记录');
        app.waveBossDefeated = true;
        assert.equal(app.canEndWave(), true);
    });
}

test('提前击杀 Boss 后仍需完成波次计时，死亡不能胜利', () => {
    const { app } = loadGame();
    app.wave = 10;
    app.waveBossDefeated = true;
    app.activeBoss = { hp: 0 };
    app.waveTimer = 1;
    assert.equal(app.canEndWave(), false);
    app.waveTimer = 0;
    app.hp = 0;
    assert.equal(app.canEndWave(), false);
});

test('普通波次只结算一次，未拾取晶币直接入账并给经验、宝箱保留奖励', () => {
    const { app } = loadGame();
    let displayedGold;
    app.updateHUD = function () { displayedGold = this.gold; };
    app.pickups = [{ type: 'coin', value: 4 }, { type: 'crate', value: 1 }];
    app.endWave();
    app.endWave();
    assert.equal(app.state, 'SHOP');
    assert.equal(app.gold, 46);
    assert.equal(app.baggedGold, 0);
    assert.equal(app.pendingCrates, 1);
    assert.equal(app.awardedXP || 0, 4);
    assert.ok(Math.abs(app.baseStats.harvesting - 12.6) < 1e-8);
    assert.equal(displayedGold, 46, '结算后的 HUD 应同步显示最新金币');
});

test('第20波通关先结算奖励，继续无尽优先开箱，不能重复继续', () => {
    const { app, context, evaluate } = loadGame();
    app.wave = 20;
    app.waveBossDefeated = true;
    app.activeBoss = { hp: 0 };
    app.pickups = [{ type: 'crate', value: 1 }, { type: 'coin', value: 3 }];
    app.endWave();
    assert.equal(app.state, 'GAMEOVER');
    assert.equal(app.victory, true);
    assert.equal(app.gold, 45);
    assert.equal(app.baggedGold, 0);
    assert.equal(app.pendingCrates, 1);
    app.advancePostWave = evaluate('TerraBrotatoApp.prototype.advancePostWave');
    app.openCratePhase = function () { this.state = 'CRATE'; this.crateOpenCount = (this.crateOpenCount || 0) + 1; };
    context.window.continueEndless();
    context.window.continueEndless();
    assert.equal(app.state, 'CRATE');
    assert.equal(app.crateOpenCount, 1);
});

test('失败后不能继续无尽，也不能从错误阶段跳波或消费', () => {
    const { app, context } = loadGame();
    app.triggerGameOver(false);
    let starts = 0;
    app.startWave = () => starts++;
    context.window.continueEndless();
    context.window.nextWave();
    context.window.rerollShop();
    context.window.rerollLevelUp();
    assert.equal(app.state, 'GAMEOVER');
    assert.equal(app.gold, 30);
    assert.equal(starts, 0);
});

test('锁定商品跨刷新和跨波保留原价格，解锁或已购买后重新生成', () => {
    const { app } = loadGame();
    const locked = { kind: 'weapon', id: 'bow', tier: 1, price: 15, locked: true, bought: false };
    app.shopCards = [locked];
    app.generateShopCards();
    assert.equal(app.shopCards[0], locked);
    app.wave = 2;
    app.openShopPhase();
    assert.equal(app.shopCards[0], locked);
    assert.equal(app.shopCards[0].price, 15);
    locked.locked = false;
    app.generateShopCards();
    assert.notEqual(app.shopCards[0], locked);
    app.shopCards[0] = { ...locked, locked: true, bought: true };
    const bought = app.shopCards[0];
    app.generateShopCards();
    assert.notEqual(app.shopCards[0], bought);
});

test('宝箱离开阶段后不能重复领奖，升级只能选择当前提供的数值', () => {
    const { app, evaluate } = loadGame();
    app.state = 'CRATE';
    app.pendingCrates = 1;
    app.currentCrateItem = { price: 20, stats: { harvesting: 2 } };
    app.resolveCrate(true);
    app.resolveCrate(true);
    assert.equal(app.ownedItems.length, 1);
    assert.equal(app.pendingCrates, 0);
    assert.equal(app.baseStats.harvesting, 14);
    app.state = 'LEVELUP';
    app.pendingLevelUps = 1;
    app.levelUpChoices = [{ key: 'harvesting', val: 8 }];
    app.pickUpgrade('harvesting', 800);
    assert.equal(app.pendingLevelUps, 1);
    app.openShopPhase = function () { this.state = 'SHOP'; };
    app.pickUpgrade('harvesting', 8);
    app.pickUpgrade('harvesting', 8);
    assert.equal(app.baseStats.harvesting, 22);
    assert.equal(app.pendingLevelUps, 0);
    assert.equal(evaluate('app.state'), 'SHOP');
});

test('决战计时保持零，死亡后不再执行拾取与回血更新', () => {
    const { app } = loadGame();
    Object.assign(app, {
        wave: 10, waveTimer: 0.01, activeBoss: { hp: 100 },
        keys: {}, joyVec: { x: 0, y: 0 }, invulnTimer: 0, hurtFlash: 0,
        legL: { rotation: { x: 0 } }, legR: { rotation: { x: 0 } },
        armL: { rotation: { x: 0 } }, armR: { rotation: { x: 0 } },
        playerPos: {}, playerGroup: { position: { copy() {} } },
        propTimer: 10, spawnTimer: 10, spawns: [],
        updateWeapons() {}, updateEnemies() { this.triggerGameOver(false); },
        updateProjectiles() { throw new Error('死亡后不应更新投射物'); },
        updatePickupsAndFX() { throw new Error('死亡后不应拾取'); },
    });
    app.updateWave(0.1);
    assert.equal(app.waveTimer, 0);
    assert.equal(app.state, 'GAMEOVER');
});

test('击杀 Boss 写入实际击杀记录，决战 HUD 明确提示', () => {
    const { app, evaluate, elements } = loadGame();
    const boss = {
        hp: 10, isBoss: true, group: { position: { x: 0, z: 1 } },
        knockback: { x: 0, z: 0 },
    };
    Object.assign(app, {
        wave: 10, activeBoss: boss, enemies: [boss], xp: 0, xpNext: 16,
        spawnBurstParticles() {}, spawnFloatText() {}, updateBossBar() {},
        entitiesGroup: { remove() {} }, spawnPickup() {},
    });
    app.updateHUD = evaluate('TerraBrotatoApp.prototype.updateHUD');
    app.updateHUD();
    assert.equal(elements.get('hud-wave-timer').textContent, '决战');
    app.hitTarget(boss, 10, 0, 0, 0);
    assert.equal(app.waveBossDefeated, true);
    assert.equal(app.totalKills, 1);
    assert.equal(app.canEndWave(), true);
});

test('倒计时归零后仍更新 Boss 战斗，且不新增普通刷怪预警', () => {
    const { app } = loadGame();
    const updated = [];
    Object.assign(app, {
        wave: 10, waveTimer: 0.01, activeBoss: { hp: 100 },
        keys: {}, joyVec: { x: 0, y: 0 }, invulnTimer: 0, hurtFlash: 0,
        legL: { rotation: { x: 0 } }, legR: { rotation: { x: 0 } },
        armL: { rotation: { x: 0 } }, armR: { rotation: { x: 0 } },
        playerPos: {}, playerGroup: { position: { copy() {} } },
        propTimer: 10, spawnTimer: 0, spawns: [],
        queueEnemySpawn() { throw new Error('决战期间不应新增刷怪预警'); },
        updateWeapons() { updated.push('武器'); },
        updateEnemies() { updated.push('敌人'); },
        updateProjectiles() { updated.push('投射物'); },
        updatePickupsAndFX() { updated.push('掉落'); },
        updateCameraFollow() {},
    });
    app.updateWave(0.1);
    app.updateWave(0.1);
    assert.equal(app.state, 'WAVE');
    assert.equal(app.waveTimer, 0);
    assert.deepEqual(updated, ['武器', '敌人', '投射物', '掉落', '武器', '敌人', '投射物', '掉落']);
});

test('无尽奖励按宝箱、升级、商店发放，再从商店进入第11波', () => {
    const { app, evaluate, context } = loadGame();
    app.state = 'GAMEOVER';
    app.victory = true;
    app.wave = 10;
    app.pendingCrates = 1;
    app.pendingLevelUps = 1;
    app.advancePostWave = evaluate('TerraBrotatoApp.prototype.advancePostWave');
    app.openCratePhase = function () {
        this.state = 'CRATE';
        this.currentCrateItem = { price: 20, stats: {} };
    };
    app.openLevelUpPhase = function () {
        this.state = 'LEVELUP';
        this.levelUpChoices = [{ key: 'harvesting', val: 8 }];
    };
    context.window.continueEndless();
    assert.equal(app.state, 'CRATE');
    app.resolveCrate(false);
    assert.equal(app.state, 'LEVELUP');
    app.pickUpgrade('harvesting', 8);
    assert.equal(app.state, 'SHOP');
    app.startWave = function (wave) { this.wave = wave; this.state = 'WAVE'; };
    context.window.nextWave();
    context.window.nextWave();
    assert.equal(app.wave, 11);
});
