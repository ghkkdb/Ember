const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {setup}=require('../analysis/combat-benchmark.cjs');

function scene(id,core=null,rank=0,branch=null){
    const e=setup(11),{app,context}=e;app.weaponOrbitGroup=new app.entitiesGroup.constructor();app.startWave(1);app.clearEntities();
    app.selectedCoreId=core;app.addWeapon(id,2);const w=app.weapons[0];w.rank=rank;w.branch=branch;app.stats.critChance=-100;
    vm.runInContext('Math.random=()=>.99',context);
    return {...e,w,def:vm.runInContext(`WEAPONS_DB.${id}`,context)};
}
function target(app,x=0,z=-2.5,hp=100000){
    const group=new app.entitiesGroup.constructor();group.position.set(x,0,z);
    const en={hp,maxHp:hp,radius:.4,group,speed:0,knockback:group.position.clone(),goldValue:0};app.enemies.push(en);return en;
}
function hammer(e,en){
    const {app,w,def}=e;app.fireWeapon(w,def,app.getWeaponCombatStats(w),0,0,en);
    app.updateAdvancedEffects(.9);app.updateCombatEffects(.18);app.updateAdvancedEffects(.8);
}
function beeShot(e,en){
    const {app,w}=e;app.ensureBossHive(w,app.getWeaponCombatStats(w));
    const hive=app.advancedEffects.find(n=>n.kind==='boss_bees'),p=hive.mesh.position;
    hive.aim=Math.atan2(en.group.position.z-p.z,en.group.position.x-p.x);hive.next=0;app.updateAdvancedEffects(.001);
}

test('铰锤第三次有效主击仅替换一次震波，三轮总伤132；多目标不多充能',()=>{
    const e=scene('boss_hammer'),en=target(e.app),other=target(e.app,.3,-2.5);
    hammer(e,en);assert.equal(100000-en.hp,38);assert.equal(e.w.resource,20);
    hammer(e,en);assert.equal(e.w.resource,40);hammer(e,en);
    assert.equal(100000-en.hp,132);assert.equal(100000-other.hp,132);assert.equal(e.w.resource,0);
});

test('铰锤衍生不暴击、不吸血；击杀计入充能且重锤不重复击杀',()=>{
    const e=scene('boss_hammer','heavy'),{app,w}=e,en=target(app,0,-1.5,1000);app.stats.critChance=100;app.stats.lifeSteal=100;
    vm.runInContext('Math.random=()=>0',e.context);let heals=0;app.applyLifeSteal=()=>heals++;
    hammer(e,en);assert.equal(1000-en.hp,Math.round(42*1.75)+9);assert.equal(heals,1);
    const weak=target(app,0,-1.5,1);hammer(e,weak);assert.equal(app.totalKills,1);assert.equal(w.resource,40);
});

test('铰锤裂缝共享强震预算，波形不能越过本次释放原点8.4单位',()=>{
    const e=scene('boss_hammer','star',3,'area'),{app,w}=e,en=target(app,0,-1);w.resource=40;
    hammer(e,en);assert.ok(100000-en.hp<=29+24);assert.equal(en.slowRatio,.8);
    const far=target(app,0,-9);app.resolveBossImpact({profile:app.getBossProfile(w,app.getWeaponCombatStats(w)),strong:true,x:0,z:-7,ox:0,oz:0,angle:-Math.PI/2,attack:{}});
    assert.equal(far.hp,100000);
});

test('重锤聚砧的冲击随有效主击结算，较远落锤不丢失震波预算',()=>{
    const e=scene('boss_hammer','heavy',3,'single'),en=target(e.app,0,-3);e.w.resource=40;
    hammer(e,en);assert.equal(100000-en.hp,42+41);
});

test('携压冲刺替换默认冲刺伤害，蓄力不提前在半路释放',()=>{
    const e=scene('boss_hammer','charge'),{app,w,def}=e;w.resource=40;app.joyVec={x:0,y:-1};
    const en=target(app,0,-12.6);app.fireWeapon(w,def,app.getWeaponCombatStats(w),0,0,en);
    assert.equal(app.tryDash(),true);app.updateDash(.2);app.updateAdvancedEffects(1);assert.equal(w.charging,true);assert.equal(en.hp,100000);
    app.updateDash(.25);app.updateAdvancedEffects(.01);app.updateCombatEffects(.18);app.updateAdvancedEffects(.6);
    assert.equal(w.resource,0);assert.ok(app.totalDmg>0);assert.ok(app.totalDmg<=app.getWeaponCombatStats(w).dmg+app.getBossProfile(w,app.getWeaponCombatStats(w)).strong);
});

test('蜂巢五组命中齐射共享追加12，聚猎3级四组追加17',()=>{
    for(const [rank,branch,count,total] of [[0,null,5,72],[3,'single',4,65]]){
        const e=scene('boss_hive',null,rank,branch),en=target(e.app);for(let i=0;i<count;i++)beeShot(e,en);
        assert.equal(100000-en.hp,total);assert.equal(e.w.resource,0);assert.equal(e.app.advancedEffects.filter(n=>n.kind==='boss_bees').length,1);
    }
});

test('双蜂、分流不复制充能与预算，协同不能触发吸血或递归',()=>{
    for(const core of [null,'hive','volley']){
        const e=scene('boss_hive',core,2,'area'),en=target(e.app);en.radius=3;e.w.resource=80;
        e.app.stats.lifeSteal=100;vm.runInContext('Math.random=()=>0',e.context);let heals=0;e.app.applyLifeSteal=()=>heals++;
        beeShot(e,en);assert.equal(e.w.resource,0);assert.equal(100000-en.hp,core?28:24);assert.equal(heals,core==='volley'?4:2);
        const hive=e.app.advancedEffects.find(n=>n.kind==='boss_bees');assert.equal(hive.mesh.children.length,2);
    }
});

test('蜂群持续跟随但不瞬移，有限转向，无敌人不积攒待发射队列',()=>{
    const e=scene('boss_hive'),{app,w}=e;app.ensureBossHive(w,app.getWeaponCombatStats(w));
    const hive=app.advancedEffects[0];app.playerPos.x=20;app.updateAdvancedEffects(.1);assert.ok(hive.mesh.position.x<=1.1);
    app.updateAdvancedEffects(10);assert.equal(hive.expired,undefined);assert.equal(hive.next,0);
    app.playerPos.set(0,0,0);const en=target(app,0,-3);hive.mesh.position.set(0,0,0);hive.aim=Math.PI/2;app.updateAdvancedEffects(.001);assert.equal(en.hp,100000);
});

test('播簇3级砂网仅减速、限频；跟随蜂和普通哨机共享6单位上限',()=>{
    const e=scene('boss_hive','hive',3,'area'),{app,w}=e,en=target(app);en.radius=3;
    w.resource=80;beeShot(e,en);assert.equal(app.advancedEffects.filter(n=>n.kind==='boss_net').length,1);
    w.resource=80;beeShot(e,en);assert.equal(app.advancedEffects.filter(n=>n.kind==='boss_net').length,1);
    app.addWeapon('sentry');const sentry=app.weapons[1],def=vm.runInContext('WEAPONS_DB.sentry',e.context);
    for(let i=0;i<5;i++){sentry.instanceId++;app.fireAdvancedWeapon(sentry,def,app.getWeaponCombatStats(sentry),0,0,en);}
    const units=app.advancedEffects.filter(n=>!n.expired&&(n.kind==='turret'||n.kind==='boss_bees'));
    assert.ok(units.reduce((n,v)=>n+(v.kind==='boss_bees'?v.mesh.children.length:1),0)<=6);
});

test('棱核单Boss空路25→27→28→30，完整三目标总预算30',()=>{
    for(const [rank,total] of [[0,25],[1,27],[2,28],[3,30]]){
        const e=scene('boss_prism',null,rank,rank?'single':null),en=target(e.app);
        e.app.fireWeapon(e.w,e.def,e.app.getWeaponCombatStats(e.w),0,0,en);assert.equal(100000-en.hp,total);
    }
    const e=scene('boss_prism');const enemies=[0,1,2].map(i=>target(e.app,i,-2));e.app.fireWeapon(e.w,e.def,e.app.getWeaponCombatStats(e.w),0,0,enemies[0]);
    assert.deepEqual(enemies.map(n=>100000-n.hp),[17,8,5]);
});

test('棱核回收不暴击、不吸血、不复活死目标；分流两束只回收一次',()=>{
    const e=scene('boss_prism','volley'),{app,w}=e,en=target(app);app.stats.lifeSteal=100;app.stats.critChance=100;
    vm.runInContext('Math.random=()=>0',e.context);let heals=0;app.applyLifeSteal=()=>heals++;
    app.fireWeapon(w,e.def,app.getWeaponCombatStats(w),0,0,en);app.updateAdvancedEffects(.6);
    assert.equal(100000-en.hp,Math.round(9*1.75)+Math.round(8*1.75)+8);assert.equal(heals,2);assert.equal(app.advancedEffects.length,0);
    app.clearEntities();const weak=target(app,0,-2.5,1);app.fireWeapon(w,e.def,app.getWeaponCombatStats(w),0,0,weak);app.updateAdvancedEffects(.6);assert.equal(app.totalKills,1);
});

test('闭环仅分摊预算给新目标，单体退化时回收，禁止通用加跳再叠一遍',()=>{
    const e=scene('boss_prism','chain'),{app,w}=e;
    const nodes=[target(app,0,-2),target(app,2,-2),target(app,1,-4)],inside=target(app,1,-2.6);
    // 稳定指定原生路径；内部目标只在闭环阶段成为合法新目标。
    const original=app.bossTargets.bind(app);let calls=0;app.bossTargets=(...args)=>{calls++;return original(...args).filter(n=>n!==inside);};
    app.fireWeapon(w,e.def,app.getWeaponCombatStats(w),0,0,nodes[0]);
    assert.equal(app.totalDmg,30);assert.equal(100000-inside.hp,4);assert.deepEqual(nodes.map(n=>100000-n.hp),[14,7,5]);
    assert.equal(calls,2);
});

test('所有分支与核心的整次预算不重复，全伤害封顶，三级稳定单体增长不超过30%',()=>{
    const e=scene('boss_hammer'),{app}=e;
    for(const id of ['boss_hammer','boss_hive','boss_prism'])for(const core of [null,...Object.keys(app.bossWeaponRules(id).cores)])for(const branch of ['single','area'])for(const crit of [0,100]){
        app.selectedCoreId=core;app.stats.critChance=crit;const w={id,tier:2,rank:0};
        const baseline=app.getBuildDpsCeiling([w],app.stats);w.branch=branch;w.rank=3;
        const final=app.getBuildDpsCeiling([w],app.stats);assert.ok(final<=baseline*1.3+1e-8,`${id}/${core}/${branch}/${crit}: ${final}/${baseline}`);
        app.stats.dmgPct=50;const cap=app.getWeaponCombatStats(w);app.stats.dmgPct=500;assert.deepEqual(app.getWeaponCombatStats(w).budget,cap.budget);app.stats.dmgPct=0;
    }
});

test('无核心、适配及不适配核心的0～3级实际战斗均有限，无残留实体',()=>{
    for(const id of ['boss_hammer','boss_hive','boss_prism'])for(const core of [null,'heavy','star','hive','volley','chain','charge'])for(const branch of ['single','area'])for(const rank of [0,1,2,3]){
        const e=scene(id,core,rank,branch),en=target(e.app);for(let i=0;i<4;i++)target(e.app,i*.5,-3);
        if(id==='boss_hammer')hammer(e,en);else if(id==='boss_hive')beeShot(e,en);else{e.app.fireWeapon(e.w,e.def,e.app.getWeaponCombatStats(e.w),0,0,en);e.app.updateAdvancedEffects(.7);}
        assert.ok(Number.isFinite(e.app.totalDmg));assert.ok(e.app.totalDmg>0);e.app.clearEntities();assert.equal(e.app.advancedEffects.length,0);assert.equal(e.app.entitiesGroup.children.length,0);assert.equal(e.w.resource,0);
    }
});

test('资源开波清零，六秒后衰减，出售重配不保留实体与充能',()=>{
    const e=scene('boss_hive'),{app,w}=e;w.resource=80;app.updateAdvancedEffects(6.5);assert.equal(w.resource,70);
    app.ensureBossHive(w,app.getWeaponCombatStats(w));app.resetBossWeapon(w);assert.equal(w.resource,0);assert.equal(app.advancedEffects.length,0);
    w.resource=80;app.startWave(2);assert.equal(w.resource,0);
});

test('先专武后核心，保留后的三选一含指定共鸣，重开不重抽',()=>{
    const e=scene('grass_blade'),{app}=e;app.pendingCoreChoice=true;app.pendingBossReward={bossId:'prism',weaponId:'boss_prism'};
    app.advancePostWave();assert.equal(app.state,'BOSS_REWARD');app.pickBossReward(6);assert.equal(app.state,'CORE');
    assert.ok(app.coreOffers.some(id=>['chain','volley'].includes(id)));const offers=[...app.coreOffers];app.openCorePhase();assert.deepEqual([...app.coreOffers],offers);
});

test('常驻改装校验费用、实例和旧等级，多专武共享次数，刷新和旧卡不能绕过',()=>{
    const e=scene('boss_hammer'),{app,w}=e;app.addWeapon('boss_prism',2);app.gold=1000;app.wave=5;app.openShopPhase();
    const price=app.bossModificationPrice(w);assert.equal(price,56);app.buyBossModification(-1,0,'single');assert.equal(w.rank,0);
    app.buyBossModification(w.instanceId,1,'single');assert.equal(w.rank,0);app.buyBossModification(w.instanceId,0,'single');assert.equal(w.rank,1);assert.equal(app.gold,1000-price);
    app.generateShopCards();const other=app.weapons[1];app.buyBossModification(other.instanceId,0,'single');assert.equal(other.rank,0);
    app.shopCards=[{kind:'boss_upgrade',id:w.id,instanceId:w.instanceId,rank:1,price:1}];app.buyBossUpgrade(0,'single');assert.equal(w.rank,1);
    app.openShopPhase();app.gold=0;app.buyBossModification(w.instanceId,1,'single');assert.equal(w.rank,1);
});

test('专武详情与改装显示实际路线、共鸣和新机制，基准图鉴不继承本局核心',()=>{
    const e=scene('boss_hammer','star',3,'single'),{app,w}=e;
    assert.match(app.weaponDetailHtml(w),/十字断层/);assert.match(app.weaponDetailHtml(w),/第三击替换为37/);
    assert.doesNotMatch(app.weaponDetailHtml(w,true),/核心共鸣：十字断层/);
    assert.equal(app.coreFits('chain','boss_hive'),false);assert.equal(app.coreFits('hive','boss_hive'),true);
});

test('测试工具保留专武等级与路线，拒绝非法路线、普通武器改装及重复专武',()=>{
    const model=require('../tools/test-model.js'),{context}=scene('boss_hive');
    const data=vm.runInContext('({weapons:WEAPONS_DB,items:ITEMS_DB,characters:CHARACTERS,stats:STAT_META,cores:CORE_RELICS,bosses:BOSSES_DB})',context);
    const base={version:1,character:data.characters[0].id,wave:5,gold:100,seed:11,speed:1,items:[],weapons:[{id:'boss_hive',tier:2,rank:3,branch:'area'}]};
    const result=model.validateConfig(base,data);assert.equal(result.weapons[0].rank,3);assert.equal(result.weapons[0].branch,'area');assert.deepEqual(model.validateConfig(JSON.parse(JSON.stringify(result)),data),result);
    for(const weapons of [[{id:'boss_hive',tier:2,rank:4,branch:'area'}],[{id:'boss_hive',tier:2,rank:1}],[{id:'grass_blade',tier:1,rank:1,branch:'area'}],[base.weapons[0],base.weapons[0]]])assert.throws(()=>model.validateConfig({...base,weapons},data));
});
