const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {setup}=require('../analysis/combat-benchmark.cjs');

function scene(seed=11){
    const e=setup(seed);e.app.weaponOrbitGroup=new e.app.entitiesGroup.constructor();e.app.rewardSeed=seed;e.app.startWave(1);e.app.clearEntities();return e;
}
function enemy(app,x=0,z=-3){
    const group=new app.entitiesGroup.constructor();group.position.set(x,0,z);const en={group,hp:10000,maxHp:10000,radius:.4,speed:0,knockback:group.position.clone()};app.enemies.push(en);return en;
}

test('22把武器均有机制说明、表现方案、有限数值和真实核心资格',()=>{
    const {app,context}=scene(),defs=vm.runInContext('Object.values(WEAPONS_DB)',context);
    assert.ok(defs.length>=22);assert.ok(vm.runInContext('Object.keys(WEAPON_NOTES).length',context)>=22);
    for(const def of defs){const f=app.getWeaponFacts({id:def.id,tier:def.minTier},app.stats,true);
        assert.ok(f.action&&f.visual&&f.rules&&f.cores.length);assert.ok([f.base,f.cadence,f.reach,f.crit].every(Number.isFinite));
        for(const core of f.cores)assert.equal(app.coreFits(core,def.id),true);
    }
});

test('基准图鉴不继承本局核心或修改当前构筑，详情可按当前品质重算',()=>{
    const {app}=scene();app.selectedCoreId='heavy';app.stats.meleeDmg=12;
    const base=app.weaponDetailHtml({id:'grass_blade',tier:1},true),live=app.weaponDetailHtml({id:'grass_blade',tier:1});
    assert.match(base,/伤害：<b>17<\/b>/);assert.notEqual(base,live);assert.equal(app.selectedCoreId,'heavy');assert.equal(app.stats.meleeDmg,12);
    const beam=app.getWeaponFacts({id:'terra_blade',tier:3},app.stats);assert.ok(beam.projectileReach);assert.ok(beam.meleeReach<beam.reach);
    assert.equal(app.getWeaponFacts({id:'frost_lamp',tier:1},app.stats,true).crit,0);
});

test('三针及双针整数分配守恒，小伤害也不白送最低1点',()=>{
    const {context}=scene();for(let n=1;n<=100;n++)for(const count of [2,3]){
        const values=vm.runInContext(`splitWeaponDamage(${n},${count})`,context);
        assert.equal(values.reduce((sum,d)=>sum+d,0),n);assert.ok(Math.max(...values)-Math.min(...values)<=1);
    }
});

test('针筒三针共享总预算，分流六针只增加两份折损后的预算',()=>{
    const {app,context}=scene();app.addWeapon('vampire_knives',2);const w=app.weapons[0],def=vm.runInContext('WEAPONS_DB.vampire_knives',context),en=enemy(app);
    app.fireWeapon(w,def,app.getWeaponCombatStats(w),0,0,en);assert.equal(app.projectiles.length,3);assert.equal(app.projectiles.reduce((sum,p)=>sum+p.dmg,0),17);
    app.projectiles=[];app.selectedCoreId='volley';const st=app.getWeaponCombatStats(w);app.fireWeapon(w,def,st,0,0,en);
    assert.equal(app.projectiles.length,6);assert.equal(app.projectiles.reduce((sum,p)=>sum+p.dmg,0),st.dmg*2);assert.equal(st.cd,.62*1.15);
});

test('随行砂蜂双针共享主伤，分流只使用一份120%总预算',()=>{
    const {app,context}=scene();app.addWeapon('boss_hive',2);const en=enemy(app),w=app.weapons[0],def=vm.runInContext('WEAPONS_DB.boss_hive',context);
    vm.runInContext('Math.random=()=>.99',context);app.fireWeapon(w,def,app.getWeaponCombatStats(w),0,0,en);
    for(let i=0;i<20;i++)app.updateAdvancedEffects(.02);
    assert.equal(10000-en.hp,12);assert.equal(w.resource,20);assert.equal(app.advancedEffects[0].kind,'boss_bees');
    app.clearAdvancedEffects();en.hp=10000;app.selectedCoreId='volley';const st=app.getWeaponCombatStats(w);en.radius=2;
    app.fireWeapon(w,def,st,0,0,en);for(let i=0;i<20;i++)app.updateAdvancedEffects(.02);
    assert.equal(10000-en.hp,14);assert.equal(w.resource,20);assert.equal(st.cd,.75*1.15);
});

test('导弧飞轮首次有效命中只分弧一次，不暴击、不吸血、不再连锁',()=>{
    const {app,context}=scene();app.addWeapon('light_disc');app.selectedCoreId='chain';const w=app.weapons[0],def=vm.runInContext('WEAPONS_DB.light_disc',context);
    const a=enemy(app,0,-3),b=enemy(app,1,-3),c=enemy(app,2,-3);const st=app.getWeaponCombatStats(w);
    app.fireWeapon(w,def,st,0,0,a);const attack=app.projectiles[0].attack;let heals=0;app.stats.lifeSteal=100;app.applyLifeSteal=()=>heals++;
    app.hitTarget(a,st.dmg,0,0,0,{attack});assert.equal(10000-b.hp,Math.round(st.dmg*.3));assert.equal(c.hp,10000);assert.equal(heals,1);
    app.hitTarget(a,st.dmg,0,0,0,{attack});assert.equal(10000-b.hp,Math.round(st.dmg*.3));assert.equal(attack.arcTriggered,true);assert.equal(heals,2);
});

test('独立特效不消耗战斗随机数、不产生伤害或弹丸，容量和生命周期受限',()=>{
    const one=scene(29),two=scene(29);const {app}=one;const en=enemy(app);
    for(let i=0;i<140;i++)app.weaponVfx(i%2?'arc':'pulse',0,0,4,-3,0xffffff,1);
    assert.equal(app.weaponVfxList.length,18);assert.equal(en.hp,10000);assert.equal(app.projectiles.length,0);
    assert.equal(vm.runInContext('Math.random()',one.context),vm.runInContext('Math.random()',two.context));
    app.updateWeaponVfx(1);assert.equal(app.weaponVfxList.length,0);
});

test('蓄力拥有持续瞄准网格，释放后自动回收，清场不留下悬挂模型',()=>{
    const {app,context}=scene();app.addWeapon('rail_charge');const w=app.weapons[0],def=vm.runInContext('WEAPONS_DB.rail_charge',context),en=enemy(app);
    app.fireWeapon(w,def,app.getWeaponCombatStats(w),0,0,en);const charge=app.advancedEffects[0];assert.ok(charge.mesh&&charge.rail);
    app.updateAdvancedEffects(.7);assert.equal(w.charging,true);assert.ok(charge.mesh.children[1].material.opacity>.5);
    app.updateAdvancedEffects(.8);assert.equal(w.charging,false);assert.equal(app.advancedEffects.length,0);assert.equal(app.projectiles.length,1);
    app.clearEntities();assert.equal(app.projectiles.length,0);assert.equal(app.weaponVfxList.length,0);assert.equal(app.entitiesGroup.children.length,0);
});

test('各弹道使用对应模型和拖尾，不改变射程预算',()=>{
    const {app,context}=scene();const en=enemy(app);
    for(const [id,style] of [['bow','arrow'],['minishark','bolt'],['water_bolt','wave'],['light_disc','disc'],['zenith','cutter'],['vampire_knives','needle']]){
        app.projectiles=[];const def=vm.runInContext(`WEAPONS_DB.${id}`,context);app.addWeapon(id,def.minTier);const w=app.weapons.at(-1),st=app.getWeaponCombatStats(w);app.fireWeapon(w,def,st,0,0,en);
        assert.equal(app.projectiles[0].style,style);assert.equal(app.projectiles[0].distanceBudget,st.range);
    }
    app.updateProjectiles(.08);assert.ok(app.weaponVfxList.some(e=>e.kind==='trail'));
});

test('图鉴打开暂停主循环、关闭恢复原状态，菜单中关闭不会进入战斗',()=>{
    const {app,context}=scene();const nodes=new Map();context.document.getElementById=id=>{if(!nodes.has(id))nodes.set(id,{classList:{add(){},remove(){}},style:{}});return nodes.get(id);};
    context.requestAnimationFrame=()=>{};app.renderer={render(){}};app.lastTime=0;
    app.weaponVfx('pulse',0,0);const e=app.weaponVfxList[0];app.openWeaponGuide();assert.equal(app.state,'GUIDE');assert.match(nodes.get('weapon-guide-cards').innerHTML,/分束棱核/);
    app.loop(1000);assert.equal(e.age,0);app.closeWeaponGuide();assert.equal(app.state,'WAVE');
    app.state='MENU';app.openWeaponGuide();app.closeWeaponGuide();assert.equal(app.state,'MENU');
});
