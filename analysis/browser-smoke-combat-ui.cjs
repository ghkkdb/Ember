// 仅监听本机；验证真实页面、触屏布局与密集击杀反馈。软件WebGL不代表真机帧率。
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts','combat-ui');fs.mkdirSync(output,{recursive:true});
const server=http.createServer((request,response)=>{
    const route=decodeURIComponent(new URL(request.url,'http://localhost').pathname),file=path.resolve(root,'.'+(route==='/'?'/terrabrotato.html':route));
    if(!file.startsWith(root+path.sep)){response.writeHead(403);response.end();return;}
    fs.readFile(file,(error,data)=>{if(error){response.writeHead(404);response.end();return;}response.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.png':'image/png'})[path.extname(file)]||'application/octet-stream');response.end(data);});
});

async function start(page,url) {
    await page.goto(url,{waitUntil:'load',timeout:45000});
    await page.waitForFunction(()=>typeof app!=='undefined'&&app&&app.renderer);
    await page.evaluate(()=>{
        window.showCharacterSelect();window.selectClass('warrior');window.selectStarterWeapon('grass_blade');app.startNewRun();
        for(const id of ['grass_blade','minishark','frost_lamp','mine_case','orbit_loom'])app.addWeapon(id,1);
        app.recalcStats();app.updateHUDWeapons();
    });
}

async function slaughter(page) {
    return page.evaluate(()=>{
        app.clearEntities();app.visualBudgets={};app.cameraShake=0;
        app.currentWaveWeaponStats={};app.currentWaveWeaponInstanceStats={};
        if(app.waveMetrics){app.waveMetrics.damage=0;app.waveMetrics.bossDamage=0;}
        document.getElementById('floating-text-container').replaceChildren();
        const before=app.totalKills,damage=app.totalDmg,start=performance.now();
        for(let i=0;i<50;i++)app.spawnEnemyNow('slime_green',(i%10-5)*.9,(Math.floor(i/10)-2)*.9);
        const targets=[...app.enemies],created=performance.now();
        for(const [i,en] of targets.entries()){
            en.hp=en.maxHp=10;const w=app.weapons[i%2];
            app.hitTarget(en,100,100,0,0,{attack:{weaponId:w.id,weaponInstanceId:w.instanceId}});
        }
        app.state='PAUSED';
        return {createdMs:created-start,killMs:performance.now()-created,kills:app.totalKills-before,damage:app.totalDmg-damage,particles:app.particles.length,vfx:app.weaponVfxList.length,queued:app.combatDisposals.length,shake:app.cameraShake,floatCount:document.getElementById('floating-text-container').childElementCount,pixelRatio:app.renderer.getPixelRatio(),rows:app.getWaveWeaponRows().map(r=>({slot:r.slot,damage:r.totalDmg})),lights:app.dynamicLights?.filter(l=>l.age<l.duration).length||0};
    });
}

(async()=>{
    let browser;const report={sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'terrabrotato.html'))).digest('hex'),errors:[],checks:{}};
    try{
        await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
        browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
        const url=`http://127.0.0.1:${server.address().port}`,scriptCache=new Map();
        for(const [name,options] of [['desktop',{viewport:{width:1440,height:900}}],['mobile',{viewport:{width:360,height:800},deviceScaleFactor:3,isMobile:true,hasTouch:true}]]){
            const page=await browser.newPage(options);page.on('pageerror',e=>report.errors.push(e.message));
            // 两个独立设备上下文复用成功加载的相同CDN脚本，避免重复下载时的网络抖动。
            await page.route('https://**',async route=>{const cached=scriptCache.get(route.request().url());if(cached)await route.fulfill(cached);else await route.continue();});
            page.on('response',async response=>{if(response.ok()&&response.request().resourceType()==='script'&&response.url().startsWith('https://')){try{scriptCache.set(response.url(),{body:await response.body(),contentType:response.headers()['content-type']||'application/javascript'});}catch{}}});
            await start(page,url);
            const checks=report.checks[name]={};
            await page.screenshot({path:path.join(output,`${name}-combat.png`)});
            checks.hud=await page.evaluate(()=>{
                const hud=document.getElementById('hud-tools').getBoundingClientRect(),dash=document.getElementById('btn-dash').getBoundingClientRect();
                return {hudBottom:hud.bottom,viewportHeight:innerHeight,scrollWidth:document.documentElement.scrollWidth,width:innerWidth,dash:{left:dash.left,right:dash.right,bottom:dash.bottom,height:dash.height},weapons:document.querySelectorAll('#hud-weapons-bar button').length};
            });
            assert.equal(checks.hud.weapons,6);assert.ok(checks.hud.scrollWidth<=checks.hud.width);
            if(name==='mobile'){assert.ok(checks.hud.hudBottom<230);assert.ok(checks.hud.dash.bottom<=800);assert.ok(checks.hud.dash.height>=60);}
            await page.locator('#hud-weapons-bar button').first().click();
            assert.equal(await page.evaluate(()=>app.state),'WEAPON_DETAIL');
            await page.screenshot({path:path.join(output,`${name}-weapon.png`)});
            await page.locator('#btn-close-weapon-detail').click();
            if(name==='mobile'){
                await page.setViewportSize({width:844,height:390});await page.waitForFunction(()=>Math.abs(app.perspCam.aspect-844/390)<1e-9);
                checks.landscape=await page.evaluate(()=>({bottom:document.getElementById('hud-tools').getBoundingClientRect().bottom,overflow:document.documentElement.scrollWidth>innerWidth}));
                assert.equal(checks.landscape.overflow,false);assert.ok(checks.landscape.bottom<180);
                await page.screenshot({path:path.join(output,'mobile-landscape-combat.png')});
                await page.setViewportSize({width:360,height:800});await page.waitForFunction(()=>Math.abs(app.perspCam.aspect-360/800)<1e-9);
                const session=await page.context().newCDPSession(page);
                await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:70,y:500}]});
                await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:120,y:500}]});
                assert.ok(await page.evaluate(()=>app.joyVec.x>.5));
                await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
                assert.equal(await page.evaluate(()=>app.joyVec.x),0);await page.locator('#btn-dash').tap();
                checks.touch=await page.evaluate(()=>({dashCooldown:app.dashCooldown,stopped:app.joyVec.x===0&&app.joyVec.y===0}));
                assert.ok(checks.touch.dashCooldown>0);assert.equal(checks.touch.stopped,true);await session.detach();
            }
            checks.burst=await slaughter(page);assert.equal(checks.burst.kills,50);assert.equal(checks.burst.damage,500);assert.equal(checks.burst.shake,0);assert.equal(checks.burst.lights,0);
            assert.deepEqual(checks.burst.rows.map(r=>r.damage),[250,250,0,0,0,0]);
            assert.ok(checks.burst.particles<=(name==='mobile'?36:56));if(name==='mobile')assert.ok(checks.burst.pixelRatio<=1.25);
            await page.evaluate(()=>{app.state='WAVE';app.waveTimer=0;app.endWave();});
            assert.equal(await page.evaluate(()=>app.state),'WAVE_REPORT');
            checks.report=await page.evaluate(()=>({rows:document.querySelectorAll('#wave-report-weapons .damage-row').length,recorded:app.runHistory.at(-1).weaponRows.map(r=>({slot:r.slot,damage:r.totalDmg})),scrollWidth:document.getElementById('screen-wave-report').scrollWidth,width:innerWidth}));
            assert.equal(checks.report.rows,6);assert.ok(checks.report.scrollWidth<=checks.report.width);
            await page.screenshot({path:path.join(output,`${name}-report.png`)});
            await page.locator('#btn-wave-report-continue').click();
            await page.evaluate(()=>{
                for(let guard=0;guard<30&&app.state!=='SHOP';guard++){
                    if(app.state==='CRATE')app.resolveCrate(true);
                    else if(app.state==='LEVELUP')app.pickUpgrade(app.levelUpChoices[0].key,app.levelUpChoices[0].val);
                    else break;
                }
            });
            assert.equal(await page.evaluate(()=>app.state),'SHOP');
            await page.screenshot({path:path.join(output,`${name}-shop.png`)});
            checks.shop=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.getElementById('screen-shop').scrollWidth,actions:[...document.querySelectorAll('#shop-actions button')].map(b=>({height:b.getBoundingClientRect().height,left:b.getBoundingClientRect().left,right:b.getBoundingClientRect().right})),rows:document.querySelectorAll('#shop-weapon-report .damage-row').length}));
            assert.ok(checks.shop.scrollWidth<=checks.shop.width);assert.equal(checks.shop.rows,6);if(name==='mobile')assert.ok(checks.shop.actions.every(b=>b.height>=44&&b.left>=0&&b.right<=360));
            checks.restore=await page.evaluate(()=>{const rows=app.runHistory.at(-1).weaponRows.length;window.saveAndQuitToMenu();window.resumeActiveRun();return {state:app.state,rows:app.runHistory.at(-1).weaponRows.length,before:rows};});
            assert.equal(checks.restore.state,'SHOP');assert.equal(checks.restore.rows,checks.restore.before);
            if(name==='mobile'){
                for(const [width,height] of [[320,740],[390,844],[844,390]]){
                    await page.setViewportSize({width,height});await page.waitForFunction(([w,h])=>innerWidth===w&&innerHeight===h,[width,height]);
                    await page.screenshot({path:path.join(output,`shop-${width}x${height}.png`)});
                    const overflow=await page.evaluate(()=>document.getElementById('screen-shop').scrollWidth>innerWidth);assert.equal(overflow,false,`${width}×${height} 商店溢出`);
                }
            }
            checks.victory=await page.evaluate(()=>{
                app.startWave(20);app.clearEntities();app.waveBossDefeated=true;app.waveTimer=0;
                app.spawnEnemyNow('slime_green',0,-3);const en=app.enemies.at(-1),w=app.weapons[0];en.hp=5;
                app.hitTarget(en,100,0,0,0,{attack:{weaponId:w.id,weaponInstanceId:w.instanceId}});app.endWave();
                return {state:app.state,rows:document.querySelectorAll('#gameover-summary .damage-row').length,damage:app.runHistory.at(-1).weaponRows.reduce((s,r)=>s+r.totalDmg,0)};
            });
            assert.equal(checks.victory.state,'GAMEOVER');assert.equal(checks.victory.rows,6);assert.equal(checks.victory.damage,5);
            checks.defeat=await page.evaluate(()=>{
                app.startWave(21);app.clearEntities();app.spawnEnemyNow('slime_green',0,-3);const en=app.enemies.at(-1),w=app.weapons[1];en.hp=9;
                app.hitTarget(en,100,0,0,0,{attack:{weaponId:w.id,weaponInstanceId:w.instanceId}});app.triggerGameOver(false);
                return {state:app.state,damage:app.runHistory.at(-1).weaponRows.reduce((s,r)=>s+r.totalDmg,0),rows:document.querySelectorAll('#gameover-summary .damage-row').length};
            });
            assert.equal(checks.defeat.state,'GAMEOVER');assert.equal(checks.defeat.damage,9);assert.equal(checks.defeat.rows,6);
            await page.close();
        }
        assert.deepEqual(report.errors,[]);report.passed=true;
    }catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;}
    finally{fs.writeFileSync(path.join(output,'browser-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})();
