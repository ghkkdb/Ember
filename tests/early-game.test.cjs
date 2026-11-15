const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { setup } = require('../analysis/combat-benchmark.cjs');
const { run } = require('../analysis/early-game-benchmark.cjs');

test('储蓄金额守恒，高面额掉落不能超额兑换；再次结转不凭空增值', () => {
    const { app } = setup(11); app.startWave(1); app.clearEntities();
    app.baggedGold = 1; app.spawnPickup('coin', 0, 0, 4);
    assert.equal(app.pickups[0].value, 5); assert.equal(app.baggedGold, 0);
    assert.equal(app.waveMetrics.bankSpent, 1);
    // 没捡到的整枚币重新结转，下次仍然只把存量等额返还。
    app.baggedGold += app.pickups[0].value; app.pickups = [];
    app.spawnPickup('coin', 0, 0, 2);
    assert.equal(app.pickups[0].value + app.baggedGold, 7);
    const before = app.baggedGold; app.spawnPickup('heart', 0, 0, 6);
    assert.equal(app.baggedGold, before);
});

test('储蓄返还不重复给经验，拾取金币与账本一致', () => {
    const { app } = setup(11); app.startWave(1); app.clearEntities();
    let xp = 0; app.gainXP = amount => { xp += amount; };
    app.baggedGold = 3; app.spawnPickup('coin', 0, 0, 2); app.updatePickupsAndFX(.01);
    assert.equal(app.gold, 4); assert.equal(xp, 2); assert.equal(app.baggedGold, 1);
    assert.equal(app.waveMetrics.coinIncome, 4);
});

test('普通怪货币累计小数但不超过每波预算，跨波重置', () => {
    const { app, context } = setup(11); app.startWave(1);
    let total = 0;
    for (let i = 0; i < 10; i++) total += app.issueEnemyCoins(1);
    assert.equal(total, 6);
    for (let i = 0; i < 100; i++) total += app.issueEnemyCoins(3);
    assert.equal(total, vm.runInContext('getWaveCoinBudget(1)', context));
    assert.equal(app.waveMetrics.coinsIssued, total);
    app.startWave(2); assert.equal(app.enemyCoinsIssued, 0); assert.equal(app.enemyCoinCredit, 0);
});

test('收获只给整数晶币，内部小数成长，不产生经验或重复结算', () => {
    const { app, context } = setup(11); app.startWave(1); app.clearEntities();
    app.baseStats.harvesting = 12; app.recalcStats(); app.waveTimer = 0;
    app.endWave = vm.runInContext('TerraBrotatoApp.prototype.endWave', context);
    app.advancePostWave = function () { this.state = 'SHOP'; };
    let xp = 0; app.gainXP = n => { xp += n; };
    app.endWave(); app.endWave();
    assert.equal(app.gold, 12); assert.equal(xp, 0); assert.equal(app.waveMetrics.harvestIncome, 12);
    assert.ok(Math.abs(app.baseStats.harvesting - 12.6) < 1e-8);
    app.startWave(2); app.clearEntities(); app.waveTimer = 0; app.endWave();
    assert.equal(app.gold, 24); assert.ok(Math.abs(app.baseStats.harvesting - 13.23) < 1e-8);
});

test('巨兽鲨在首个Boss之前不可抽取或直接购买，第5波结算后开放', () => {
    const { app, context } = setup(29); app.startWave(1); app.shopCards = [];
    for (const wave of [1, 2, 3, 4]) {
        app.wave = wave; app.stats.luck = 100000;
        for (let i = 0; i < 100; i++) { app.generateShopCards(); assert.ok(app.shopCards.every(c => c.id !== 'megashark')); }
    }
    app.state = 'SHOP'; app.gold = 999; app.shopCards = [{ kind: 'weapon', id: 'megashark', tier: 2, price: 1 }];
    app.buyShopCard(0); assert.equal(app.gold, 999); assert.equal(app.weapons.length, 0);
    assert.equal(vm.runInContext("isWeaponAvailable('megashark',6)", context), true);
    app.wave = 5; app.shopCards = [];
    let found = false;
    for (let i = 0; i < 100; i++) { app.generateShopCards(); found ||= app.shopCards.some(c => c.id === 'megashark'); }
    assert.equal(found, true);
});

test('前期守卫最多1只，计入待出生预警；基础生命按新曲线成长', () => {
    const engine = setup(47), { app } = engine;
    app.startWave(3); app.damagePlayer = () => {}; let seen = false;
    for (let i = 0; i < 1800 && app.state === 'WAVE'; i++) {
        engine.advance(1 / 60);
        const count = app.enemies.filter(e => e.hp > 0 && e.type === 'armored_guard').length + app.spawns.filter(s => s.type === 'armored_guard').length;
        assert.ok(count <= 1); seen ||= count > 0;
    }
    assert.equal(seen, true);
    app.startWave(5); app.spawnEnemyNow('slime_green', 0, 0);
    assert.ok(Math.abs(app.enemies.at(-1).maxHp - 57.6) < 1e-8);
});

test('高射速属性增益受控，商店涨价不会提高武器出售回款', () => {
    const { app, context } = setup(11); app.recalcStats();
    const before = app.getWeaponCombatStats({ id: 'minishark', tier: 2 });
    app.stats.rangedDmg = 12;
    const after = app.getWeaponCombatStats({ id: 'minishark', tier: 2 });
    assert.ok(after.dmg - before.dmg <= 5);
    assert.equal(vm.runInContext('getWeaponShopPrice(WEAPONS_DB.minishark,1,1)', context), 24);
    assert.equal(vm.runInContext('getWeaponValue(WEAPONS_DB.minishark,1)', context), 18);
});

test('真实五波流程的购买账本守恒，不注入额外金钱且首Boss不再6秒结束', () => {
    const result = run(29, 'output');
    assert.equal(result.closingGold, 30 + result.earned - result.spent);
    assert.ok(result.actions.every(action => action.cost > 0));
    assert.equal(result.rows.length, 5); assert.equal(result.rows.at(-1).state, 'SHOP');
    assert.ok(result.rows.at(-1).metrics.bossKillSeconds > 10);
    assert.ok(result.closingGold < 100);
});
