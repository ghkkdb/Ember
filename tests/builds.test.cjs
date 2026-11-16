const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { setup, runCase } = require('../analysis/combat-benchmark.cjs');

test('升阶只提升伤害成长，不再同时增加攻速、暴击、射程与穿透', () => {
    const { app, context } = setup(1);
    app.recalcStats();
    const values = [1, 2, 3, 4].map(tier => app.getWeaponCombatStats({ id: 'grass_blade', tier }));
    for (let i = 1; i < values.length; i++) {
        assert.ok(values[i].dmg > values[i - 1].dmg);
        for (const key of ['cd', 'crit', 'range', 'pierce', 'bounces']) assert.equal(values[i][key], values[0][key]);
    }
    for (const id of ['nights_edge', 'terra_blade', 'zenith']) {
        const definition = vm.runInContext(`WEAPONS_DB.${id}`, context);
        assert.equal(app.getWeaponCombatStats({ id, tier: definition.minTier }).dmg, definition.baseDmg);
        assert.equal(vm.runInContext(`getWeaponValue(WEAPONS_DB.${id},WEAPONS_DB.${id}.minTier)`, context), definition.basePrice);
    }
});

test('铜短剑单体输出高于草剑，草剑保留群攻，弓保留慢射穿透定位', () => {
    const { app } = setup(1); app.recalcStats();
    const copper = app.getWeaponCombatStats({ id: 'copper_sword', tier: 1 });
    const grass = app.getWeaponCombatStats({ id: 'grass_blade', tier: 1 });
    const bow = app.getWeaponCombatStats({ id: 'bow', tier: 1 });
    assert.ok(copper.dmg / copper.cd > grass.dmg / grass.cd);
    assert.equal(copper.pierce, 1); assert.equal(grass.pierce, 99);
    assert.equal(bow.pierce, 3); assert.equal(bow.cd, .9);
});

test('重甲守卫血量更高，萨满有明确治疗读条，不治疗Boss与死亡目标', () => {
    const { app } = setup(2); app.startWave(9); app.clearEntities();
    app.spawnEnemyNow('slime_green', 2, 0); const normal = app.enemies.at(-1);
    app.spawnEnemyNow('armored_guard', 2, 1); const guard = app.enemies.at(-1);
    app.spawnEnemyNow('shaman_healer', 3, 0); const healer = app.enemies.at(-1);
    app.spawnBoss('eye_of_cthulhu'); const boss = app.activeBoss;
    assert.equal(guard.maxHp, normal.maxHp * 4);
    assert.ok(guard.speed < normal.speed);
    assert.equal(healer.behavior, 'healer');
    for (const enemy of app.enemies) enemy.speed = 0;
    normal.hp = 10; guard.hp = 0; boss.hp = 100; healer.hp = 10;
    healer.supportTimer = 0;
    app.updateEnemies(.1);
    assert.equal(normal.hp, 10);
    app.updateEnemies(.7);
    assert.equal(normal.hp, 10);
    app.updateEnemies(.11);
    assert.ok(normal.hp > 10 && normal.hp <= normal.maxHp);
    assert.equal(guard.hp, 0); assert.equal(boss.hp, 100); assert.equal(healer.hp, 10);
});

test('自然刷怪含耐久与支援敌人，连同出生预警限制最多2守卫和1萨满', () => {
    const engine = setup(29), app = engine.app;
    app.startWave(15); app.damagePlayer = () => {};
    let guards = 0, healers = 0;
    for (let i = 0; i < 1800; i++) {
        engine.advance(1 / 60);
        const count = type => app.enemies.filter(en => en.type === type).length + app.spawns.filter(en => en.type === type).length;
        guards = Math.max(guards, count('armored_guard')); healers = Math.max(healers, count('shaman_healer'));
        assert.ok(count('armored_guard') <= 2 && count('shaman_healer') <= 1);
    }
    assert.equal(guards, 2); assert.equal(healers, 1);
});

test('核心奖励在宝箱、升级之后出现，互斥并防止重复选择', () => {
    const { app } = setup(3); app.recalcStats();
    app.pendingCrates = 1; app.pendingLevelUps = 1; app.pendingCoreChoice = true;
    app.openCratePhase = () => { app.state = 'CRATE'; };
    app.openLevelUpPhase = () => { app.state = 'LEVELUP'; };
    app.openShopPhase = () => { app.state = 'SHOP'; };
    app.advancePostWave(); assert.equal(app.state, 'CRATE');
    app.pendingCrates = 0; app.advancePostWave(); assert.equal(app.state, 'LEVELUP');
    app.pendingLevelUps = 0; app.advancePostWave(); assert.equal(app.state, 'CORE');
    app.pickCore('missing'); assert.equal(app.state, 'CORE');
    app.pickCore('__proto__'); assert.equal(app.state, 'CORE');
    const offered=app.coreOffers[0]; app.pickCore(offered); assert.equal(app.state, 'SHOP'); assert.equal(app.selectedCoreId, offered);
    app.pickCore('volley'); assert.equal(app.selectedCoreId, offered);
    assert.equal(app.pendingCoreChoice, false);
    app.startWave(6); assert.equal(app.selectedCoreId, offered);
});

test('放弃核心不产生加成，未选择核心击败Boss后可再次获得选择', () => {
    const { app } = setup(3); app.startWave(5);
    const boss = app.activeBoss;
    app.hitTarget(boss, boss.hp, 0, 0, 0);
    assert.equal(app.pendingCoreChoice, true);
    app.openShopPhase = () => { app.state = 'SHOP'; };
    app.openCorePhase(); app.pickCore('none');
    assert.equal(app.selectedCoreId, null); assert.equal(app.pendingCoreChoice, false);
    app.startWave(10);
    assert.equal(app.activeBoss.maxHp, 6000);
    app.hitTarget(app.activeBoss, 6000, 0, 0, 0);
    assert.equal(app.pendingCoreChoice, true);
});

test('重刃只影响剑系，伤害收益与间隔代价同时生效', () => {
    const { app } = setup(4); app.recalcStats();
    const sword = { id: 'grass_blade', tier: 1 }, gun = { id: 'minishark', tier: 1 };
    const beforeSword = app.getWeaponCombatStats(sword), beforeGun = app.getWeaponCombatStats(gun);
    app.selectedCoreId = 'heavy';
    const after = app.getWeaponCombatStats(sword);
    assert.ok(after.dmg > beforeSword.dmg);
    assert.equal(after.cd, beforeSword.cd * 1.2);
    assert.deepEqual(app.getWeaponCombatStats(gun), beforeGun);
});

test('弹幕双弹共享一次释放记录，降低单枚伤害且延长攻击间隔', () => {
    const { app, context } = setup(4); app.startWave(1);
    app.spawnEnemyNow('slime_purple', 6, 0);
    const weapon = { id: 'minishark', tier: 1, recoil: { set() {} } };
    const before = app.getWeaponCombatStats(weapon);
    app.selectedCoreId = 'volley';
    const after = app.getWeaponCombatStats(weapon);
    assert.ok(after.dmg < before.dmg); assert.equal(after.cd, before.cd * 1.15);
    app.fireWeapon(weapon, vm.runInContext('WEAPONS_DB.minishark', context), after, 0, 0, app.enemies[0]);
    assert.equal(app.projectiles.length, 2);
    assert.equal(app.projectiles[0].attack, app.projectiles[1].attack);
    assert.equal(app.waveMetrics.attacks, 1);
    const expected = after.dmg + (Math.round(after.dmg * 1.75) - after.dmg) * after.crit / 100;
    assert.ok(Math.abs(app.getBuildDpsCeiling([weapon], app.stats) - expected * 2 / after.cd) < 1e-9);
});

test('滞爆核心范围与预警一致，延迟加长且不白送近战伤害', () => {
    const { app, context } = setup(5); app.startWave(1);
    app.selectedCoreId = 'star';
    app.spawnFallingStar(0, 0, { dmg: 20, crit: 0 });
    assert.ok(Math.abs(app.fallingStars[0].radius - 3.024) < 1e-9);
    assert.equal(app.fallingStars[0].duration, .75);
    let melee;
    app.startMeleeAttack = (kind, x, z, angle, stats) => { melee = stats; };
    const weapon = { id: 'starfury', tier: 1, recoil: { set() {} } };
    app.fireWeapon(weapon, vm.runInContext('WEAPONS_DB.starfury', context), { dmg: 100, crit: 0 }, 0, 0, { group: { position: { x: 3, z: 0 } } });
    assert.equal(melee, undefined);
    assert.equal(app.fallingStars.at(-1).stats.dmg, 90);
});

test('固定基准复现一致，无敌关闭时Boss击杀需要经过技能循环', () => {
    const first = runCase(5, 'gun', 'boss', 11);
    assert.deepEqual(runCase(5, 'gun', 'boss', 11), first);
    assert.ok(first.bossKilledAt > 8 && first.bossKilledAt < 30);
    assert.ok(first.damageTaken > 0);
});
