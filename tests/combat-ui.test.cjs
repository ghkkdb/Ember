const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {setup}=require('../analysis/combat-benchmark.cjs');

function scene(ids=['minishark']) {
    const e=setup(29),a=e.app;a.weaponOrbitGroup=new a.entitiesGroup.constructor();a.startWave(1);a.clearEntities();
    for(const id of ids)a.addWeapon(id,1);return e;
}

function enemy(a,hp=100,x=0) {
    const group=new a.entitiesGroup.constructor();group.position.set(x,0,-3);
    const en={hp,maxHp:hp,radius:.4,group,knockback:group.position.clone(),color:0x22c55e,speed:0,goldValue:0};
    a.enemies.push(en);a.entitiesGroup.add(group);return en;
}

function attack(w) { return {weaponId:w.id,weaponInstanceId:w.instanceId}; }

test('同名武器逐槽统计直击、追加与持续伤害，过量伤害不计入，零输出槽仍显示',()=>{
    const {app:a}=scene(['minishark','minishark','bow']),en=enemy(a),[one,two]=a.weapons;
    a.hitTarget(en,30,0,0,0,{attack:attack(one)});
    a.hitTarget(en,15,0,0,0,{attack:attack(two),isDot:true});
    a.hitTarget(en,10,0,0,0,{attack:attack(two),secondary:true});
    a.hitTarget(en,7,0,0,0);a.hitTarget(enemy(a,9),1000,0,0,0,{attack:attack(one)});
    const rows=a.getWaveWeaponRows();
    assert.deepEqual(rows.filter(r=>r.slot).map(r=>r.totalDmg),[39,25,0]);
    assert.equal(rows[1].dotDmg,15);assert.equal(rows[1].derivativeDmg,10);
    assert.equal(rows.reduce((sum,r)=>sum+r.totalDmg,0),a.totalDmg);
    a.recordWaveResult('cleared');const result=a.runHistory.at(-1);
    assert.match(a.weaponRoundDamageHtml(one,result),/本轮伤害：39/);assert.match(a.weaponRoundDamageHtml(two,result),/本轮伤害：25/);assert.match(a.weaponRoundDamageHtml(a.weapons[2],result),/本轮伤害：0/);
    a.startWave(2);assert.equal(result.weaponRows[0].totalDmg,39);assert.equal(Object.keys(a.currentWaveWeaponInstanceStats).length,0);
});

test('回合结束直接领取奖励，自动拾取与结算只执行一次',()=>{
    const {app:a,context}=scene(),proto=vm.runInContext('TerraBrotatoApp.prototype',context);
    a.endWave=proto.endWave;a.openCratePhase=function(){this.state='CRATE';this.crateOpened=(this.crateOpened||0)+1;};
    a.waveTimer=0;a.pendingCrates=1;a.pendingLevelUps=1;a.spawnPickup('coin',19,19,3);
    a.endWave();assert.equal(a.state,'CRATE');assert.equal(a.gold,3);assert.equal(a.runHistory.length,1);
    a.endWave();assert.equal(a.gold,3);assert.equal(a.state,'CRATE');assert.equal(a.crateOpened,1);
});

test('实例归属与未标记实例的同名伤害混合时，战报分配仍与总伤害守恒',()=>{
    const {app:a}=scene(['minishark','minishark']),en=enemy(a);
    a.hitTarget(en,20,0,0,0,{attack:attack(a.weapons[0])});
    a.hitTarget(en,7,0,0,0,{weaponId:'minishark'});
    const rows=a.getWaveWeaponRows();assert.equal(rows[0].totalDmg,20);assert.equal(rows[1].totalDmg,7);
    assert.equal(rows.reduce((sum,r)=>sum+r.totalDmg,0),27);assert.equal(rows[1].primaryDmg,7);
});

test('无伤害战报和旧存档按名称汇总均可显示，无NaN或无穷值',()=>{
    const {app:a}=scene(['bow','bow']);
    const empty=a.weaponRoundDamageHtml(a.weapons[0],{weaponRows:a.getWaveWeaponRows()});
    assert.match(empty,/本轮伤害：0/);assert.doesNotMatch(empty,/NaN|Infinity/);
    const old=a.weaponRoundDamageHtml(a.weapons[0],{weaponStats:{bow:{totalDmg:80,primaryDmg:80}}});
    assert.match(old,/本轮伤害：80/);assert.doesNotMatch(old,/占比|每秒|直击|追加/);
});

test('一帧击杀50只小怪只生成有限反馈，普通暴击不叠加点光或镜头震动',()=>{
    const {app:a,context}=scene(),w=a.weapons[0];let floats=0;
    a.spawnFloatText=()=>floats++;context.hitSounds=0;vm.runInContext('sfx.playHit=()=>hitSounds++',context);
    for(let i=0;i<50;i++)a.hitTarget(enemy(a,10,i/5),100,100,0,0,{attack:attack(w)});
    assert.equal(a.totalKills,50);assert.equal(a.totalDmg,500);assert.equal(a.enemies.length,0);
    assert.equal(floats,3);assert.equal(context.hitSounds,3);assert.equal(a.cameraShake||0,0);
    assert.ok(a.particles.length<=24);assert.ok(a.weaponVfxList.length<=6);assert.equal(a.combatDisposals.length+a.deathEffects.length,50);assert.equal(a.deathEffects.length,3);
    a.flushCombatDisposals(4);assert.equal(a.combatDisposals.length,43);
    a.clearEntities();assert.equal(a.combatDisposals.length,0);assert.equal(a.entitiesGroup.children.length,0);
});

test('手机密集命中反馈进一步限额，粒子复用网格且不改共享材质透明度',()=>{
    const {app:a,context}=scene();context.window.innerWidth=390;
    a.spawnBurstParticles(0,0,0x22c55e,50,'dissolve');assert.equal(a.particles.length,12);
    const meshes=a.particles.map(p=>p.mesh),opacities=a.particles.map(p=>p.mesh.material.opacity);
    a.updatePickupsAndFX(.7);assert.equal(a.particles.length,0);assert.equal(a.particlePool.length,12);
    assert.deepEqual(meshes.map(m=>m.material.opacity),opacities);
    context.performance.now=()=>100;a.spawnBurstParticles(0,0,0x22c55e,12,'dissolve');
    assert.ok(a.particles.every(p=>meshes.includes(p.mesh)));assert.equal(a.particlePool.length,0);
});

test('特效达到容量后跳过新建，不在密集释放中逐个销毁与重建',()=>{
    const {app:a,context}=scene();let disposed=0;a.disposeCombatMesh=()=>disposed++;
    for(let tick=0;tick<8;tick++){context.performance.now=()=>tick*100;for(let i=0;i<30;i++)a.weaponVfx('impact',0,0,0,0,0x22c55e,.3);}
    assert.equal(a.weaponVfxList.length,56);assert.equal(disposed,0);
    a.updateWeaponVfx(1);assert.equal(disposed,56);assert.equal(a.weaponVfxList.length,0);
});

test('强震采用最大值而非累加，点光120毫秒内最多一次且强度受限',()=>{
    const {app:a,context}=scene();
    for(let i=0;i<50;i++)a.triggerCameraShake(.1);assert.equal(a.cameraShake,.1);
    a.triggerCameraShake(2);assert.equal(a.cameraShake,.18);context.window.innerWidth=390;a.triggerCameraShake(2);assert.equal(a.cameraShake,.1);
    let changes=0;a.dynamicLights=[{age:1,duration:0,light:{color:{setHex(){changes++;}},position:a.playerPos.clone()}}];
    for(let i=0;i<20;i++)a.triggerDynamicLight(0,1,0,0xffffff,8,.1);
    assert.equal(changes,1);assert.equal(a.dynamicLights[0].maxIntensity,1.2);
});

test('HUD武器详情可暂停与返回，展示当前参数和该实例本轮伤害',()=>{
    const {app:a,context}=scene();const elements=new Map();
    context.document.getElementById=id=>{if(!elements.has(id))elements.set(id,{classList:{add(){},remove(){}},focus(){}});return elements.get(id);};
    a.hitTarget(enemy(a),20,0,0,0,{attack:attack(a.weapons[0])});a.openWeaponDetail(0);
    assert.equal(a.state,'WEAPON_DETAIL');assert.match(elements.get('weapon-detail-content').innerHTML,/本轮伤害：20/);
    assert.match(elements.get('weapon-detail-content').innerHTML,/间隔：/);assert.match(elements.get('weapon-detail-content').innerHTML,/weapon-stats/);
    a.closeWeaponDetail();assert.equal(a.state,'WAVE');a.state='PAUSED';a.openWeaponDetail(0);a.closeWeaponDetail();assert.equal(a.state,'PAUSED');
});
