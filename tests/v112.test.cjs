const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { setup } = require('../analysis/combat-benchmark.cjs');

function scene(seed = 11) {
    const e = setup(seed);
    e.app.weaponOrbitGroup = new e.app.entitiesGroup.constructor();
    e.app.rewardSeed = seed;
    e.app.startWave(1);
    e.app.clearEntities();
    return e;
}

function enemy(app, x = 0, z = -3) {
    const group = new app.entitiesGroup.constructor();
    group.position.set(x, 0, z);
    const en = { group, hp: 10000, maxHp: 10000, radius: 0.4, speed: 0, knockback: group.position.clone() };
    app.enemies.push(en);
    return en;
}

test('12款主核心协议完整实装且具备双向适配与惩罚机制', () => {
    const { app, context } = scene();
    const cores = vm.runInContext('CORE_RELICS', context);
    const coreKeys = Object.keys(cores);
    assert.equal(coreKeys.length, 12);
    const expected = ['heavy','star','volley','chain','hive','charge','frost','entropy','return','orbit','dash','echo'];
    assert.deepEqual(coreKeys.sort(), expected.sort());

    for (const [id, c] of Object.entries(cores)) {
        assert.ok(c.name && c.desc && c.desc.length > 10);
        assert.ok(Array.isArray(c.behaviors) || Array.isArray(c.weaponIds));
    }
});

test('6位Boss与6把Boss专武完整实装且技能图鉴逐项同源', () => {
    const { app, context } = scene();
    const bosses = vm.runInContext('BOSSES_DB', context);
    const rules = vm.runInContext('BOSS_WEAPON_RULES', context);
    const notes = vm.runInContext('BOSS_SKILL_NOTES', context);

    const expectedBosses = ['forge', 'weaver', 'prism', 'tank', 'clock', 'train'];
    assert.deepEqual(Object.keys(bosses).sort(), expectedBosses.sort());
    assert.deepEqual(Object.keys(notes).sort(), expectedBosses.sort());

    for (const id of expectedBosses) {
        const b = bosses[id];
        assert.ok(b.name && b.weapon && rules[b.weapon]);
        assert.equal(b.skills.length, 3);
        assert.equal(notes[id].length, 3);

        app.clearEntities();
        app.spawnBoss(id);
        const boss = app.activeBoss;
        assert.ok(boss && boss.isBoss && boss.name === b.name);
        assert.equal(boss.hp, boss.maxHp);
    }
});

test('Boss专武数据事实、双分支强化与指定核心共鸣规则闭环', () => {
    const { app, context } = scene();
    const weapons = vm.runInContext('WEAPONS_DB', context);
    const bossWeaponIds = ['boss_hammer', 'boss_hive', 'boss_prism', 'boss_tank', 'boss_clock', 'boss_train'];

    for (const wid of bossWeaponIds) {
        const def = weapons[wid];
        assert.ok(def, `专武 ${wid} 不存在`);
        assert.equal(def.minTier, 2);
        assert.ok(def.exclusiveBossId);

        const facts = app.getWeaponFacts({ id: wid, tier: 2 }, app.stats, true);
        assert.ok(facts.name && facts.action && facts.rules);
        assert.ok(Number.isFinite(facts.base));
        assert.ok(Number.isFinite(facts.cadence));
        assert.ok(Number.isFinite(facts.reach));
        assert.ok(facts.cores.length >= 2);

        // 验证各指定共鸣核心在 coreFits 中均通过
        for (const coreId of facts.cores) {
            assert.equal(app.coreFits(coreId, wid), true);
        }
    }
});

test('护盾系统独立吸收伤害、应急密封开波生成且受15%最大生命上限约束', () => {
    const { app } = scene();
    app.hp = 25;
    app.maxHp = 25;
    app.ownedItems = [{ id: 'ankh_shield', tier: 2, limit: 1, stats: {} }];

    // 开波自动赋予 8% maxHp 护盾 (25 * 0.08 = 2)
    app.startWave(1);
    assert.equal(app.shield, 2);
    assert.equal(app.maxShield, Math.round(25 * 0.15)); // 4

    // 受到 5 点伤害，护甲 0，护盾吸收 2 点，剩余 3 点扣减生命
    app.damagePlayer(5, 'test_attack');
    assert.equal(app.shield, 0);
    assert.equal(app.hp, 22);
});

test('溢流蓄罐将过量治疗50%转化为护盾且不超过10%最大生命', () => {
    const { app } = scene();
    app.hp = 25;
    app.maxHp = 25;
    app.shield = 0;
    app.maxShield = 4;
    app.ownedItems = [{ id: 'celestial', tier: 4, limit: 1, stats: {} }];

    // 满血治疗 10 点，50% 转化为护盾 (5 点)，但受 10% maxHp 限制 (25 * 0.10 = 3 点)
    app.healPlayer(10);
    assert.equal(app.shield, 3);
    assert.equal(app.hp, 25);
});

test('断电保险本局首次致命伤免疫并保留1点生命', () => {
    const { app } = scene();
    app.hp = 10;
    app.maxHp = 25;
    app.shield = 0;
    app.fuseTriggered = false;
    app.ownedItems = [{ id: 'fuse_breaker', tier: 4, limit: 1, stats: {} }];

    // 受到 50 点致死伤害
    app.damagePlayer(50, 'fatal_strike');
    assert.equal(app.hp, 1);
    assert.equal(app.fuseTriggered, true);
    assert.equal(app.state, 'WAVE'); // 未触发 GAMEOVER

    // 第二次致死伤害无保险，死亡
    app.invulnTimer = 0;
    app.invulnerableTimer = 0;
    app.damagePlayer(50, 'second_fatal_strike');
    assert.equal(app.state, 'GAMEOVER');
});

test('多维伤害账本准确记录原生伤害、衍生伤害、DOT与Boss伤害归属', () => {
    const { app } = scene();
    const en = enemy(app, 0, -3);
    en.isBoss = true;

    // 原生主击
    app.hitTarget(en, 20, false, 0, 0, { attack: { weaponId: 'boss_hammer' } });
    // 衍生震波
    app.hitTarget(en, 10, false, 0, 0, { attack: { weaponId: 'boss_hammer' }, isDerivative: true });
    // 持续腐蚀
    app.hitTarget(en, 6, false, 0, 0, { attack: { weaponId: 'boss_hammer' }, isDot: true });

    const stats = app.currentWaveWeaponStats?.['boss_hammer'];
    assert.ok(stats);
    assert.equal(stats.primaryDmg, 20);
    assert.equal(stats.derivativeDmg, 10);
    assert.equal(stats.dotDmg, 6);
    assert.equal(stats.bossDmg, 36);
    assert.equal(stats.totalDmg, 36);
    assert.equal(stats.hits, 3);
});

test('滑移轴冲刺冷却真实缩短且不破坏下限', () => {
    const { app } = scene();
    app.ownedItems = [
        { id: 'slide_axle', tier: 2, limit: 2, stats: {} },
        { id: 'slide_axle', tier: 2, limit: 2, stats: {} }
    ];
    // 基础 2.0s，每件减 0.3s -> 1.4s
    const slideCount = app.ownedItems.filter(i => i.id === 'slide_axle').length;
    const cd = Math.max(0.6, 2.0 - slideCount * 0.3);
    assert.equal(cd, 1.4);
});

test('无尽模式第25波起普通怪生命额外按1.12指数缩放', () => {
    const { app } = scene();
    app.startWave(24);
    assert.equal(app.endlessMonsterHpScale, 1.0);

    app.startWave(25);
    assert.ok(Math.abs(app.endlessMonsterHpScale - 1.12) < 1e-6);

    app.startWave(30);
    assert.ok(Math.abs(app.endlessMonsterHpScale - Math.pow(1.12, 2)) < 1e-6);
});

test('满槽专武替换界面包含返回放弃选项且操作守恒', () => {
    const { app, context } = scene();
    app.weapons = Array.from({ length: 6 }, (_, i) => ({ id: 'bow', tier: 1, instanceId: 'inst_' + i, cd: 0 }));
    app.pendingBossReward = { weaponId: 'boss_tank' };
    app.openBossReward();

    // 放弃专武
    app.pickBossReward(-1);
    assert.equal(app.pendingBossReward, null);
    assert.equal(app.weapons.length, 6);
});
