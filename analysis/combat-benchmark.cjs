// 执行真实战斗方法的固定步长基准；渲染对象用轻量替身，不代表真人胜率或浏览器性能。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
class Vector {
    constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
    set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
    copy(v) { return this.set(v.x, v.y, v.z); }
    multiplyScalar(n) { this.x *= n; this.y *= n; this.z *= n; return this; }
    clone() { return new Vector(this.x, this.y, this.z); }
}
class Geometry { translate() { return this; } dispose() {} }
class Material {
    constructor(options = {}) { Object.assign(this, options); this.emissive = { setHex() {} }; }
    dispose() {}
}
class Mesh {
    constructor(geometry = new Geometry(), material = new Material()) {
        Object.assign(this, { geometry, material, position: new Vector(), rotation: new Vector(), scale: new Vector(1, 1, 1), children: [], visible: true });
    }
    add(...children) { this.children.push(...children); }
    remove(child) { this.children = this.children.filter(value => value !== child); }
    traverse(callback) { callback(this); this.children.forEach(child => child.traverse(callback)); }
    clone() { const mesh = new Mesh(this.geometry, this.material); mesh.position.copy(this.position); mesh.scale.copy(this.scale); return mesh; }
}
const file = path.join(__dirname, '..', 'terrabrotato.html');
const html = fs.readFileSync(file, 'utf8');
const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(value => value.trim()).join('\n');
function setup(seed) {
    let time = 0, random = seed;
    const three = { Group: Mesh, Mesh, Vector3: Vector, MeshBasicMaterial: Material, Shape: class { moveTo() {} lineTo() {} closePath() {} } };
    for (const name of ['BoxGeometry', 'SphereGeometry', 'RingGeometry', 'CircleGeometry', 'PlaneGeometry', 'ConeGeometry', 'CylinderGeometry', 'OctahedronGeometry', 'ShapeGeometry', 'ExtrudeGeometry']) three[name] = Geometry;
    const element = () => ({ classList: { add() {}, remove() {} }, style: {} });
    const context = vm.createContext({ THREE: three, performance: { now: () => time * 1000 }, window: { addEventListener() {} }, document: { getElementById: element }, setTimeout() {} });
    vm.runInContext(source, context);
    context.seededRandom = () => ((random = (Math.imul(random, 1664525) + 1013904223) >>> 0) / 4294967296);
    vm.runInContext('Math.random = seededRandom', context);
    const app = vm.runInContext('Object.create(TerraBrotatoApp.prototype)', context);
    const neutral = vm.runInContext('Object.fromEntries(STAT_META.map(s=>[s.key,0]))', context);
    Object.assign(app, {
        state: 'WAVE', hp: 25, level: 1, gold: 0, baggedGold: 0, totalDmg: 0, totalKills: 0,
        ownedItems: [], weapons: [], enemies: [], props: [], pickups: [], spawns: [], projectiles: [], enemyProjectiles: [], meleeAttacks: [], fallingStars: [], particles: [], slashes: [], runHistory: [],
        baseStats: { ...neutral, maxHp: 25, critChance: 5 }, keys: {}, joyVec: { x: 0, y: 0 }, animClock: 0,
        entitiesGroup: new Mesh(), playerPos: new Vector(), camFocus: new Vector(), playerGroup: new Mesh(), torsoMesh: new Mesh(), dashShield: new Mesh(), heroRig: new Mesh(),
        legL: new Mesh(), legR: new Mesh(), armL: new Mesh(), armR: new Mesh(),
        art: { urls: {}, unitBox: new Geometry(), getMat: options => new Material(options), createShadow: () => new Mesh(), buildVoxelMesh: () => new Mesh() },
        updateHeroCosmetics() {}, updateHUD() {}, updateHUDWeapons() {}, updateCameraFollow() {}, spawnFloatText() {}, spawnTerraProp() {}, gainXP() {},
        endWave() { this.recordWaveResult('cleared'); this.state = 'DONE'; },
        triggerGameOver() { this.recordWaveResult('defeat'); this.state = 'GAMEOVER'; }
    });
    return { app, context, advance(dt) { time += dt; app.animClock = time; app.updateWave(dt); } };
}
function pilot(app) {
    const boss = app.activeBoss;
    let x = Math.cos(app.combatElapsed * .6) * 6, z = Math.sin(app.combatElapsed * .6) * 6;
    if (boss?.hp > 0) {
        const ai = boss.ai;
        if (['warn', 'leap', 'charge'].includes(ai.phase)) {
            if(boss.bossId){
                const shape=ai.shapes?.[0],dx=shape?shape.ex-shape.x:1,dz=shape?shape.ez-shape.z:0,d=Math.hypot(dx,dz)||1;
                x=app.playerPos.x+(dz/d||1)*8;z=app.playerPos.z-dx/d*8;
            }else{
                const dx = ai.endX - ai.startX, dz = ai.endZ - ai.startZ;
                x = app.playerPos.x + (boss.behavior === 'king_slime' ? 8 : dz);
                z = app.playerPos.z + (boss.behavior === 'king_slime' ? 0 : -dx);
            }
        } else { x += boss.group.position.x; z += boss.group.position.z; }
    }
    x = Math.max(-18, Math.min(18, x)); z = Math.max(-18, Math.min(18, z));
    const dx = x - app.playerPos.x, dz = z - app.playerPos.z, distance = Math.hypot(dx, dz) || 1;
    app.joyVec = { x: dx / distance, y: dz / distance };
    if (boss?.ai.phase === 'charge' && !app.dashTimer) app.tryDash();
}
function runCase(wave, build, mode, seed) {
    const engine = setup(seed), app = engine.app;
    const stage = wave === 5 ? 0 : wave === 10 ? 1 : 2;
    const ids = { blade: 'grass_blade', gun: 'minishark', star: 'starfury', economy: 'bow' };
    Object.assign(app.baseStats, { maxHp: [45, 65, 85][stage], armor: [4, 8, 12][stage], hpRegen: 2 });
    if (build === 'economy') Object.assign(app.baseStats, { luck: 60, harvesting: 35 });
    else Object.assign(app.baseStats, { meleeDmg: [3, 6, 9][stage], rangedDmg: [3, 6, 9][stage], magicDmg: [3, 6, 9][stage], attackSpeed: [8, 16, 24][stage], dmgPct: [6, 12, 18][stage] });
    app.weapons = Array.from({ length: [2, 4, 6][stage] }, () => ({ id: ids[build], tier: [2, 2, 3][stage], cd: .2, mesh: new Mesh(), recoil: new Vector() }));
    app.startWave(wave);
    if (mode === 'dummy') {
        app.clearEntities();
        const target = { hp: 10000000, maxHp: 10000000, isBoss: true, radius: 2.15, group: new Mesh(), knockback: new Vector() };
        target.group.position.set(0, 0, -4);
        app.enemies = [target]; app.activeBoss = target;
        app.updateEnemies = () => {}; app.queueEnemySpawn = () => {};
    }
    if (mode === 'boss') app.queueEnemySpawn = () => {};
    const limit = mode === 'dummy' ? 20 : 70;
    let elapsed = 0, killedAt = null;
    for (let frame = 0; frame < limit * 60 && app.state === 'WAVE'; frame++) {
        if (mode !== 'dummy') pilot(app);
        engine.advance(1 / 60); elapsed += 1 / 60;
        if(!Number.isFinite(app.playerPos.x)||!Number.isFinite(app.playerPos.z)||!Number.isFinite(app.hp))throw new Error('固定构筑模拟产生非有限状态，拒绝输出结果');
        if (mode === 'boss' && app.activeBoss.hp <= 0) { killedAt = elapsed; break; }
    }
    return { wave, build, mode, seed, seconds: +elapsed.toFixed(2), state: app.state, damage: app.totalDmg, dps: +(app.totalDmg / elapsed).toFixed(2), damageTaken: app.waveMetrics.damageTaken, hp: +app.hp.toFixed(2), kills: app.totalKills, bossKilledAt: killedAt === null ? null : +killedAt.toFixed(2), bossHpRemaining: app.activeBoss?.hp ?? null };
}
function benchmark() {
    const results = [];
    for (const wave of [5, 10, 15]) for (const build of ['blade', 'gun', 'star', 'economy']) for (const seed of [11, 29, 47]) {
        results.push(runCase(wave, build, 'dummy', seed));
        results.push(runCase(wave, build, wave === 15 ? 'wave' : 'boss', seed));
    }
    return { sourceSha256: crypto.createHash('sha256').update(html).digest('hex'), method: '真实产品战斗方法，60Hz固定步长；渲染对象替身，无场景道具与升级；固定手工属性与2/4/6把装备，不模拟经济获取。dummy为静止高血量单体靶场；boss为隔离Boss和脚本走位；wave为实际刷怪与脚本走位。无玩家无敌。仅用于版本对照，不代表真人胜率、同预算最优构筑或浏览器性能。', results };
}
if (require.main === module) {
    const output = benchmark();
    const destination = process.argv[2] || path.join(__dirname, 'combat-benchmark.json');
    fs.writeFileSync(destination, JSON.stringify(output, null, 2));
    for (const wave of [5, 10, 15]) for (const build of ['blade', 'gun', 'star', 'economy']) {
        const cases = output.results.filter(row => row.wave === wave && row.build === build);
        console.log(JSON.stringify({ wave, build, dummyDps: +(cases.filter(row => row.mode === 'dummy').reduce((sum, row) => sum + row.dps, 0) / 3).toFixed(1), combat: cases.filter(row => row.mode !== 'dummy').map(row => ({ state: row.state, hp: row.hp, bossKilledAt: row.bossKilledAt })) }));
    }
}
module.exports = { setup, runCase, benchmark };
