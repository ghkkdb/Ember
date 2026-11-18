const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { setup } = require('../analysis/combat-benchmark.cjs');

function scene(id) {
    const e=setup(29),a=e.app;a.weaponOrbitGroup=new a.entitiesGroup.constructor();a.startWave(1);a.clearEntities();
    if(id)a.addWeapon(id,1);return e;
}

function target(a,x,z,hp=10000) {
    const group=new a.entitiesGroup.constructor();group.position.set(x,0,z);
    const enemy={group,hp,maxHp:hp,radius:.1,speed:0,knockback:group.position.clone(),goldValue:0};
    a.enemies.push(enemy);return enemy;
}

test('全部武器在基础、范围加成及近战封顶时可达距离均比旧版增加40%',()=>{
    const {context}=scene();
    const results=vm.runInContext(`Object.values(WEAPONS_DB).flatMap(def=>[0,100,10000].map(rangePct=>{
        const base=def.range*.7,raw=base*(1+rangePct/100);
        const old=['thrust','sweep','sweep_beam','charge_melee','orbit'].includes(def.behavior)?Math.min(raw,base*1.75,6):raw;
        return {id:def.id,rangePct,old,current:getWeaponReach(def,{rangePct})};
    }))`,context);
    assert.ok(results.length>=120);
    for(const r of results)assert.ok(Math.abs(r.current-r.old*1.4)<1e-8,`${r.id} 范围属性 ${r.rangePct}`);
});

test('近战实际扫掠可命中旧6单位上限外目标，并排除新上限外目标',()=>{
    const {app:a}=scene();const edge=target(a,7.5,0),outside=target(a,9,0);
    a.startMeleeAttack('thrust',0,0,0,{range:8.4,dmg:20,crit:0},0xffffff);
    a.updateCombatEffects(.16);
    assert.equal(edge.hp,9980);assert.equal(outside.hp,10000);
});

test('远程实际飞行预算覆盖新增射程并能命中旧射程外目标',()=>{
    const {app:a,context}=scene('minishark'),w=a.weapons[0];
    const def=vm.runInContext('WEAPONS_DB.minishark',context),st=a.getWeaponCombatStats(w);
    const enemy=target(a,def.range*.7*1.2,0);st.crit=0;
    a.fireWeapon(w,def,st,0,0,enemy);
    assert.equal(a.projectiles[0].distanceBudget,st.range);
    a.updateProjectiles(.6);assert.ok(enemy.hp<10000);
});

test('领域实际跳伤覆盖扩大的边缘，特效与判定共用新半径',()=>{
    const {app:a,context}=scene('frost_lamp'),w=a.weapons[0];
    const def=vm.runInContext('WEAPONS_DB.frost_lamp',context),st=a.getWeaponCombatStats(w);
    const center=target(a,0,-3),edge=target(a,2.1,-3),outside=target(a,2.5,-3);
    a.fireWeapon(w,def,st,0,0,center);
    const field=a.advancedEffects.find(e=>e.kind==='field');assert.ok(Math.abs(field.radius-2.24)<1e-9);
    a.updateAdvancedEffects(.31);assert.ok(edge.hp<10000);assert.equal(outside.hp,10000);
});

test('陷阱扩大感应区可独立触发，爆炸与专武轨道、跳距同步扩大',()=>{
    const {app:a,context}=scene('mine_case'),w=a.weapons[0];
    const def=vm.runInContext('WEAPONS_DB.mine_case',context),st=a.getWeaponCombatStats(w);
    const center=target(a,0,-3);a.fireWeapon(w,def,st,0,0,center);center.hp=0;
    const edge=target(a,1.5,-3);a.updateAdvancedEffects(.31);assert.ok(edge.hp<10000);
    assert.ok(Math.abs(a.getMechanismProfile(w,st).radius-2.8)<1e-9);
    for(const [id,key,expected] of [['boss_hammer','radius',2.24*1.4],['boss_train','radius',3.2*1.4],['boss_prism','jump',4.2]]){
        const weapon={id,tier:2},profile=a.getBossProfile(weapon,a.getWeaponCombatStats(weapon));
        assert.ok(Math.abs(profile[key]-expected)<1e-9,id);
    }
});

test('微倾镜头初始化、持续跟随和窗口缩放统一保持40高度及36度视场角',()=>{
    const {app:a,context}=scene();
    vm.runInContext('window.innerWidth=1440;window.innerHeight=900',context);
    const camera=()=>({position:a.playerPos.clone(),lookAt(x,y,z){this.aim={x,y,z};},updateProjectionMatrix(){}});
    a.orthoCam=camera();a.perspCam=camera();a.camMode='tilt';a.applyCameraMode();
    assert.equal(a.camera,a.perspCam);assert.equal(a.camera.position.y,40);assert.equal(a.camera.position.z,23.5);
    a.updateCameraFollow=vm.runInContext('TerraBrotatoApp.prototype.updateCameraFollow',context);
    a.playerPos.set(10,0,-8);a.updateCameraFollow(.2);
    assert.equal(a.camera.position.y,40);assert.ok(Math.abs(a.camera.position.z-a.camera.aim.z-23.5)<1e-9);
    vm.runInContext('window.innerWidth=390;window.innerHeight=844',context);a.updateCameraProjection();
    assert.equal(a.perspCam.aspect,390/844);assert.equal(a.perspCam.fov,36);assert.equal(a.camera.position.y,40);
});

test('默认微倾、旧默认迁移、显式选择俯视以及旧其它视角正确读档',()=>{
    const {context}=scene();let saved=null;
    context.localStorage={getItem:key=>key==='ember-career'?saved:null,setItem:(key,value)=>{if(key==='ember-career')saved=value;}};
    const read=()=>vm.runInContext('EmberStorage.getCareer()',context);
    assert.equal(read().settings.camMode,'tilt');
    for(const [settings,expected] of [[{camMode:'ortho'},'tilt'],[{camMode:'fixed'},'fixed'],[{camMode:'tilt'},'tilt'],[{camMode:'ortho',cameraPreferenceVersion:1},'ortho'],[{camMode:'invalid'},'tilt']]){
        saved=JSON.stringify({settings,totalKills:123});const career=read();
        assert.equal(career.settings.camMode,expected);assert.equal(career.totalKills,123);
        context.savedCareer=career;vm.runInContext('EmberStorage.saveCareer(savedCareer)',context);
        assert.equal(read().settings.camMode,expected);
    }
});
