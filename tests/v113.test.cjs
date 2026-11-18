const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { setup } = require('../analysis/combat-benchmark.cjs');

function scene(id = null, tier = 1) {
    const engine=setup(29),a=engine.app;
    a.weaponOrbitGroup=new a.entitiesGroup.constructor();
    Object.assign(a,{xp:0,xpNext:16,pendingLevelUps:0,pendingCrates:0});
    a.startWave(1);a.clearEntities();
    if(id)a.addWeapon(id,tier);
    return engine;
}

function target(a,x=0,z=-3,hp=10000) {
    const group=new a.entitiesGroup.constructor();group.position.set(x,0,z);
    const enemy={group,hp,maxHp:hp,radius:.4,speed:0,knockback:group.position.clone(),goldValue:0};
    a.enemies.push(enemy);return enemy;
}

function fire(engine,enemy) {
    const a=engine.app,w=a.weapons[0],def=vm.runInContext(`WEAPONS_DB.${w.id}`,engine.context),st=a.getWeaponCombatStats(w);
    st.crit=0;a.fireWeapon(w,def,st,0,0,enemy);return st;
}

test('结束回合自动领取远处全部金币、经验、红心和宝箱，重复结算不增发',()=>{
    const e=scene(),a=e.app,proto=vm.runInContext('TerraBrotatoApp.prototype',e.context);
    a.gainXP=proto.gainXP;a.endWave=proto.endWave;a.advancePostWave=function(){this.state='SHOP';};
    a.hp=10;a.spawnPickup('coin',19,19,6);a.spawnPickup('crate',-19,-19,2);a.spawnPickup('heart',19,-19,6);a.spawnPickup('xp',-19,19,20);
    a.baggedGold=3;a.waveTimer=0;a.endWave();
    assert.equal(a.gold,9);assert.equal(a.baggedGold,0);assert.equal(a.level,2);assert.equal(a.xp,10);
    assert.equal(a.hp,17);assert.equal(a.pendingCrates,2);assert.equal(a.pendingLevelUps,1);assert.equal(a.pickups.length,0);
    assert.equal(a.runHistory[0].coinIncome,9);assert.equal(a.runHistory[0].autoCollected.hearts,1);
    a.endWave();assert.equal(a.gold,9);assert.equal(a.pendingCrates,2);assert.equal(a.xp,10);
});

test('自动拾取旧储蓄加成金币只给新发行部分的经验，失败不自动领奖',()=>{
    const e=scene(),a=e.app;let xp=0;a.gainXP=n=>xp+=n;
    a.baggedGold=5;a.spawnPickup('coin',19,19,2);a.collectAllPickups();
    assert.equal(a.gold,7);assert.equal(xp,2);assert.equal(a.baggedGold,0);
    a.spawnPickup('coin',19,19,3);a.state='GAMEOVER';a.endWave=vm.runInContext('TerraBrotatoApp.prototype.endWave',e.context);a.endWave();
    assert.equal(a.gold,7);assert.equal(a.pickups.length,1);
});

test('低阶升阶保留羁绊，满槽合成不再骤降四成输出',()=>{
    const a=scene().app;a.wave=3;
    for(const id of ['grass_blade','minishark','water_bolt']){
        a.weapons=Array.from({length:6},()=>({id,tier:1}));const preview=a.getCombinePreview(0);
        assert.equal(preview.changes,'');assert.ok(preview.after>=preview.before*.9,`${id}: ${preview.after}/${preview.before}`);
    }
});

test('普通速射暴击Boss不触发全局停顿，重击停顿有共享冷却',()=>{
    const e=scene('minishark'),a=e.app,en=target(a);en.isBoss=true;
    const w=a.weapons[0];a.hitTarget(en,100,100,0,0,{attack:{weaponId:w.id,weaponInstanceId:w.instanceId}});
    assert.equal(a.hitstopTimer,0);
    a.selectedCoreId='heavy';a.addWeapon('grass_blade');const sword=a.weapons[1];
    a.hitTarget(en,30,0,0,0,{attack:{weaponId:sword.id,weaponInstanceId:sword.instanceId}});assert.ok(a.hitstopTimer>0);
    a.hitstopTimer=0;a.hitTarget(en,30,0,0,0,{attack:{weaponId:sword.id,weaponInstanceId:sword.instanceId}});assert.equal(a.hitstopTimer,0);
});

test('真实附着跳伤归入DOT，场景道具不混入账本，跨波快照互不污染',()=>{
    const e=scene('etch_nozzle'),a=e.app,en=target(a);fire(e,en);a.updateAdvancedEffects(2);
    assert.equal(a.currentWaveWeaponStats.etch_nozzle.primaryDmg,10);assert.equal(a.currentWaveWeaponStats.etch_nozzle.dotDmg,10);
    assert.equal(a.currentWaveWeaponStats.etch_nozzle.derivativeDmg,0);
    const prop={...en,hp:100,isProp:true};a.hitTarget(prop,10,0,0,0,{weaponId:'prop_probe'});assert.equal(a.currentWaveWeaponStats.prop_probe,undefined);
    a.recordWaveResult('cleared');const before=a.runHistory[0].weaponStats.etch_nozzle.totalDmg;
    a.startWave(2);assert.equal(Object.keys(a.currentWaveWeaponStats).length,0);assert.equal(a.runHistory[0].weaponStats.etch_nozzle.totalDmg,before);
});

test('滑移轴真实缩短冲刺，电池可连续使用两次并逐次充能',()=>{
    const a=scene().app;a.ownedItems=[{id:'slide_axle'},{id:'slide_axle'}];a.startWave(2);
    assert.equal(a.tryDash(),true);assert.equal(a.dashCooldown,2.4);a.updateDash(2.4);assert.equal(a.tryDash(),true);
    a.ownedItems=[{id:'battery_cell'}];a.startWave(3);assert.equal(a.tryDash(),true);a.updateDash(.45);assert.equal(a.tryDash(),true);
    a.updateDash(.45);assert.equal(a.tryDash(),false);assert.equal(a.dashCharges,0);a.updateDash(3.01);assert.equal(a.dashCharges,1);
});

test('点射三弹分时释放、散射四弹共享整次预算，出售后停止后续点射',()=>{
    for(const id of ['ratchet_crossbow','shard_blaster']){
        const e=scene(id),a=e.app,en=target(a),st=fire(e,en);
        if(id==='ratchet_crossbow'){assert.equal(a.projectiles.length,1);a.updateAdvancedEffects(.25);assert.equal(a.projectiles.length,3);}
        else assert.equal(a.projectiles.length,4);
        assert.equal(a.projectiles.reduce((n,p)=>n+p.dmg,0),st.dmg);
        assert.ok(a.projectiles.every(p=>p.attack===a.projectiles[0].attack));assert.equal(a.waveMetrics.attacks,1);
    }
    const e=scene('ratchet_crossbow'),a=e.app;fire(e,target(a));a.weapons=[];a.updateAdvancedEffects(1);assert.equal(a.projectiles.length,1);assert.equal(a.advancedEffects.length,0);
});

test('轨道接触共享目标冷却，清场回收；折返镰拥有独立返程伤害',()=>{
    const e=scene('orbit_loom'),a=e.app,en=target(a,3.64,0);fire(e,en);
    assert.equal(a.projectiles.length,0);assert.equal(a.advancedEffects[0].mesh.children.length,3);
    a.updateAdvancedEffects(.01);const hp=en.hp;assert.ok(hp<10000);a.updateAdvancedEffects(.01);assert.equal(en.hp,hp);
    a.clearEntities();assert.equal(a.advancedEffects.length,0);
    const r=scene('return_scythe');r.app.selectedCoreId='return';fire(r,target(r.app));const p=r.app.projectiles[0];
    assert.equal(p.boomerang,true);assert.ok(p.returnDmg>0);p.travelled=p.distanceBudget;r.app.updateProjectiles(.01);assert.equal(p.returning,true);assert.equal(p.dmg,p.returnDmg);
});

test('回声达到阈值延迟复制且不递归，三击刻针只引爆一次',()=>{
    const e=scene('echo_disc'),a=e.app;a.selectedCoreId='echo';const en=target(a);
    for(let i=0;i<3;i++)fire(e,en);assert.equal(a.advancedEffects.filter(x=>x.kind==='echo').length,1);
    a.updateAdvancedEffects(.49);assert.equal(a.projectiles.length,3);a.updateAdvancedEffects(.01);assert.equal(a.projectiles.length,4);
    a.updateAdvancedEffects(2);assert.equal(a.projectiles.length,4);assert.equal(a.waveMetrics.attacks,3);
    const m=scene('seal_needle'),b=m.app,primary=target(b),nearby=target(b,.5,-3);let direct=0,burst=0;
    for(let i=0;i<3;i++){fire(m,primary);const p=b.projectiles.at(-1);direct+=p.dmg;burst=p.attack.markDamage;b.hitTarget(primary,p.dmg,0,0,0,{attack:p.attack});}
    assert.equal(10000-primary.hp,direct+burst);assert.equal(10000-nearby.hp,burst);assert.equal(b.currentWaveWeaponStats.seal_needle.derivativeDmg,burst*2);
});

test('负面道具的条件收益实际生效，红心增益、预算和护盾触发正确',()=>{
    const e=scene('grass_blade'),a=e.app,w=a.weapons[0],base=a.getWeaponCombatStats(w).dmg;
    a.ownedItems=[{id:'crit_glass'}];a.hp=10;assert.ok(a.getWeaponCombatStats(w).dmg>base);
    a.ownedItems=[{id:'phase_rectifier'}];a.hp=25;assert.ok(a.getWeaponCombatStats(w).dmg>base);
    a.ownedItems=[{id:'needle_box'}];a.hp=10;a.spawnPickup('heart',0,0,5);a.collectAllPickups();assert.equal(a.hp,16);
    a.ownedItems=[{id:'throttle_valve'}];let coins=0;for(let i=0;i<100;i++)coins+=a.issueEnemyCoins(1);assert.equal(coins,15);
    a.ownedItems=[{id:'relay_pickup'}];a.shield=0;a.spawnPickup('coin',0,0,40);a.collectAllPickups();assert.equal(a.shield,1.5);
});

test('赊账首笔减免只发生一次，刷新折扣与出售比例作用于真实交易',()=>{
    const a=scene().app;a.state='SHOP';a.wave=5;a.gold=12;a.ownedItems=[{id:'credit_voucher'},{id:'wax_clip'},{id:'salvage_license'}];
    a.shopCards=[{kind:'item',id:'shackle',price:20,tier:1}];a.buyShopCard(0);
    assert.equal(a.gold,0);assert.equal(a.creditDebt,4);assert.equal(a.creditUsed,true);a.buyShopCard(0);assert.equal(a.creditDebt,4);
    assert.equal(a.getCurrentShopRerollCost(),4);a.shopRerolls=1;assert.equal(a.getCurrentShopRerollCost(),8);
    assert.equal(a.weaponSellValue({id:'bow',tier:1}),7);
});

test('无尽额外生命倍率用于实际生成实体，与图鉴同源',()=>{
    const a=scene().app;a.startWave(25);a.spawnEnemyNow('slime_green',0,0);
    assert.ok(Math.abs(a.enemies.at(-1).maxHp-252.672)<1e-8);
    a.startWave(30);a.spawnEnemyNow('slime_green',0,0);assert.ok(a.enemies.at(-1).maxHp>24*(1+29*.35)*1.12);
});

test('保存并恢复商店可继续下一波，一次性保险和锁定商品不被重置',()=>{
    const e=scene('grass_blade',2),a=e.app,storage=new Map();e.context.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
    a.state='SHOP';a.wave=4;a.fuseTriggered=true;a.rewardSeed=123;a.nextBossId='prism';a.creditDebt=4;
    a.shopCards=[{kind:'weapon',id:'bow',tier:1,price:19,locked:true,bought:false}];a.shopRerolls=2;a.bossWorkshopUsed=true;
    const store=vm.runInContext('EmberStorage',e.context);store.saveActiveRun(a);const saved=store.getActiveRun();assert.equal(saved.version,2);
    a.createPlayerMesh=function(){this.weaponOrbitGroup=new this.entitiesGroup.constructor();};a.buildBiomeDiorama=()=>{};a.restoreActiveRun(saved);
    assert.equal(a.state,'SHOP');assert.equal(a.fuseTriggered,true);assert.equal(a.creditDebt,4);assert.equal(a.nextBossId,'prism');
    assert.equal(a.shopCards[0].locked,true);assert.equal(a.shopCards[0].price,19);assert.equal(a.shopRerolls,2);assert.equal(a.bossWorkshopUsed,true);
    assert.ok(a.weaponOrbitGroup.children.includes(a.weapons[0].mesh),'武器必须挂入恢复后的新角色模型');
    a.startWave(5);assert.ok(a.activeBoss);assert.equal(a.fuseTriggered,true);
    a.startNewRun();assert.equal(a.fuseTriggered,false);
});

test('销毁临时网格不释放工厂共享几何体和缓存材质',()=>{
    const a=scene().app,mesh=new a.entitiesGroup.constructor();let sharedGeometry=0,sharedMaterial=0,ownedGeometry=0,ownedMaterial=0;
    a.art.unitBox={dispose(){sharedGeometry++;}};const material={dispose(){sharedMaterial++;}};a.art.matCache={shared:material};
    mesh.geometry=a.art.unitBox;mesh.material=material;
    const child=new a.entitiesGroup.constructor();child.geometry={dispose(){ownedGeometry++;}};child.material={dispose(){ownedMaterial++;}};mesh.add(child);
    a.disposeCombatMesh(mesh);assert.equal(sharedGeometry,0);assert.equal(sharedMaterial,0);assert.equal(ownedGeometry,1);assert.equal(ownedMaterial,1);
});

test('静息治疗次数受限，接触受击触发护膜，双充能冲刺不绕过急停冷却',()=>{
    const e=scene(),a=e.app;a.ownedItems=[{id:'rest_prism'}];a.hp=10;a.queueEnemySpawn=()=>{};
    for(let i=0;i<60*8;i++)e.advance(1/60);assert.equal(a.itemTimers.restUses,3);assert.equal(a.hp,12.25);
    a.ownedItems=[{id:'thermal_film'}];const en=target(a,1,0);a.damagePlayer(2,'接触测试','contact');assert.ok(Math.abs(en.knockback.x)>0);
    a.ownedItems=[{id:'battery_cell'},{id:'brake_buckle'}];a.startWave(2);a.tryDash();a.updateDash(.45);a.combatElapsed=.46;
    a.invulnTimer=0;a.damagePlayer(20,'急停测试');assert.equal(a.hp,8);
    assert.equal(a.tryDash(),true);assert.equal(a.brakeUntil,.5);assert.equal(a.brakeReadyAt,3);
});
