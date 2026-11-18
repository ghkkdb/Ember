const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {setup}=require('../analysis/combat-benchmark.cjs');

function scene(ids=[]) {
    const e=setup(29),a=e.app;a.weaponOrbitGroup=new a.entitiesGroup.constructor();a.startWave(1);a.clearEntities();
    for(const id of ids)a.addWeapon(id,1);return e;
}

function item(e,id) { return vm.runInContext(`ITEMS_DB.find(i=>i.id===${JSON.stringify(id)})`,e.context); }

test('饰品按机制和武器属性标出当前适配实例，辅助配件与暂无适配区分显示',()=>{
    const e=scene(['grass_blade','bow','frost_lamp','frost_lamp']),a=e.app;
    assert.equal(a.getItemAffinity(item(e,'cold_sleeve')).rows.length,2);
    assert.equal(a.getItemAffinity(item(e,'ranger_emb')).rows.length,2);
    assert.equal(a.getItemAffinity(item(e,'claws')).rows.length,4);
    assert.match(a.itemAffinityHtml(item(e,'cold_sleeve')),/凝霜雾灯/);
    assert.match(a.itemAffinityHtml(item(e,'insulator')),/当前暂无适配武器/);
    assert.match(a.itemAffinityHtml(item(e,'shackle')),/通用辅助/);
    assert.match(a.itemAffinityHtml(item(e,'crit_converter')),/暂无武器暴击溢出|无武器暴击溢出/);
    a.stats.critChance=110;assert.equal(a.getItemAffinity(item(e,'crit_converter')).rows.length,2);
});

test('普通属性与专武机制适配均覆盖，预览不改变道具、属性和战斗随机序列',()=>{
    const e=scene(['boss_prism','boss_train','boss_hive']),a=e.app;
    assert.equal(a.getItemAffinity(item(e,'insulator')).rows[0].id,'boss_prism');
    assert.equal(a.getItemAffinity(item(e,'traction_joint')).rows[0].id,'boss_train');
    assert.equal(a.getItemAffinity(item(e,'target_antenna')).rows[0].id,'boss_hive');
    const before=JSON.stringify({stats:a.stats,items:a.ownedItems});
    vm.runInContext('Math.random=()=>{throw Error("适配预览不应消耗随机数")}',e.context);
    assert.doesNotThrow(()=>a.getItemAffinity(item(e,'crit_converter')));
    assert.equal(JSON.stringify({stats:a.stats,items:a.ownedItems}),before);
});

test('相机高度影响初始化、跟随与正交可见范围，四档设置可读档且异常值回退',()=>{
    const {app:a,context}=scene();context.window.innerWidth=844;context.window.innerHeight=390;
    const camera=()=>({position:a.playerPos.clone(),lookAt(){},updateProjectionMatrix(){}});
    a.orthoCam=camera();a.perspCam=camera();a.career={settings:{cameraHeight:48}};a.camMode='tilt';a.applyCameraMode();
    assert.equal(a.camera.position.y,48);assert.ok(Math.abs(a.camera.position.z-28.2)<1e-9);
    a.updateCameraFollow=vm.runInContext('TerraBrotatoApp.prototype.updateCameraFollow',context);a.playerPos.x=10;a.updateCameraFollow(.1);assert.equal(a.camera.position.y,48);
    a.camMode='ortho';a.applyCameraMode();assert.ok(Math.abs(a.orthoCam.top-17.2*1.2)<1e-9);
    let raw=null;context.localStorage={getItem:key=>key==='ember-career'?raw:null};
    for(const height of [32,40,48,56,99]){raw=JSON.stringify({settings:{cameraHeight:height}});assert.equal(vm.runInContext('EmberStorage.getCareer().settings.cameraHeight',context),height===99?40:height);}
});

test('第5波参数保留，后续Boss血量、伤害、移速及进攻频率持续提升且保留可躲预警',()=>{
    const {context}=scene();const rows=vm.runInContext('[5,10,15,20,25,30,50].map(w=>getBossEncounterStats(w,1))',context);
    assert.deepEqual(Array.from(rows.slice(0,5),r=>r.hp),[1500,7800,16800,28500,37050]);
    assert.equal(rows[0].skillDamage,14);assert.equal(rows[0].warning,1);
    for(let i=1;i<rows.length;i++){assert.ok(rows[i].hp>rows[i-1].hp);assert.ok(rows[i].skillDamage>rows[i-1].skillDamage);assert.ok(rows[i].speed>=rows[i-1].speed);assert.ok(rows[i].chase<rows[i-1].chase||rows[i].chase===1.4);assert.ok(rows[i].warning>=.72);}
    assert.equal(vm.runInContext('getBossEncounterStats(10,3).hp',context),12090);
});

test('后期Boss实际预警、命中和恢复阶段使用该波参数，图鉴与实战保持一致',()=>{
    const {app:a}=scene();a.wave=20;a.difficulty=1;a.spawnBoss('forge');const boss=a.activeBoss;
    boss.group.position.set(0,0,0);a.playerPos.set(0,0,3);boss.ai.skill=2;
    a.beginOriginalBossWarning(boss);assert.equal(boss.ai.remaining,boss.encounter.warning);
    boss.ai.shapes=[{x:0,z:0,ex:0,ez:6,r:2}];let hit=0;a.damagePlayer=n=>hit=n;
    a.executeOriginalBossSkill(boss);assert.equal(hit,boss.encounter.skillDamage);
    boss.ai.phase='warn';boss.ai.remaining=.01;a.updateOriginalBoss(boss,.01);assert.equal(boss.ai.phase,'recover');assert.equal(boss.ai.remaining,boss.encounter.recovery);
});

test('击杀反馈保留短暂倒地、独立爆裂与音效，动画到期进入分帧释放且不补伤害',()=>{
    const {app:a,context}=scene(['bow']);const group=new a.entitiesGroup.constructor();group.position.set(1,0,-3);a.entitiesGroup.add(group);
    const en={group,hp:10,maxHp:10,radius:.4,speed:0,color:0x22c55e,knockback:group.position.clone(),goldValue:0};a.enemies.push(en);
    context.killSounds=0;vm.runInContext('sfx.playKill=()=>killSounds++',context);
    a.hitTarget(en,100,0,1,0,{attack:{weaponId:'bow',weaponInstanceId:a.weapons[0].instanceId}});
    assert.equal(a.deathEffects.length,1);assert.equal(a.enemies.length,0);assert.equal(context.killSounds,1);assert.ok(a.weaponVfxList.some(e=>e.kind==='kill'));
    a.updateDeathEffects(.09);assert.ok(group.scale.y<.72);assert.ok(group.position.x>1);a.updateDeathEffects(.1);
    assert.equal(a.deathEffects.length,0);assert.equal(a.combatDisposals.length,1);assert.equal(a.totalDmg,10);assert.equal(a.totalKills,1);
});

test('紧凑信息无独立参数框与战报弹窗，伤害只在对应实例的武器槽下显示',()=>{
    const {app:a}=scene(['bow','bow']);a.runHistory=[{weaponRows:[{instanceId:a.weapons[0].instanceId,totalDmg:123},{instanceId:a.weapons[1].instanceId,totalDmg:456}]}];
    assert.match(a.weaponRoundDamageHtml(a.weapons[0]),/本轮伤害：123/);assert.match(a.weaponRoundDamageHtml(a.weapons[1]),/本轮伤害：456/);
    const stats=a.weaponMetricsHtml(a.getWeaponFacts(a.weapons[0]));assert.match(stats,/间隔：/);assert.doesNotMatch(stats,/weapon-metrics|<div|border|grid/);
    const html=fs.readFileSync(path.join(__dirname,'..','terrabrotato.html'),'utf8');assert.doesNotMatch(html,/id="screen-wave-report"|id="shop-weapon-report"/);
    assert.match(html,/手机推荐横屏游戏/);assert.match(html,/id="setting-camera-height"/);assert.match(html,/id="pause-camera-height"/);
});
