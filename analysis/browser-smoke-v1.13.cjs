// 使用本机Chrome和真实WebGL页面验证；服务只监听本机并在结束后关闭。
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'artifacts','v113');fs.mkdirSync(output,{recursive:true});
const server=http.createServer((request,response)=>{
    const route=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(route==='/'?'/terrabrotato.html':route));
    if(!file.startsWith(root+path.sep)){response.writeHead(403);response.end();return;}
    fs.readFile(file,(error,data)=>{
        if(error){response.writeHead(404);response.end();return;}
        const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.png':'image/png'};
        response.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');response.end(data);
    });
});

(async()=>{
    let browser;const report={sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'terrabrotato.html'))).digest('hex'),errors:[],checks:{}};
    try{
        await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
        browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
        const page=await browser.newPage({viewport:{width:1440,height:900}});
        page.on('pageerror',error=>report.errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'load',timeout:45000});
        await page.waitForFunction(()=>typeof app!=='undefined'&&app&&app.renderer,{timeout:20000});
        await page.evaluate(()=>{window.showCharacterSelect();window.selectClass('warrior');window.selectStarterWeapon('grass_blade');app.startNewRun();});
        await page.waitForTimeout(1800);
        report.checks.combat=await page.evaluate(()=>({state:app.state,wave:app.wave,weaponCount:app.weapons.length,frames:app.frameCount,drawCalls:app.renderer.info.render.calls,hp:app.hp}));
        assert.equal(report.checks.combat.state,'WAVE');
        await page.screenshot({path:path.join(output,'combat-desktop.png')});
        report.checks.patterns=await page.evaluate(()=>{
            app.clearEntities();for(const w of app.weapons)app.disposeCombatMesh(w.mesh);app.weapons=[];
            for(const id of ['ratchet_crossbow','shard_blaster','orbit_loom','seal_needle','return_scythe','pulse_ring'])app.addWeapon(id,2);
            app.startWave(8);app.spawnEnemyNow('slime_green',0,-3);const enemy=app.enemies.at(-1);enemy.hp=enemy.maxHp=100000;
            for(const w of app.weapons)app.fireWeapon(w,WEAPONS_DB[w.id],app.getWeaponCombatStats(w),0,0,enemy);
            app.updateAdvancedEffects(.3);app.updateProjectiles(.02);
            return {projectiles:app.projectiles.length,orbit:app.advancedEffects.some(e=>e.kind==='orbit'),finiteHp:Number.isFinite(enemy.hp)};
        });
        assert.ok(report.checks.patterns.projectiles>=7);assert.equal(report.checks.patterns.orbit,true);assert.equal(report.checks.patterns.finiteHp,true);
        report.checks.loot=await page.evaluate(()=>{
            app.clearEntities();app.hp=10;app.gold=0;app.baggedGold=0;app.xp=0;app.xpNext=16;app.level=1;app.pendingLevelUps=0;app.pendingCrates=0;
            app.baseStats.harvesting=0;app.recalcStats();app.wave=8;app.waveTimer=0;app.waveSettling=false;
            app.spawnPickup('coin',18,18,20);app.spawnPickup('crate',-18,18,1);app.spawnPickup('heart',18,-18,6);app.endWave();
            return {state:app.state,gold:app.gold,bag:app.baggedGold,level:app.level,crates:app.pendingCrates,levels:app.pendingLevelUps,pickups:app.pickups.length};
        });
        assert.equal(report.checks.loot.gold,20);assert.equal(report.checks.loot.pickups,0);assert.equal(report.checks.loot.crates,1);assert.equal(report.checks.loot.level,2);
        report.checks.restore=await page.evaluate(()=>{
            for(let guard=0;guard<20&&app.state!=='SHOP';guard++){
                if(app.state==='WAVE_REPORT')app.closeWaveReport();
                else if(app.state==='CRATE')app.resolveCrate(true);
                else if(app.state==='LEVELUP')app.pickUpgrade(app.levelUpChoices[0].key,app.levelUpChoices[0].val);
                else break;
            }
            const before=app.gold;app.fuseTriggered=true;window.saveAndQuitToMenu();window.resumeActiveRun();
            return {state:app.state,gold:app.gold,before,fuseTriggered:app.fuseTriggered,weaponsMounted:app.weapons.every(w=>app.weaponOrbitGroup.children.includes(w.mesh))};
        });
        assert.equal(report.checks.restore.state,'SHOP');assert.equal(report.checks.restore.gold,report.checks.restore.before);assert.equal(report.checks.restore.weaponsMounted,true);assert.equal(report.checks.restore.fuseTriggered,true);
        await page.screenshot({path:path.join(output,'shop-desktop.png')});
        await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.showMainMenu());
        await page.screenshot({path:path.join(output,'menu-mobile.png')});
        assert.deepEqual(report.errors,[]);report.passed=true;
    }catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;}
    finally{
        fs.writeFileSync(path.join(output,'browser-smoke.json'),JSON.stringify(report,null,2));
        console.log(JSON.stringify(report,null,2));
        if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
    }
})();
