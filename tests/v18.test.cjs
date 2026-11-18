const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { setup } = require('../analysis/combat-benchmark.cjs');
function scene(seed=11,wave=1) {
    const engine=setup(seed),{app}=engine;
    app.weaponOrbitGroup=new app.entitiesGroup.constructor();app.rewardSeed=seed;app.shopCards=[];app.pendingCrates=0;app.pendingLevelUps=0;
    app.startWave(wave);return engine;
}
function target(app,hp=1000,x=0,z=-3) {
    const group=new app.entitiesGroup.constructor();group.position.set(x,0,z);
    const enemy={hp,maxHp:hp,radius:.5,group,knockback:group.position.clone(),speed:0,goldValue:0};app.enemies.push(enemy);return enemy;
}

test('16项属性、范围初始与全伤害上限真实参与输出',()=>{
    const {app,context}=scene();assert.equal(vm.runInContext('STAT_META.length',context),16);
    app.addWeapon('minishark');app.stats.dmgPct=50;const capped=app.getWeaponCombatStats(app.weapons[0]).dmg;
    app.stats.dmgPct=500;assert.equal(app.getWeaponCombatStats(app.weapons[0]).dmg,capped);
    app.stats.dmgPct=-50;assert.ok(app.getWeaponCombatStats(app.weapons[0]).dmg<capped);
});

test('暴击溢出每武器转化且卸装可逆，真实伤害使用1.95倍',()=>{
    const {app,context}=scene();app.clearEntities();app.addWeapon('copper_sword');
    app.stats.critChance=134;app.stats.critEffectPct=0;
    let st=app.getWeaponCombatStats(app.weapons[0]);assert.equal(st.rawCrit,140);assert.equal(st.critMultiplier,1.75);
    app.ownedItems.push(vm.runInContext("ITEMS_DB.find(i=>i.id==='crit_converter')",context));
    st=app.getWeaponCombatStats(app.weapons[0]);assert.equal(st.crit,100);assert.equal(st.conversion,20);assert.equal(st.critMultiplier,1.95);
    const en=target(app);app.hitTarget(en,100,100,0,0,{critMultiplier:st.critMultiplier});assert.equal(en.hp,805);
    app.stats.critChance=94;assert.equal(app.getWeaponCombatStats(app.weapons[0]).conversion,0);
    app.ownedItems=[];app.stats.critChance=174;assert.equal(app.getWeaponCombatStats(app.weapons[0]).critMultiplier,1.75);
});

test('默认闪避60%，独立上限修正不直接提供闪避，概率与上限一致',()=>{
    const {app,context}=scene();app.stats.dodge=100;app.hp=25;vm.runInContext('Math.random=()=>.64',context);
    app.damagePlayer(5);assert.equal(app.hp,20);
    app.hp=25;app.invulnTimer=0;app.stats.dodgeCapBonusPct=5;app.damagePlayer(5);assert.equal(app.hp,25);
    app.stats.dodge=0;app.invulnTimer=0;app.damagePlayer(5);assert.equal(app.hp,20);
});

test('近战距离所有正加成仍封顶，远程与拾取随范围继续增长且不受幸运影响',()=>{
    const {app,context}=scene();app.addWeapon('copper_sword');const base=app.getWeaponCombatStats(app.weapons[0]).range;
    app.stats.rangePct=10000;const melee=app.getWeaponCombatStats(app.weapons[0]).range;
    assert.ok(melee<=8.4&&melee<=base*1.75);const ranged=app.getWeaponCombatStats({id:'minishark',tier:1}).range;assert.ok(ranged>100);
    app.stats.rangePct=0;app.stats.luck=10000;assert.equal(vm.runInContext('getPickupRange({rangePct:0,luck:10000})',context),3);
    assert.equal(vm.runInContext('getPickupRange({rangePct:100})',context),6);
});

test('远程飞行预算无固定寿命截断，达到实际射程后不继续伤害',()=>{
    const {app}=scene();app.clearEntities();
    app.spawnProj({x:0,z:0,vx:5,vz:0,dmg:5,crit:0,pierce:1,bounces:0,color:0xffffff,life:1,attack:{range:100}});
    assert.ok(app.projectiles[0].life>=20);app.projectiles=[];
    const en=target(app,100,6,0);
    app.spawnProj({x:0,z:0,vx:10,vz:0,dmg:5,crit:0,pierce:1,bounces:0,color:0xffffff,life:1,attack:{range:3}});
    app.updateProjectiles(1);assert.equal(en.hp,100);assert.equal(app.projectiles.length,0);
});

test('升级只自动生命+1且每级保留一次选择，封顶候选被过滤',()=>{
    const {app,context}=scene();app.xp=0;app.xpNext=16;app.pendingLevelUps=0;app.gainXP=vm.runInContext('TerraBrotatoApp.prototype.gainXP',context);
    const before=app.baseStats.maxHp;app.gainXP(100);assert.equal(app.baseStats.maxHp,before+app.level-1);assert.equal(app.pendingLevelUps,app.level-1);
    assert.equal(app.baseStats.meleeDmg,0);assert.equal(app.baseStats.rangePct,0);
    app.stats.dmgPct=50;app.stats.dodge=60;app.rollLevelUpCards();assert.ok(app.levelUpChoices.every(c=>!['dodge','dmgPct'].includes(c.key)));
});

test('难度生命只乘一次，三个Boss按出场波次而非种类决定血量',()=>{
    const {app}=scene();app.difficulty=3;app.startWave(10);
    for(const id of ['forge','weaver','prism']){app.clearEntities();app.spawnBoss(id);assert.equal(app.activeBoss.maxHp,12090);}
    app.clearEntities();app.spawnEnemyNow('slime_green',0,0);assert.equal(app.enemies[0].maxHp,24*(1+9*.35)*1.55);
    app.difficulty=1;app.startWave(5);assert.equal(app.activeBoss.maxHp,1500);
});

test('洗牌袋一轮不重复，跨轮不连续重复，同种子可复现',()=>{
    const one=scene(47).app,two=scene(47).app;
    const a=Array.from({length:12},()=>one.drawBoss()),b=Array.from({length:12},()=>two.drawBoss());assert.deepEqual(a,b);
    for(let i=0;i<12;i+=3)assert.equal(new Set(a.slice(i,i+3)).size,3);
    assert.ok(a.every((id,i)=>i===0||id!==a[i-1]));
});

test('第5、10、15、20、25波都有Boss，第15波必须击杀才能结算',()=>{
    const {app}=scene();
    for(const wave of [5,10,15,20,25]){app.startWave(wave);assert.ok(app.activeBoss.bossId);app.waveTimer=0;assert.equal(app.canEndWave(),false);app.activeBoss.hp=0;app.waveBossDefeated=true;assert.equal(app.canEndWave(),true);}
});

test('原创Boss预警固定路径，完整预警前不伤害，单技能不重复伤害',()=>{
    const {app}=scene(11,5);app.clearEntities();app.spawnBoss('forge');const b=app.activeBoss;b.ai.skill=2;
    app.playerPos.set(0,0,-10);app.beginBossWarning(b);const shape={...b.ai.shapes[0]};
    let hits=0;app.damagePlayer=()=>{hits++;};app.updateOriginalBoss(b,.99);assert.equal(hits,0);assert.deepEqual({...b.ai.shapes[0]},shape);
    app.updateOriginalBoss(b,.02);assert.equal(hits,1);app.updateOriginalBoss(b,.5);assert.equal(hits,1);
});

test('三个Boss九种技能均能执行，召唤数量受限且不产生奖励',()=>{
    const {app}=scene(11,5);app.damagePlayer=()=>{};
    for(const id of ['forge','weaver','prism'])for(let skill=0;skill<3;skill++){
        app.clearEntities();app.spawnBoss(id);const b=app.activeBoss;b.ai.skill=(skill+2)%3;app.beginBossWarning(b);app.updateOriginalBoss(b,1.01);assert.equal(b.ai.phase,'recover');
        assert.ok(app.enemies.filter(e=>e.rewardless).length<=4);for(const e of app.enemies.filter(e=>e.rewardless))assert.equal(e.goldValue,0);
    }
});

test('核心三选一来自真实池、含适配项，重复打开不重抽且不能选未提供核心',()=>{
    const {app}=scene();app.addWeapon('minishark');app.pendingCoreChoice=true;app.openCorePhase();const first=[...app.coreOffers];
    assert.equal(new Set(first).size,3);assert.ok(first.includes('volley'));app.openCorePhase();assert.deepEqual([...app.coreOffers],first);
    const missing=['heavy','star','volley','chain','hive','charge'].find(id=>!first.includes(id));app.pickCore(missing);assert.equal(app.state,'CORE');
    app.openShopPhase=function(){this.state='SHOP';};app.pickCore(first[0]);assert.equal(app.state,'SHOP');
});

test('Boss不掉宝箱，专武奖励待结算；拒绝不会解锁商店强化',()=>{
    const {app}=scene(11,5);const boss=app.activeBoss;app.hitTarget(boss,100000,0,0,0);
    assert.equal(app.pickups.some(p=>p.type==='crate'),false);assert.ok(app.pendingBossReward);
    app.openBossReward();app.pickBossReward(-1);assert.equal(app.pendingBossReward,null);assert.equal(app.eligibleBossWeapons().length,0);
    for(let i=0;i<30;i++){app.generateShopCards();assert.ok(app.shopCards.every(c=>c.kind!=='boss_upgrade'));}
});

test('满槽专武替换返款仅一次、实例唯一，不能复制同款',()=>{
    const {app}=scene();for(let i=0;i<6;i++)app.addWeapon('grass_blade');app.gold=0;
    const refund=app.weaponSellValue(app.weapons[0]);app.pendingBossReward={bossId:'forge',weaponId:'boss_hammer'};app.openBossReward();app.pickBossReward(0);
    assert.equal(app.weapons.length,6);assert.equal(app.gold,refund);assert.equal(app.weapons.filter(w=>w.id==='boss_hammer').length,1);
    app.pickBossReward(1);assert.equal(app.gold,refund);assert.equal(app.addWeapon('boss_hammer',2),false);
});

test('专武改装绑定目标与分支，跨三个商店最多3级；旧卡失效',()=>{
    const {app}=scene();app.addWeapon('boss_hammer',2);const w=app.weapons[0];app.gold=1000;
    let spent=0;
    for(let i=0;i<3;i++){app.openShopPhase();const price=app.bossModificationPrice(w);spent+=price;app.buyBossModification(w.instanceId,i,'single');assert.equal(w.rank,i+1);app.buyBossModification(w.instanceId,i,'single');assert.equal(w.rank,i+1);}
    assert.equal(app.gold,1000-spent);assert.equal(app.eligibleBossWeapons().length,0);
    w.rank=1;app.openShopPhase();app.buyBossModification(w.instanceId,1,'area');assert.equal(w.rank,1);
    app.shopCards=[{kind:'boss_upgrade',instanceId:w.instanceId,rank:1,locked:true}];app.weapons=[];app.pruneBossCards();assert.equal(app.shopCards[0].invalid,true);assert.equal(app.shopCards[0].locked,false);
});

test('随机货架不再投放专武强化，刷新不重置常驻改装次数',()=>{
    const {app}=scene();app.addWeapon('boss_prism',2);app.addWeapon('boss_hammer',2);app.gold=1000;app.openShopPhase();
    const w=app.weapons[0];app.buyBossModification(w.instanceId,0,'single');assert.equal(w.rank,1);
    for(let i=0;i<10;i++){app.generateShopCards();assert.equal(app.shopCards.length,4);assert.equal(app.shopCards.filter(c=>c.kind==='boss_upgrade').length,0);}
    const other=app.weapons[1];app.buyBossModification(other.instanceId,0,'single');assert.equal(other.rank,0);assert.equal(app.bossWorkshopUsed,true);
});

test('连锁去重、衍生不暴击，导弧最多4跳',()=>{
    const {app}=scene();app.clearEntities();app.addWeapon('pulse_chain');app.selectedCoreId='chain';app.recalcStats();
    const enemies=[0,1,2,3,4].map(i=>target(app,1000,i*1.4,0));const w=app.weapons[0],st=app.getWeaponCombatStats(w);st.crit=100;
    app.fireWeapon(w,{behavior:'chain',color:0xffffff},st,0,0,enemies[0]);
    assert.equal(enemies.filter(e=>e.hp<1000).length,4);assert.ok(enemies[1].hp>enemies[0].hp);
});

test('冷雾四跳且不暴击，减速与清场回收有效',()=>{
    const {app}=scene();app.clearEntities();app.addWeapon('frost_lamp');const en=target(app),w=app.weapons[0];
    const def={behavior:'field',color:0xffffff};const st={...app.getWeaponCombatStats(w),crit:100};app.fireWeapon(w,def,st,0,0,en);
    for(let i=0;i<10;i++)app.updateAdvancedEffects(.2);
    assert.equal(1000-en.hp,st.dmg);assert.equal(app.advancedEffects.length,0);assert.equal(en.slowRatio,.8);
    app.fireWeapon(w,def,st,0,0,en);app.clearEntities();assert.equal(app.advancedEffects.length,0);
});

test('构装单位上限与固定部署周期生效，机巢不能无限复制',()=>{
    const {app}=scene();app.clearEntities();app.selectedCoreId='hive';app.addWeapon('sentry');const w=app.weapons[0],en=target(app);
    for(let i=0;i<20;i++)app.fireWeapon(w,{behavior:'turret',color:0xffffff},app.getWeaponCombatStats(w),0,0,en);
    assert.ok(app.advancedEffects.filter(e=>e.kind==='turret'&&!e.expired).length<=2);app.clearEntities();assert.equal(app.advancedEffects.length,0);
});

test('蓄压延迟前不命中，释放只执行一次',()=>{
    const {app}=scene();app.clearEntities();app.addWeapon('rail_charge');const w=app.weapons[0],en=target(app,1000,0,-4);app.selectedCoreId='charge';
    app.fireWeapon(w,{behavior:'charge',color:0xffffff},app.getWeaponCombatStats(w),0,0,en);assert.equal(app.projectiles.length,0);assert.equal(w.charging,true);
    app.updateAdvancedEffects(.5);assert.equal(app.projectiles.length,0);app.updateAdvancedEffects(2);assert.equal(app.projectiles.length,1);assert.equal(w.charging,false);
    app.updateAdvancedEffects(2);assert.equal(app.projectiles.length,1);
});

test('分束专武交叉棱面共享主束、连锁与末跳预算',()=>{
    const {app,context}=scene();app.clearEntities();app.addWeapon('boss_prism',2);app.selectedCoreId='volley';
    const def=vm.runInContext('WEAPONS_DB.boss_prism',context),w=app.weapons[0],st=app.getWeaponCombatStats(w);st.crit=0;
    const enemies=[0,1,2,3].map(i=>target(app,1000,i*1.4,0));app.fireWeapon(w,def,st,0,0,enemies[0]);app.updateAdvancedEffects(.61);
    assert.equal(1000-enemies[0].hp,20);assert.equal(1000-enemies[1].hp,8);assert.equal(1000-enemies[2].hp,0);
    assert.equal(app.totalDmg,28);assert.equal(app.coreFits('volley','boss_prism'),true);
});

test('混合武器的远程段不受近战距离上限及重锤近战增伤影响',()=>{
    const {app,context}=scene();app.clearEntities();app.addWeapon('terra_blade',4);app.stats.rangePct=1000;
    const def=vm.runInContext('WEAPONS_DB.terra_blade',context),w=app.weapons[0];
    const normal=app.getWeaponCombatStats(w);app.selectedCoreId='heavy';const heavy=app.getWeaponCombatStats(w);
    assert.ok(heavy.range<=8.4);assert.ok(heavy.projectileRange>heavy.range*2);
    app.fireWeapon(w,def,heavy,0,0,target(app,1000,0,-8));
    const p=app.projectiles[0];assert.equal(p.distanceBudget,heavy.projectileRange);
    assert.ok(Math.abs(p.dmg-Math.round(normal.dmg*vm.runInContext('BALANCE.beamRatio',context)))<=1);
});

test('角色及装备闪避上限接口可累加，异常配置不能进入游戏',()=>{
    const {app,context}=scene();app.selectedCharId=vm.runInContext('CHARACTERS[0].id',context);
    vm.runInContext('CHARACTERS[0].dodgeCapBonusPct=5',context);app.ownedItems=[{dodgeCapBonusPct:4}];
    app.recalcStats();assert.equal(app.stats.dodgeCapBonusPct,9);app.stats.dodge=100;assert.equal(app.getEffectiveStat('dodge'),69);
    assert.doesNotThrow(()=>vm.runInContext('validateGameData()',context));
    vm.runInContext('ITEMS_DB[0].dodgeCapBonusPct=Infinity',context);
    assert.throws(()=>vm.runInContext('validateGameData()',context),/装备闪避上限修正无效/);
});

test('专武广域分支增加连锁覆盖，卸装不会留下额外跳距',()=>{
    const {app,context}=scene();app.clearEntities();app.addWeapon('boss_prism',2);const w=app.weapons[0];w.rank=3;w.branch='area';
    const a=target(app,1000,0,-3),b=target(app,1000,5.32,-3),def=vm.runInContext('WEAPONS_DB.boss_prism',context);
    app.fireWeapon(w,def,app.getWeaponCombatStats(w),0,0,a);assert.ok(b.hp<1000);
    a.hp=b.hp=1000;w.branch='single';app.fireWeapon(w,def,app.getWeaponCombatStats(w),0,0,a);assert.equal(b.hp,1000);
});

test('同店普通武器不重复ID，后位锁定卡也在抽样前预留',()=>{
    const {app}=scene(29,14);app.shopCards=[{bought:true},{bought:true},{bought:true},{kind:'weapon',id:'minishark',tier:2,locked:true}];
    for(let i=0;i<100;i++){
        app.generateShopCards();const ids=app.shopCards.filter(c=>c.kind==='weapon').map(c=>c.id);
        assert.equal(new Set(ids).size,ids.length);assert.equal(app.shopCards[3].id,'minishark');
    }
});

test('真实20波结算写入下一难度，继续无尽仍领取未处理专武',()=>{
    const {app,context}=scene(11,20),nodes=new Map(),saved=new Map();
    context.document.getElementById=id=>{if(!nodes.has(id))nodes.set(id,{classList:{add(){},remove(){}},style:{}});return nodes.get(id);};
    context.localStorage={setItem:(key,value)=>saved.set(key,value)};context.subject=app;vm.runInContext('app=subject',context);
    app.endWave=vm.runInContext('TerraBrotatoApp.prototype.endWave',context);app.triggerGameOver=vm.runInContext('TerraBrotatoApp.prototype.triggerGameOver',context);
    app.difficulty=2;app.selectedCoreId='heavy';app.testingMode=false;app.waveTimer=0;
    app.hitTarget(app.activeBoss,100000,0,0,0);app.endWave();
    assert.equal(app.state,'GAMEOVER');assert.equal(app.victory,true);assert.equal(saved.get('ember-difficulty'),'3');
    assert.match(nodes.get('gameover-title').textContent,/第20波/);assert.ok(app.pendingBossReward);
    context.window.continueEndless();assert.equal(app.state,'BOSS_REWARD');
});

test('第10波继续、20波胜利且测试环境不写入解锁记录',()=>{
    const {app,context}=scene();app.endWave=vm.runInContext('TerraBrotatoApp.prototype.endWave',context);let victories=0;
    app.triggerGameOver=()=>{victories++;app.state='GAMEOVER';};app.advancePostWave=function(){this.state='SHOP';};
    for(const wave of [10,20]){app.startWave(wave);app.activeBoss.hp=0;app.waveBossDefeated=true;app.waveTimer=0;app.endWave();assert.equal(victories,wave===20?1:0);}
});
