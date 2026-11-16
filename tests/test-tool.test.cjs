const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const test = require('node:test');
const model = require('../tools/test-model.js');
const { createTestServer, startTestServer, openTestPage } = require('../tools/test-server.cjs');
const html = fs.readFileSync(path.join(__dirname, '..', 'terrabrotato.html'), 'utf8');
const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(script => script.trim()).join('\n');
const context = vm.createContext({ window: { addEventListener() {} }, document: { getElementById() {} }, setTimeout() {} });
vm.runInContext(source, context);
const data = vm.runInContext('({weapons:WEAPONS_DB,items:ITEMS_DB,characters:CHARACTERS,stats:STAT_META,cores:CORE_RELICS,probabilities:getTierProbabilities,rollTier:rollItemTier})', context);
const randomHost = vm.runInContext('Math', context);
const base = () => ({ version: 1, character: 'warrior', wave: 5, gold: 100, seed: 17, speed: 1, bossOnly: true, invincible: false, ignoreLimits: false, bonuses: {}, weapons: [{ id: 'grass_blade', tier: 1 }], items: [] });

test('核心配置可往返导入，拒绝不存在或继承属性中的核心', () => {
    const input = { ...base(), core: 'star' };
    assert.equal(model.validateConfig(input, data).core, 'star');
    assert.throws(() => model.validateConfig({ ...input, core: 'missing' }, data));
    assert.throws(() => model.validateConfig({ ...input, core: '__proto__' }, data));
    assert.equal(model.validateConfig(base(), data).core, null);
});

test('Windows启动器使用CRLF，避免cmd解析中文行失败', () => {
    const launcher = fs.readFileSync(path.join(__dirname, '..', 'tools', '启动测试工具.cmd'), 'utf8');
    assert.ok(launcher.includes('\r\n'));
    assert.ok(!/(?<!\r)\n/.test(launcher));
    assert.ok(launcher.includes('"%TERRA_TEST_NODE%" tools/test-server.cjs --open'));
});

test('重复启动复用现有测试台，不关闭原服务', async () => {
    const first = await startTestServer({ port: 0 });
    const port = first.server.address().port;
    try {
        const second = await startTestServer({ port });
        assert.equal(second.reused, true);
        assert.equal(second.url, first.url);
        assert.equal(second.server, null);
        assert.equal((await fetch(second.url)).status, 200);
    } finally { await new Promise(resolve => first.server.close(resolve)); }
});

test('其他服务占用端口时换端口，不终止其他进程', async () => {
    const http = require('node:http');
    const occupied = http.createServer((request, response) => { response.writeHead(404); response.end('其他服务'); });
    await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
    let started;
    try {
        const port = occupied.address().port;
        started = await startTestServer({ port });
        assert.equal(started.reused, false);
        assert.notEqual(started.server.address().port, port);
        assert.equal((await fetch(`http://127.0.0.1:${port}`)).status, 404);
        assert.equal((await fetch(started.url)).status, 200);
    } finally {
        if (started?.server) await new Promise(resolve => started.server.close(resolve));
        await new Promise(resolve => occupied.close(resolve));
    }
});

test('浏览器启动异常不让已启动的测试服务报错退出', () => {
    const original = console.error;
    const messages = [];
    console.error = message => messages.push(message);
    try {
        assert.doesNotThrow(() => openTestPage('http://127.0.0.1:8765/test', () => { throw new Error('模拟进程限制'); }));
        assert.doesNotThrow(() => openTestPage('http://127.0.0.1:8765/test', (file, args, options, callback) => callback(new Error('模拟失败'))));
        assert.equal(messages.length, 2);
        assert.ok(messages.every(message => message.includes('http://127.0.0.1:8765/test')));
    } finally { console.error = original; }
});

test('配置导出再导入保持一致，属性补零且保留合法负值', () => {
    const input = base(); input.bonuses = { armor: -2, luck: 235 };
    const config = model.validateConfig(input, data);
    assert.equal(config.bonuses.armor, -2);
    assert.equal(config.bonuses.luck, 235);
    assert.equal(Object.keys(config.bonuses).length, 16);
    assert.deepEqual(model.validateConfig(JSON.parse(JSON.stringify(config)), data), config);
    config.weapons[0].tier = 2;
    assert.equal(input.weapons[0].tier, 1);
});

test('无效版本、职业、品质、武器槽数与非有限数值在应用前被拒绝', () => {
    for (const patch of [
        { version: 2 }, { character: 'missing' }, { wave: 0 }, { wave: 1.5 }, { gold: Infinity }, { seed: -1 }, { speed: 10 },
        { weapons: [] }, { weapons: Array.from({ length: 7 }, () => ({ id: 'grass_blade', tier: 1 })) },
        { weapons: [{ id: 'zenith', tier: 1 }] }, { weapons: [{ id: '__proto__', tier: 1 }] }, { bonuses: { maxHp: -1000 } }
    ]) assert.throws(() => model.validateConfig({ ...base(), ...patch }, data));
    assert.throws(() => model.number('', 0, 1, '输入'));
});

test('饰品默认执行产品上限，压力测试可显式突破，重复ID不能绕过上限', () => {
    const input = base(); input.items = [{ id: 'celestial', count: 2 }];
    assert.throws(() => model.validateConfig(input, data), /最多持有1件/);
    input.ignoreLimits = true;
    assert.equal(model.validateConfig(input, data).items[0].count, 2);
    input.items.push({ id: 'celestial', count: 1 });
    assert.throws(() => model.validateConfig(input, data), /重复/);
    input.items = [{ id: 'missing', count: 1 }];
    assert.throws(() => model.validateConfig(input, data));
});

test('配置只保留允许字段，不接受导入对象的额外执行内容', () => {
    const input = base(); input.code = '不会执行'; input.bonuses.constructor = 100;
    const config = model.validateConfig(input, data);
    assert.equal(Object.hasOwn(config, 'code'), false);
    assert.equal(Object.hasOwn(config.bonuses, 'constructor'), false);
    assert.equal(config.invincible, false);
    input.invincible = 'false';
    assert.equal(model.validateConfig(input, data).invincible, false);
});

test('固定种子抽样可复现，结束后恢复战斗随机函数且不消耗其状态', () => {
    const combatRandom = model.createRandom(99);
    randomHost.random = combatRandom;
    const before = combatRandom.state();
    const first = model.sampleTiers(data, 15, 235, 10000, 20261114, randomHost);
    const second = model.sampleTiers(data, 15, 235, 10000, 20261114, randomHost);
    assert.deepEqual(first, second);
    assert.equal(first.counts.reduce((sum, count) => sum + count, 0), 10000);
    assert.equal(randomHost.random, combatRandom);
    assert.equal(combatRandom.state(), before);
    first.counts.forEach((count, i) => assert.ok(Math.abs(count / 10000 - first.expected[i]) < .02));
});

test('抽样失败也恢复随机函数，非法种子和过大样本不会执行', () => {
    const previous = randomHost.random;
    assert.throws(() => model.sampleTiers({ rollTier() { throw new Error('模拟失败'); } }, 15, 0, 100, 1, randomHost), /模拟失败/);
    assert.equal(randomHost.random, previous);
    assert.throws(() => model.sampleTiers(data, 15, 0, 100001, 1, randomHost));
    assert.throws(() => model.sampleTiers(data, 15, 0, 100, -1, randomHost));
});

test('普通入口保持产品原文，测试入口独立暴露数据，源码指纹一致', async () => {
    const server = createTestServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const url = `http://127.0.0.1:${server.address().port}`;
        const normal = await fetch(url + '/').then(response => response.text());
        const game = await fetch(url + '/test-game').then(response => response.text());
        const panel = await fetch(url + '/test').then(response => response.text());
        const info = await fetch(url + '/api/info').then(response => response.json());
        assert.equal(normal, html);
        assert.ok(!normal.includes('window.TEST_DATA'));
        assert.ok(game.includes('window.TEST_DATA'));
        assert.ok(panel.includes('src="/test-game"'));
        assert.equal(info.sha256, crypto.createHash('sha256').update(html).digest('hex'));
        for (const route of ['/test-panel.js', '/test-model.js', '/test-panel.css']) assert.equal((await fetch(url + route)).status, 200);
        assert.equal((await fetch(url + '/terrabrotato.html')).status, 404);
        assert.equal((await fetch(url + '/unknown')).status, 404);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
