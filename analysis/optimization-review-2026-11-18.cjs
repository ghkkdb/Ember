// 只读核查当前产品；结果独立保存，不覆盖历史基准或修改游戏规则。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { setup, benchmark } = require('./combat-benchmark.cjs');
const { run } = require('./early-game-benchmark.cjs');
const html = fs.readFileSync(path.join(__dirname, '..', 'terrabrotato.html'), 'utf8');
const { app, context } = setup(11);
context.reviewApp = app;
const rules = vm.runInContext(`(() => {
    const a=reviewApp, neutral={...a.baseStats};
    const dps=(id,tiers,extra={})=>{
        a.baseStats={...neutral,...extra};a.selectedCoreId=null;a.ownedItems=[];
        const weapons=tiers.map(tier=>({id,tier}));
        return a.getBuildDpsCeiling(weapons,a.calculateBuildStats(weapons).stats);
    };
    const merge=['grass_blade','minishark','water_bolt','copper_sword'].map(id=>{
        const before=dps(id,[1,1]),after=dps(id,[2]);
        const six=dps(id,[1,1,1,1,1,1]),five=dps(id,[2,1,1,1,1]);
        return {id,name:WEAPONS_DB[id].name,before,after,changePct:(after/before-1)*100,six,five,fullChangePct:(five/six-1)*100};
    });
    const core=[['heavy','grass_blade'],['volley','minishark'],['charge','rail_charge'],['echo','ratchet_crossbow'],['return','return_scythe']].map(([core,id])=>{
        a.ownedItems=[];a.baseStats={...neutral};const weapons=[{id,tier:WEAPONS_DB[id].minTier}],stats=a.calculateBuildStats(weapons).stats;
        a.selectedCoreId=null;const before=a.getWeaponCombatStats(weapons[0],stats),beforeDps=a.getBuildDpsCeiling(weapons,stats);
        a.selectedCoreId=core;const after=a.getWeaponCombatStats(weapons[0],stats),afterDps=a.getBuildDpsCeiling(weapons,stats);
        return {core,id,before,after,beforeDps,afterDps};
    });
    a.selectedCoreId=null;
    const items=ITEMS_DB.map(i=>({id:i.id,name:i.name,desc:i.desc,stats:i.stats,tier:i.tier,price:i.price,limit:i.limit}));
    const economy=[1,5,10,15,20,30,50].map(wave=>({wave,budget:getWaveCoinBudget(wave),grassPrice:getWeaponShopPrice(WEAPONS_DB.grass_blade,1,wave),armorPrice:getItemPrice(ITEMS_DB.find(i=>i.id==='shackle'),wave),bossHp:getBossEncounterStats(wave,1).hp}));
    return {merge,core,items,economy,api:{openShop:typeof a.openShop,openShopPhase:typeof a.openShopPhase},counts:{weapons:Object.keys(WEAPONS_DB).length,items:ITEMS_DB.length,cores:Object.keys(CORE_RELICS).length}};
})()`, context);
const gameplay = html.split(/\r?\n/).slice(1392).join('\n');
rules.itemRuntimeReferences = rules.items.map(item => ({id:item.id,name:item.name,desc:item.desc,stats:item.stats,references:(gameplay.match(new RegExp("['\"]"+item.id+"['\"]",'g'))||[]).length}));
// 独立验证账本是否混入道具伤害、持续伤害分类及跨波累积。
const probe=setup(29), p=probe.app;
p.recalcStats();p.startWave(1);
const mesh=new p.entitiesGroup.constructor();
const prop={hp:100,maxHp:100,isProp:true,group:mesh,knockback:mesh.position.clone()};
p.hitTarget(prop,10,0,0,0,{weaponId:'review_probe'});
const propLedger=p.currentWaveWeaponStats.review_probe.totalDmg;
const propWaveDamage=p.waveMetrics.damage;
const target={hp:100,maxHp:100,group:new p.entitiesGroup.constructor(),knockback:mesh.position.clone()};
p.bossSecondary(target,8,{weaponId:'review_dot',tracked:false});
const dotLedger={...p.currentWaveWeaponStats.review_dot};
p.startWave(2);
const ledgerAfterNextWave=JSON.parse(JSON.stringify(p.currentWaveWeaponStats));
p.startWave(1);p.spawnEnemyNow('slime_green',8,8);
const firstHp=p.enemies.at(-1).maxHp;
p.startWave(25);p.spawnEnemyNow('slime_green',8,8);
const endlessHp=p.enemies.at(-1).maxHp;
const probes={propLedger,propWaveDamage,dotLedger,ledgerAfterNextWave,firstHp,endlessHp,computedEndlessScale:p.endlessMonsterHpScale};
// 实际执行新武器攻击与冲刺入口，而非仅核对配置存在。
const behaviorEngine=setup(47), b=behaviorEngine.app;
behaviorEngine.context.reviewApp=b;
b.startWave(1);b.clearEntities();
probes.weaponDispatch=vm.runInContext(`(() => {
    const a=reviewApp,group=new THREE.Group();group.position.set(0,0,-3);
    const target={hp:100000,maxHp:100000,group,radius:.5,knockback:new THREE.Vector3()};a.enemies=[target];
    return ['ratchet_crossbow','shard_blaster','orbit_loom','return_scythe','seal_needle'].map(id=>{
        a.projectiles=[];a.advancedEffects=[];
        const w={id,tier:WEAPONS_DB[id].minTier,instanceId:1,recoil:new THREE.Vector3()};
        a.weapons=[w];const st=a.getWeaponCombatStats(w);a.fireWeapon(w,WEAPONS_DB[id],st,0,0,target);
        return {id,behavior:WEAPONS_DB[id].behavior,projectiles:a.projectiles.length,effects:a.advancedEffects.length,boomerang:a.projectiles[0]?.boomerang||false};
    });
})()`,behaviorEngine.context);
b.dashCooldown=0;b.dashTimer=0;b.ownedItems=[];b.tryDash();const bareCooldown=b.dashCooldown;
b.dashCooldown=0;b.dashTimer=0;b.ownedItems=[{id:'slide_axle'}];b.tryDash();
probes.dash={bareCooldown,itemCooldown:b.dashCooldown};
const resume=setup(11).app;
resume.createPlayerMesh=()=>{};resume.buildBiomeDiorama=()=>{};
try {resume.restoreActiveRun({wave:5,weapons:[],ownedItems:[],baseStats:{maxHp:25}});probes.restoreError=null;}
catch(error){probes.restoreError=error.message;}
// 同种子配对测试，只在模拟对象上关闭顿帧，产品保持原样。
function hitstopCase(disableHitstop) {
    const engine=setup(11),a=engine.app;
    Object.assign(a.baseStats,{maxHp:85,armor:12,meleeDmg:9,rangedDmg:9,attackSpeed:24,dmgPct:18});
    a.weaponOrbitGroup=new a.entitiesGroup.constructor();
    for(let i=0;i<6;i++)a.addWeapon('minishark',3);
    a.startWave(15);a.clearEntities();
    const mesh=new a.entitiesGroup.constructor();mesh.position.set(0,0,-4);
    const target={hp:1e8,maxHp:1e8,isBoss:true,radius:2.15,group:mesh,knockback:mesh.position.clone()};
    a.enemies=[target];a.activeBoss=target;a.updateEnemies=()=>{};a.queueEnemySpawn=()=>{};
    for(let frame=0;frame<60*20;frame++){
        if(disableHitstop)a.hitstopTimer=0;
        engine.advance(1/60);
    }
    return {disableHitstop,wallSeconds:20,simulationSeconds:a.combatElapsed,damage:a.totalDmg,wallDps:a.totalDmg/20,simulationDps:a.totalDmg/a.combatElapsed};
}
const hitstop=[hitstopCase(false),hitstopCase(true)];
const combat=benchmark();
const progression=[11,29,47].map(seed=>run(seed,'output',20));
const report={sourceSha256:crypto.createHash('sha256').update(html).digest('hex'),date:'2026-11-18',rules,probes,hitstop,combat,progression};
fs.writeFileSync(path.join(__dirname,'optimization-review-2026-11-18.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({sourceSha256:report.sourceSha256,counts:rules.counts,merge:rules.merge,api:rules.api,probes,hitstop,progression:progression.map(r=>({seed:r.seed,outcome:r.outcome,wave:r.rows.at(-1)?.wave,gold:r.closingGold,bossSeconds:r.rows.filter(x=>x.wave%5===0).map(x=>({wave:x.wave,seconds:x.metrics?.bossKillSeconds,state:x.state}))}))},null,2));
