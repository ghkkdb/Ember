const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {setup}=require('../analysis/combat-benchmark.cjs');

function scene(id='etch_nozzle',core=null){
    const e=setup(11),{app,context}=e;app.weaponOrbitGroup=new app.entitiesGroup.constructor();app.startWave(1);app.clearEntities();app.selectedCoreId=core;app.addWeapon(id,1);app.stats.critChance=-100;
    vm.runInContext('Math.random=()=>.99',context);const w=app.weapons[0],def=vm.runInContext(`WEAPONS_DB.${id}`,context);return {...e,w,def};
}
function target(app,x=0,z=-2,hp=10000){
    const group=new app.entitiesGroup.constructor();group.position.set(x,0,z);const en={group,hp,maxHp:hp,speed:0,radius:.4,knockback:group.position.clone(),goldValue:0};app.enemies.push(en);return en;
}
function item(e,id,count=1){const def=vm.runInContext(`ITEMS_DB.find(i=>i.id==='${id}')`,e.context);for(let i=0;i<count;i++)e.app.ownedItems.push(def);}
function shoot(e,en){e.app.fireWeapon(e.w,e.def,e.app.getWeaponCombatStats(e.w),0,0,en);}
function nodes(e){
    const map=new Map();e.context.document.getElementById=id=>{if(!map.has(id))map.set(id,{classList:{add(){},remove(){}},style:{},value:'',innerHTML:''});return map.get(id);};return map;
}

test('蚀刻喷口直伤8及四跳共8，持续段不暴击吸血、不递归',()=>{
    const e=scene(),{app}=e,en=target(app);app.stats.lifeSteal=100;vm.runInContext('Math.random=()=>0',e.context);let heals=0;app.applyLifeSteal=()=>heals++;
    shoot(e,en);assert.equal(10000-en.hp,8);assert.equal(app.damageOverTime.length,1);assert.equal(heals,1);
    app.updateAdvancedEffects(.49);assert.equal(10000-en.hp,8);app.updateAdvancedEffects(1.51);assert.equal(10000-en.hp,16);assert.equal(heals,1);assert.equal(app.damageOverTime.length,0);
});

test('同源附着刷新仅替换剩余预算；不同来源数量、销售与死亡清理受限',()=>{
    const e=scene(),{app,w}=e,en=target(app);shoot(e,en);app.updateAdvancedEffects(.5);assert.equal(10000-en.hp,10);
    shoot(e,en);assert.equal(app.damageOverTime.length,1);app.updateAdvancedEffects(2);assert.equal(10000-en.hp,26);
    for(let i=0;i<5;i++){app.addWeapon('etch_nozzle');const source=app.weapons.at(-1);app.applyDamageOverTime(en,source,8,2,{});}
    assert.equal(app.damageOverTime.length,4);app.resetBossWeapon(app.weapons[1]);assert.equal(app.damageOverTime.length,3);
    app.hitTarget(en,100000,0,0,0);app.updateAdvancedEffects(.01);assert.equal(app.damageOverTime.length,0);assert.equal(app.totalKills,1);
    app.applyDamageOverTime({...en,hp:100,isProp:true},w,8,2,{});assert.equal(app.damageOverTime.length,0);
});

test('附着全场120条硬上限、低预算分段守恒，清场不留下蚀环',()=>{
    const e=scene(),{app,w}=e;
    for(let i=0;i<130;i++)app.applyDamageOverTime(target(app,i,0),w,1,2,{});
    assert.equal(app.damageOverTime.length,120);const before=app.totalDmg;app.updateAdvancedEffects(2);assert.equal(app.totalDmg-before,120);
    app.clearEntities();assert.equal(app.damageOverTime.length,0);assert.equal(app.entitiesGroup.children.length,0);
});

test('熵蚀和长燃芯只调整对应预算及持续时间，属性整次只计算一次',()=>{
    const e=scene('etch_nozzle','entropy'),{app,w}=e;item(e,'long_burn',2);
    const p=app.getMechanismProfile(w,app.getWeaponCombatStats(w));assert.equal(p.direct,6);assert.equal(p.dot,12);assert.equal(p.duration,3.25);
    app.stats.magicDmg=10;app.stats.dmgPct=50;const st=app.getWeaponCombatStats(w);assert.equal(st.dmg,Math.round((16+10*.7)*1.5));
    app.stats.dmgPct=500;assert.equal(app.getWeaponCombatStats(w).dmg,st.dmg);
    const en=target(app);shoot(e,en);app.updateAdvancedEffects(3.25);const profile=app.getMechanismProfile(w,app.getWeaponCombatStats(w));assert.equal(10000-en.hp,profile.direct+profile.dot);
});

test('喷口最多三个锥内目标，不附着场景道具或锥后敌人',()=>{
    const e=scene(),{app}=e,front=Array.from({length:5},(_,i)=>target(app,(i-2)*.15,-2)),back=target(app,0,2);
    shoot(e,front[0]);assert.equal(front.filter(n=>n.hp<10000).length,3);assert.equal(back.hp,10000);assert.equal(app.damageOverTime.length,3);
});

test('陷阱布防前不爆，触发后各目标一次，过期和替换不免费引爆',()=>{
    const e=scene('mine_case'),{app}=e,en=target(app);shoot(e,en);app.updateAdvancedEffects(.29);assert.equal(en.hp,10000);
    app.updateAdvancedEffects(.01);assert.equal(10000-en.hp,24);assert.equal(app.advancedEffects.length,0);app.updateAdvancedEffects(1);assert.equal(10000-en.hp,24);
    en.group.position.z=-4;for(let i=0;i<3;i++)shoot(e,en);assert.equal(app.advancedEffects.filter(n=>n.kind==='mine'&&!n.expired).length,2);
    en.group.position.z=15;app.updateAdvancedEffects(6);assert.equal(10000-en.hp,24);assert.equal(app.advancedEffects.length,0);
});

test('滞爆与引线扩大实际爆区且延长布防，不增加伤害或索敌范围',()=>{
    const e=scene('mine_case','star'),{app,w}=e;item(e,'blast_fuse',2);const st=app.getWeaponCombatStats(w),p=app.getMechanismProfile(w,st);
    assert.equal(p.damage,22);assert.equal(p.arm,.7);assert.ok(Math.abs(p.radius-3.348)<1e-8);assert.equal(st.range,8*.7);
    const center=target(app),edge=target(app,3,-2);shoot(e,center);app.updateAdvancedEffects(.69);assert.equal(edge.hp,10000);app.updateAdvancedEffects(.02);assert.equal(10000-edge.hp,22);
});

test('霜凝每目标0.4秒一层，三层碎裂不吸血且共享2秒冷却',()=>{
    const e=scene('frost_lamp','frost'),{app}=e,en=target(app);const st={frostBase:12,attack:{weaponId:'frost_lamp',weaponInstanceId:e.w.instanceId}};
    let heals=0;app.stats.lifeSteal=100;app.applyLifeSteal=()=>heals++;
    app.applyFrostMark(en,st,0);app.applyFrostMark(en,st,.1);assert.equal(app.frostMarks.get(en).stacks,1);
    app.applyFrostMark(en,st,.4);app.applyFrostMark(en,st,.8);assert.equal(10000-en.hp,6);assert.equal(heals,0);
    app.applyFrostMark(en,st,1.3);assert.equal(app.frostMarks.get(en).stacks,0);app.applyFrostMark(en,st,2.8);assert.equal(app.frostMarks.get(en).stacks,1);
});

test('霜雾霜凝实际跳伤共10，寒凝套拉长四跳不增加总量，Boss减速仍最多15%',()=>{
    const e=scene('frost_lamp','frost'),{app}=e,en=target(app);en.isBoss=true;item(e,'cold_sleeve',2);
    shoot(e,en);const field=app.advancedEffects[0];assert.equal(field.chunks.reduce((a,b)=>a+b,0),10);assert.equal(field.interval,.4);
    app.updateAdvancedEffects(1.59);assert.equal(field.ticks,3);assert.equal(en.slowRatio,.85);app.updateAdvancedEffects(.02);assert.equal(10000-en.hp,16);assert.equal(app.advancedEffects.length,0);
});

test('霜雾原生四跳只记录一次释放命中，面板暴击为0且跳伤不吸血',()=>{
    const e=scene('frost_lamp'),{app}=e,en=target(app);app.stats.lifeSteal=100;app.stats.critChance=100;vm.runInContext('Math.random=()=>0',e.context);
    let heals=0;app.applyLifeSteal=()=>heals++;assert.equal(app.getWeaponCombatStats(e.w).crit,0);shoot(e,en);app.updateAdvancedEffects(1.21);
    assert.equal(app.waveMetrics.attacks,1);assert.equal(app.waveMetrics.landedAttacks,1);assert.equal(heals,0);
});

test('绝缘栅、识别天线、稳压框真实影响普通武器与专武，不改角色16基础属性',()=>{
    for(const id of ['pulse_chain','boss_prism']){
        const e=scene(id),before=e.app.getWeaponCombatStats(e.w);item(e,'insulator',2);const after=e.app.getWeaponCombatStats(e.w);assert.ok(after.dmg<=before.dmg);assert.equal(after.jumpScale,1.3);
    }
    for(const id of ['sentry','boss_hive']){
        const e=scene(id),before=e.app.getWeaponCombatStats(e.w);item(e,'target_antenna');const after=e.app.getWeaponCombatStats(e.w);assert.equal(after.range,before.range*1.1);assert.equal(after.preferWoundedElite,true);
    }
    for(const id of ['rail_charge','boss_hammer']){
        const e=scene(id),before=e.app.getWeaponCombatStats(e.w);item(e,'voltage_frame',2);const after=e.app.getWeaponCombatStats(e.w);assert.ok(after.dmg<=before.dmg);assert.equal(after.chargeReduction,.3);
        const en=target(e.app);shoot(e,en);const charge=e.app.advancedEffects.find(n=>n.kind==='charge');assert.ok(charge.delay>=.35);assert.ok(charge.delay<(id==='rail_charge'?1.4:.65));
    }
});

test('绝缘栅的代价仅扣主目标，不重复降低已有连锁跳伤',()=>{
    const e=scene('pulse_chain'),{app}=e;item(e,'insulator',2);const enemies=[0,1,2].map(i=>target(app,i,-2));shoot(e,enemies[0]);
    assert.deepEqual(enemies.map(n=>10000-n.hp),[9,6,3]);assert.match(app.weaponDetailHtml(e.w),/9 → 6 → 3/);
});

test('新条目进入真实商店池和核心候选；初始池不提前开放',()=>{
    const e=scene(),{app,context}=e;
    assert.equal(vm.runInContext("isWeaponAvailable('etch_nozzle',1)",context),false);assert.equal(vm.runInContext("isWeaponAvailable('mine_case',3)",context),true);
    app.pendingCoreChoice=true;app.openCorePhase();assert.ok(app.coreOffers.includes('entropy'));app.state='WAVE';app.selectedCoreId=null;app.coreOffers=null;app.weapons=[];app.addWeapon('mine_case');app.openCorePhase();assert.ok(app.coreOffers.includes('star'));
    assert.equal(app.coreFits('entropy','etch_nozzle'),true);assert.equal(app.coreFits('frost','frost_lamp'),true);assert.equal(app.coreFits('frost','boss_prism'),false);
});

test('八类小怪图鉴与真实生成逐项同源，蓝色变体不虚构技能',()=>{
    const e=scene(),{app,context}=e;const ids=vm.runInContext('Object.keys(ENEMIES_DB)',context);assert.equal(ids.length,8);
    for(const wave of [1,5,20,50])for(const difficulty of [1,3,5])for(const id of ids){
        app.wave=wave;app.difficulty=difficulty;const expected=vm.runInContext(`getEnemyEncounterStats('${id}',${wave},${difficulty})`,context);app.spawnEnemyNow(id,0,0);const actual=app.enemies.at(-1);
        for(const key of ['hp','dmg','speed','radius','behavior','color'])assert.equal(actual[key],expected[key],`${id}/${key}`);
    }
    const map=nodes(e);app.openContentGuide('enemies');app.setGuideSearch('蓝');assert.match(map.get('weapon-guide-cards').innerHTML,/不额外施加冰冻/);
});

test('Boss图鉴生命、接触与技能数值来自实战规则，不按Boss种类重复加血',()=>{
    const e=scene(),{app}=e;for(const wave of [5,10,20,30])for(const difficulty of [1,5])for(const id of ['forge','weaver','prism']){
        app.wave=wave;app.difficulty=difficulty;app.clearEntities();const f=app.getBossFacts(id,wave,difficulty);app.spawnBoss(id);const boss=app.activeBoss;
        assert.equal(f.hp,boss.maxHp);assert.equal(f.contactDamage,4);assert.equal(f.skills.length,3);assert.equal(f.warning,1);assert.equal(f.recovery,1.3);
        if(id==='prism')assert.equal(f.skills[1].damage,8);if(id==='weaver')assert.equal(f.skills[1].damage,null);
    }
    assert.equal(app.getBossFacts('forge',6,1).encounterWave,10);assert.equal(app.getBossFacts('forge',6,1).hp,6000);
});

test('道具图鉴覆盖全部26条目、等级上限、配件对象和当前波次价格',()=>{
    const e=scene(),{app,context}=e;const defs=vm.runInContext('ITEMS_DB',context);assert.ok(defs.length>=26);
    for(const def of defs){const f=app.getItemFacts(def,8);assert.ok(f.name&&f.desc&&f.limit>0&&f.price>0&&f.unlock>=1);if(def.targets)assert.ok(f.targets.length>0);}
    const map=nodes(e);app.openContentGuide('items');assert.match(map.get('weapon-guide-cards').innerHTML,/稳压框/);app.setGuideSearch('绝缘');assert.match(map.get('content-guide-count').textContent,/1 \/ (?:26|50)/);assert.match(map.get('weapon-guide-cards').innerHTML,/分束棱核/);
});

test('切换四种图鉴只暂停一次，搜索与波次预览不修改本局或消耗随机数',()=>{
    const e=scene(),{app,context}=e,map=nodes(e),en=target(app);shoot(e,en);const before={wave:app.wave,difficulty:app.difficulty,seed:app.rewardSeed,hp:en.hp,next:app.damageOverTime[0].next};
    app.renderer={render(){}};context.requestAnimationFrame=()=>{};app.lastTime=0;
    app.openContentGuide('items');assert.equal(app.state,'GUIDE');app.openContentGuide('bosses');app.setGuidePreview(50,5);app.loop(1000);app.openContentGuide('enemies');app.setGuideSearch('<script>');assert.match(map.get('weapon-guide-cards').innerHTML,/没有匹配/);assert.doesNotMatch(map.get('weapon-guide-cards').innerHTML,/<script>/);
    assert.equal(app.wave,before.wave);assert.equal(app.difficulty,before.difficulty);assert.equal(app.rewardSeed,before.seed);assert.equal(en.hp,before.hp);assert.equal(app.damageOverTime[0].next,before.next);
    app.closeWeaponGuide();assert.equal(app.state,'WAVE');app.openContentGuide('weapons');assert.equal(app.guideSearch,'');app.closeWeaponGuide();
    app.state='SHOP';app.openContentGuide('enemies');app.closeWeaponGuide();assert.equal(app.state,'SHOP');app.state='MENU';app.openContentGuide('items');app.closeWeaponGuide();assert.equal(app.state,'MENU');
});

test('新图鉴与现有武器详情展示实际机制和核心变体，非法分类不改变状态',()=>{
    const e=scene(),{app}=e;const map=nodes(e);app.openContentGuide('bad');assert.equal(app.state,'WAVE');
    app.openWeaponGuide();assert.match(map.get('weapon-guide-cards').innerHTML,/蚀刻喷口/);assert.match(map.get('weapon-guide-cards').innerHTML,/伏雷匣/);assert.match(app.weaponDetailHtml(e.w),/附着总伤8/);
    app.setGuidePreview(Infinity,99);assert.equal(app.guideWave,200);assert.equal(app.guideDifficulty,5);assert.match(map.get('content-guide-tabs').innerHTML,/Boss图鉴 \([36]\)/);
});
