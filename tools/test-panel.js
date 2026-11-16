/* 测试面板仅运行在独立宿主页面，通过同源iframe调用真实游戏方法。 */
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const model = window.TestModel;
    const frame = $('game');
    let game, data, world, sourceInfo = {}, activeConfig = null, random = null;
    let draftWeapons = [{ id: 'grass_blade', tier: 1 }];
    let sampleResult = null, blockedDamageAttempts = 0;
    const flags = { invincible: false, bossOnly: true, speed: 1 };
    const logs = [];
    let totalErrors = 0;
    function log(message, error = false) {
        logs.push({ time: new Date().toISOString(), simulationSeconds: game?.combatElapsed || 0, type: error ? '错误' : '操作', message });
        if (logs.length > 200) logs.shift();
        if (error) totalErrors++;
        $('logs').textContent = logs.map(row => `${row.time.slice(11, 19)} [${row.type}] ${row.message}`).join('\n');
        $('error-count').textContent = `${totalErrors}个错误`;
    }
    function message(text, error = false) {
        $('message').textContent = text;
        $('message').classList.toggle('error', error);
    }
    function execute(label, action) {
        try {
            if (!game || !data) throw new Error('游戏尚未加载成功，请检查网络和日志');
            action();
            log(label); message(label); refresh();
        } catch (error) { message(error.message, true); log(`${label}：${error.message}`, true); }
    }
    function on(id, label, action) { $(id).addEventListener('click', () => execute(label, action)); }
    function requireRun() {
        if (!activeConfig || !game.stats) throw new Error('请先点击“载入场景”');
    }
    function requireBattle() {
        requireRun();
        if (!['WAVE', 'PAUSED'].includes(game.state)) throw new Error('该操作需要处于战斗或冻结状态；可重新载入场景');
    }
    function requireBoss() {
        requireBattle();
        if (!game.activeBoss || game.activeBoss.hp <= 0) throw new Error('当前没有存活Boss，请载入5的倍数波次');
        return game.activeBoss;
    }
    function hideModalScreens() {
        for (const id of ['screen-weapon-guide','screen-boss-reward','screen-core', 'screen-pause', 'screen-shop', 'screen-crate', 'screen-levelup', 'screen-gameover']) {
            world.document.getElementById(id).classList.add('hidden');
            world.document.getElementById(id).classList.remove('flex');
        }
    }
    function freeze() {
        if (game.state === 'WAVE') game.state = 'PAUSED';
        game.keys = {}; game.joyVec = { x: 0, y: 0 };
        game.updateHUD();
    }
    function renderWeapons() {
        $('weapons').replaceChildren();
        draftWeapons.forEach((weapon, index) => {
            const row = document.createElement('div'); row.className = 'weapon-row';
            const select = document.createElement('select'); select.setAttribute('aria-label', `武器${index + 1}`);
            Object.values(data.weapons).forEach(def => select.add(new Option(def.name, def.id)));
            select.value = weapon.id;
            select.onchange = () => { weapon.id = select.value; weapon.tier = Math.max(weapon.tier, data.weapons[weapon.id].minTier);delete weapon.rank;delete weapon.branch;renderWeapons(); };
            const tier = document.createElement('select'); tier.setAttribute('aria-label', `武器${index + 1}品质`);
            for (let i = data.weapons[weapon.id].minTier; i <= 4; i++) tier.add(new Option(`${i}阶`, i));
            tier.value = weapon.tier; tier.onchange = () => { weapon.tier = Number(tier.value); };
            const remove = document.createElement('button'); remove.textContent = '×'; remove.setAttribute('aria-label', `移除武器${index + 1}`);
            remove.disabled = draftWeapons.length <= 1;
            remove.onclick = () => { draftWeapons.splice(index, 1); renderWeapons(); };
            row.append(select, tier, remove); $('weapons').append(row);
            if(data.weapons[weapon.id].exclusiveBossId){
                tier.replaceChildren(new Option('专属',data.weapons[weapon.id].minTier));weapon.tier=data.weapons[weapon.id].minTier;
                const options=document.createElement('div');options.className='row';
                const rank=document.createElement('select');rank.setAttribute('aria-label',`武器${index+1}强化等级`);
                for(let i=0;i<=3;i++)rank.add(new Option(`强化${i}/3`,i));rank.value=weapon.rank||0;
                const branch=document.createElement('select');branch.setAttribute('aria-label',`武器${index+1}强化路线`);
                branch.add(new Option('未选路线',''));
                for(const [id,name] of Object.entries(game.bossWeaponRules(weapon.id).branches))branch.add(new Option(name,id));branch.value=weapon.branch||'';
                rank.onchange=()=>{weapon.rank=Number(rank.value);if(weapon.rank&&!weapon.branch){weapon.branch='single';branch.value='single';}};
                branch.onchange=()=>{weapon.branch=branch.value||null;if(!weapon.branch){weapon.rank=0;rank.value=0;}};
                options.append(rank,branch);$('weapons').append(options);
            }
        });
        $('weapon-count').textContent = `${draftWeapons.length} / 6`;
        $('add-weapon').disabled = draftWeapons.length >= 6;
    }
    function makeFields() {
        data.characters.forEach(character => $('character').add(new Option(character.name, character.id)));
        $('character').value = 'warrior';
        for (const [id, core] of Object.entries(data.cores || {})) $('core').add(new Option(core.name, id));
        $('core').onchange = () => { $('core-desc').textContent = data.cores[$('core').value]?.desc || '未应用；点击应用构筑后生效。'; };
        for (const item of data.items) {
            const row = document.createElement('div'); row.className = 'item-row';
            const label = document.createElement('label'); label.htmlFor = `item-${item.id}`;
            label.append(document.createTextNode(item.name));
            const desc = document.createElement('small'); desc.textContent = item.desc; label.append(desc);
            const input = document.createElement('input'); input.type = 'number'; input.min = 0; input.max = 100; input.value = 0; input.id = `item-${item.id}`;
            row.append(label, input); $('items').append(row);
        }
        for (const stat of data.stats) {
            const row = document.createElement('div'); row.className = 'stat-row';
            const label = document.createElement('label'); label.textContent = stat.name; label.htmlFor = `bonus-${stat.key}`;
            const input = document.createElement('input'); input.type = 'number'; input.min = -1000; input.max = 10000; input.value = 0; input.id = `bonus-${stat.key}`;
            const output = document.createElement('output'); output.id = `actual-${stat.key}`; output.textContent = '—'; output.title = '当前游戏实际生效值';
            row.append(label, input, output); $('attributes').append(row);
        }
        renderWeapons();
    }
    function readConfig() {
        const items = data.items.map(item => ({ id: item.id, count: model.number($(`item-${item.id}`).value, 0, 100, `${item.name}数量`, true) })).filter(item => item.count > 0);
        const bonuses = Object.fromEntries(data.stats.map(stat => [stat.key, $(`bonus-${stat.key}`).value]));
        return model.validateConfig({ version: 1, difficulty: $('difficulty').value, bossOverride:$('boss-override').value, character: $('character').value, wave: $('wave').value, gold: $('gold').value,
            seed: $('seed').value, speed: $('speed').value, bossOnly: $('boss-only').checked, invincible: $('invincible').checked,
            ignoreLimits: $('ignore-limits').checked, core: $('core').value || null, weapons: draftWeapons, items, bonuses }, data);
    }
    function fillConfig(config) {
        for (const key of ['character', 'wave', 'gold', 'seed', 'speed','difficulty']) $(key).value = config[key];
        $('boss-only').checked = config.bossOnly; $('invincible').checked = config.invincible; $('ignore-limits').checked = config.ignoreLimits;
        $('boss-override').value=config.bossOverride||'';
        $('core').value = config.core || ''; $('core').onchange();
        for (const item of data.items) $(`item-${item.id}`).value = config.items.find(it => it.id === item.id)?.count || 0;
        for (const stat of data.stats) $(`bonus-${stat.key}`).value = config.bonuses[stat.key];
        draftWeapons = config.weapons.map(weapon => ({ ...weapon })); renderWeapons();
    }
    function applyBuild(config) {
        const character = data.characters.find(c => c.id === config.character);
        if (activeConfig && character.id !== activeConfig.character) throw new Error('切换职业请使用“载入场景”，避免模型与属性不一致');
        freeze();game.clearAdvancedEffects();
        game.selectedCoreId = config.core; game.pendingCoreChoice = false;
        game.clearCombatEffects();
        for (const projectile of game.projectiles) game.disposeCombatMesh(projectile.mesh);
        game.projectiles = [];
        game.baseStats = Object.fromEntries(data.stats.map(stat => [stat.key, 0]));
        Object.assign(game.baseStats, { maxHp: 25, critChance: 5 });
        for (const [key, value] of Object.entries(character.mods)) game.baseStats[key] += value;
        for (const [key, value] of Object.entries(config.bonuses)) game.baseStats[key] += value;
        game.ownedItems = [];
        for (const entry of config.items) {
            const item = data.items.find(it => it.id === entry.id);
            for (let i = 0; i < entry.count; i++) game.ownedItems.push(item);
            for (const [key, value] of Object.entries(item.stats)) game.baseStats[key] += value * entry.count;
        }
        for (const weapon of game.weapons) {for(const lamp of weapon.resourceLamps||[])game.disposeCombatMesh(lamp);game.weaponOrbitGroup.remove(weapon.mesh);}
        game.weapons = [];
        for (const weapon of config.weapons) {game.addWeapon(weapon.id, weapon.tier);const instance=game.weapons.at(-1);if(data.weapons[weapon.id].exclusiveBossId){instance.rank=weapon.rank||0;instance.branch=weapon.branch||null;}}
        game.recalcStats(); game.hp = Math.max(1, Math.min(game.hp, game.stats.maxHp));
        game.lifeStealEvents = [];
        game.updateHUD(); game.updateHUDWeapons();
        if (game.state === 'SHOP') game.renderShopUI();
    }
    function applyFlags(config) {
        flags.invincible = config.invincible; flags.bossOnly = config.bossOnly; flags.speed = config.speed;
    }
    function isolate() {
        if (!flags.bossOnly) return;
        for (const enemy of game.enemies.filter(en => !en.isBoss)) {
            game.entitiesGroup.remove(enemy.group);
            if (enemy.aimLine) game.entitiesGroup.remove(enemy.aimLine);
        }
        game.enemies = game.enemies.filter(en => en.isBoss);
        for (const prop of game.props) game.entitiesGroup.remove(prop.group);
        game.props = []; game.spawns = [];
        for (const projectile of game.enemyProjectiles) game.entitiesGroup.remove(projectile.mesh);
        game.enemyProjectiles = [];
    }
    function loadScene() {
        const config = readConfig();
        applyFlags(config); random = model.createRandom(config.seed); world.Math.random = random;
        blockedDamageAttempts = 0; sampleResult = null;
        game.state = 'MENU'; game.testingMode=true; game.unlockedDifficulty=5; game.selectedDifficulty=config.difficulty;game.testBossOverride=config.bossOverride;game.selectedCharId = config.character;
        game.selectedStarterWeapon = data.characters.find(c => c.id === config.character).starter;
        game.startNewRun();
        activeConfig = config;
        applyBuild(config);
        game.startWave(config.wave); game.gold = config.gold;
        isolate(); hideModalScreens(); freeze();
        log(`配置：第${config.wave}波，${config.character}，种子${config.seed}，${config.weapons.length}把武器；仅Boss=${config.bossOnly}，无敌=${config.invincible}`);
    }
    let realUpdate;
    function advance(seconds) {
        let remaining = seconds;
        while (remaining > 1e-9 && game.state === 'WAVE') {
            const step = Math.min(remaining, 1 / 60);
            realUpdate.call(game, step); remaining -= step;
        }
    }
    function step(seconds) {
        requireBattle(); hideModalScreens();
        game.keys = {}; game.joyVec = { x: 0, y: 0 }; game.state = 'WAVE';
        try { advance(seconds); } finally { if (game.state === 'WAVE') freeze(); }
    }
    function download(name, value) {
        const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = name; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function snapshot() {
        return {
            state: game.state, difficulty:game.difficulty, wave: game.wave, timer: game.waveTimer, hp: game.hp, gold: game.gold, bank: game.baggedGold,
            seconds: game.combatElapsed, position: { x: game.playerPos?.x, z: game.playerPos?.z },
            core: game.selectedCoreId || null, coreOffers:game.coreOffers?.slice(), pendingBossReward:game.pendingBossReward?{...game.pendingBossReward}:null, stats: { ...game.stats }, baseStats: { ...game.baseStats },
            weapons: game.weapons?.map(weapon => ({ id: weapon.id, instanceId:weapon.instanceId,rank:weapon.rank,branch:weapon.branch,tier: weapon.tier, combat: game.getWeaponCombatStats(weapon), details:game.getWeaponFacts(weapon) })),
            friendlyVfx:game.weaponVfxList?.length||0,advancedEffects:game.advancedEffects?.length||0,damageOverTime:game.damageOverTime?.length||0,
            items: data.items.map(item => ({ id: item.id, count: game.ownedItems?.filter(it => it.id === item.id).length || 0 })).filter(it => it.count),
            boss: game.activeBoss ? { type: game.activeBoss.type, hp: game.activeBoss.hp, maxHp: game.activeBoss.maxHp, phase2: game.activeBoss.phase2, ai: { ...game.activeBoss.ai } } : null,
            waveMetrics: game.waveMetrics ? { ...game.waveMetrics } : null, randomCratesDropped: game.randomCratesDropped,
            history: game.runHistory ? game.runHistory.map(row => ({ ...row })) : []
        };
    }
    function refresh() {
        if (!game) return;
        const labels = { MENU: '主菜单', GUIDE:'内容图鉴', WAVE: '运行中', PAUSED: '已冻结', SHOP: '商店', CRATE: '宝箱', CORE: '核心选择', BOSS_REWARD:'专武奖励', LEVELUP: '升级', GAMEOVER: '已结算' };
        $('state-label').textContent = labels[game.state] || game.state;
        $('sim-time').textContent = `${(game.combatElapsed || 0).toFixed(2)}秒`;
        const boss = game.activeBoss;
        $('live-summary').textContent = activeConfig ? `难度${game.difficulty||1} · 第${game.wave}波 · 生命 ${Math.max(0, game.hp).toFixed(1)}/${game.stats.maxHp} · 晶币 ${game.gold}\n敌人 ${game.enemies.length} · 弹丸 ${game.projectiles.length + game.enemyProjectiles.length} · ${flags.invincible ? '无敌开启' : '正常受伤'}${boss && boss.hp > 0 ? `\nBoss ${boss.hp.toFixed(0)}/${boss.maxHp} · ${boss.ai?.phase || '追击'}` : ''}` : '选择场景后载入；修改不影响普通游戏入口。';
        $('live-summary').style.whiteSpace = 'pre-line';
        if(activeConfig)$('live-summary').textContent+='\n友方瞬时特效 '+(game.weaponVfxList?.length||0)+'/96 · 持续攻击 '+(game.advancedEffects?.length||0)+' · 附着 '+(game.damageOverTime?.length||0)+'/120';
        for (const stat of data?.stats || []) $(`actual-${stat.key}`).textContent = activeConfig ? Number(game.getEffectiveStat(stat.key).toFixed(2)) : '—';
        const metrics = game.waveMetrics;
        if (metrics) {
            const damage = metrics.damage || 0, seconds = metrics.seconds || 0;
            $('metrics').textContent = `当前核心：${data.cores?.[game.selectedCoreId]?.name || '无'}\n战斗时间：${seconds.toFixed(2)}秒\n有效伤害：${damage.toFixed(0)}\n有效输出：${(seconds ? damage / seconds : 0).toFixed(1)}/秒\n武器释放命中：${metrics.landedAttacks}/${metrics.attacks}\n承伤：${metrics.damageTaken.toFixed(1)}\n吸血回复：${metrics.lifeStealHealing.toFixed(2)}\n晶币拾取：${metrics.coinIncome || 0} · 收获：${metrics.harvestIncome || 0}\n储蓄分配：${metrics.bankSpent || 0} · 结转：${metrics.bankAdded || 0}\n随机掉箱：${game.randomCratesDropped}\n无敌拦截：${blockedDamageAttempts}次\n致命来源：${metrics.deathCause || '—'}\n已结算波次：${game.runHistory.length}`;
        }
    }
    function installHooks() {
        realUpdate = game.updateWave;
        game.updateWave = dt => advance(dt * flags.speed);
        const damage = game.damagePlayer;
        game.damagePlayer = function (...args) {
            if (flags.invincible && this.state === 'WAVE') { blockedDamageAttempts++; return; }
            return damage.apply(this, args);
        };
        for (const name of ['queueEnemySpawn', 'spawnTerraProp']) {
            const original = game[name];
            game[name] = function (...args) { if (!flags.bossOnly) return original.apply(this, args); };
        }
        world.addEventListener('error', event => log(event.message || '游戏资源加载错误', true));
        world.addEventListener('unhandledrejection', event => log(String(event.reason?.stack || event.reason), true));
        const error = world.console.error.bind(world.console);
        world.console.error = (...args) => { log(args.map(arg => String(arg?.stack || arg)).join(' '), true); error(...args); };
    }
    function wireActions() {
        $('preset').onchange = () => execute('已填入快捷配置，点击载入场景开始', () => {
            const preset = $('preset').value;
            if (!preset) return;
            const config = { version: 1, character: 'warrior', wave: 5, gold: 100, seed: 20261114, speed: 1, bossOnly: true, invincible: false, ignoreLimits: false, bonuses: {}, weapons: [{ id: 'grass_blade', tier: 1 }], items: [] };
            if (preset === 'screenshot') {
                config.character = 'ranger'; config.gold = 213;
                config.bonuses = { maxHp: 5, dmgPct: -6, meleeDmg: 6, rangedDmg: 8, dodge: 25, speed: 12, luck: 26, harvesting: 17 };
                config.weapons = [['minishark',2],['light_disc',2],['minishark',1],['megashark',2],['water_bolt',2],['copper_sword',2]].map(([id,tier])=>({id,tier}));
            }
            if (preset === 'eye') { config.wave = 10; config.weapons = [{ id: 'grass_blade', tier: 2 }, { id: 'starfury', tier: 2 }]; }
            if (preset === 'economy') { config.character = 'guide'; config.wave = 14; config.gold = 1000; config.bossOnly = false; config.bonuses = { luck: 220 }; config.weapons = [{ id: 'bow', tier: 2 }]; }
            if (preset === 'swords') { config.wave = 10; config.weapons = Array.from({ length: 6 }, () => ({ id: 'grass_blade', tier: 1 })); }
            fillConfig(model.validateConfig(config, data));
        });
        on('load', '载入场景并冻结', loadScene);
        on('pause', '切换运行／冻结', () => {
            requireBattle();
            if (game.state === 'WAVE') freeze();
            else { hideModalScreens(); game.keys = {}; game.joyVec = { x: 0, y: 0 }; game.state = 'WAVE'; game.updateHUD(); }
        });
        on('step', '完整战斗推进0.1秒', () => step(.1));
        on('step-second', '完整战斗推进1秒', () => step(1));
        on('warn', '锁定Boss技能预警并冻结', () => {
            const boss = requireBoss(); freeze();
            boss.group.position.y = 0; boss.ai.chargesLeft = boss.phase2 ? 2 : 1;
            game.beginBossWarning(boss);
        });
        on('rage', '设置Boss半血阶段并冻结', () => {
            const boss = requireBoss();
            game.state = 'WAVE'; boss.hp = boss.maxHp / 2; game.updateBossBehavior(boss, 0); freeze();
        });
        on('heal', '回满生命', () => { requireRun(); game.hp = game.stats.maxHp; game.updateHUD(); });
        on('dash', '触发冲刺并冻结，使用步进查看位移', () => {
            requireBattle(); game.state = 'WAVE'; game.dashCooldown = 0; game.tryDash(); freeze();
        });
        on('move', '传送玩家并冻结', () => {
            requireBattle(); const bound = data.arenaHalf - .8;
            const x = model.number($('player-x').value, -bound, bound, '玩家X');
            const z = model.number($('player-z').value, -bound, bound, '玩家Z');
            freeze(); game.playerPos.set(x, 0, z); game.playerGroup.position.copy(game.playerPos); game.camFocus.copy(game.playerPos); game.updateCameraFollow(0);
        });
        on('timer-zero', '计时归零；存活Boss仍须击败', () => { requireBattle(); freeze(); game.waveTimer = 0; game.updateHUD(); });
        on('kill-boss', '测试强制击败Boss，等待步进执行结算', () => {
            const boss = requireBoss(); freeze();
            boss.ai.phase = 'recover'; boss.group.position.y = 0;
            game.hitTarget(boss, boss.hp, 0, 0, 0); game.updateHUD();
        });
        on('shop', '跳过战斗打开测试商店（不发波次奖励）', () => {
            requireBattle(); hideModalScreens(); game.clearEntities(); game.openShopPhase();
        });
        on('crate', '生成测试宝箱（不计自然掉落）', () => {
            requireRun();
            if (!['WAVE', 'PAUSED', 'SHOP'].includes(game.state)) throw new Error('请先结束当前奖励选择');
            hideModalScreens(); game.clearEntities(); game.pendingCrates++; game.openCratePhase();
        });
        on('core-reward', '打开测试核心选择（非自然奖励）', () => {
            requireBattle();
            if (game.selectedCoreId) throw new Error('已持有核心，请先在构筑页取消核心并应用');
            hideModalScreens(); game.clearEntities(); game.pendingCoreChoice = true; game.openCorePhase();
        });
        on('spawn', '手动生成普通怪物', () => {
            requireBattle(); freeze(); const bound = data.arenaHalf - 1;
            game.spawnEnemyNow($('enemy').value, game.playerPos.x, Math.max(-bound, Math.min(bound, game.playerPos.z - 6)));
        });
        $('add-weapon').onclick = () => { if (draftWeapons.length < 6) { draftWeapons.push({ id: 'grass_blade', tier: 1 }); renderWeapons(); } };
        const apply = () => {
            requireRun(); const config = readConfig(); applyBuild(config); applyFlags(config);
            activeConfig = { ...activeConfig, core: config.core, bonuses: config.bonuses, weapons: config.weapons, items: config.items, ignoreLimits: config.ignoreLimits };
            isolate();
        };
        on('apply-build', '应用构筑，不重复累加属性', apply);
        on('apply-stats', '应用属性与构筑', apply);
        $('invincible').onchange = () => execute(`无敌${$('invincible').checked ? '开启' : '关闭'}`, () => { flags.invincible = $('invincible').checked; });
        $('boss-only').onchange = () => execute('切换自动刷怪与道具开关', () => { flags.bossOnly = $('boss-only').checked; if (activeConfig) isolate(); });
        $('speed').onchange = () => execute('修改运行速度', () => { flags.speed = model.number($('speed').value, .25, 4, '速度'); });
        on('sample', '执行品质概率抽样', () => {
            sampleResult = model.sampleTiers(data, Number($('sample-wave').value), Number($('sample-luck').value), Number($('sample-count').value), Number($('seed').value), world.Math);
            $('sample-result').innerHTML = '<table><thead><tr><th>品质</th><th>理论</th><th>实测</th><th>数量</th></tr></thead><tbody>' + sampleResult.counts.map((count, i) => `<tr><td>${i + 1}阶</td><td>${(sampleResult.expected[i] * 100).toFixed(2)}%</td><td>${(count / sampleResult.count * 100).toFixed(2)}%</td><td>${count}</td></tr>`).join('') + '</tbody></table>';
        });
        on('export-config', '导出面板配置（可能包含尚未应用的修改）', () => download('余烬回路-测试配置.json', readConfig()));
        on('export-report', '导出测试报告', () => {
            requireRun();
            download('余烬回路-测试报告.json', { reportVersion: 1, createdAt: new Date().toISOString(), source: sourceInfo,
                notice: '这是测试环境结果。跳波、属性编辑、无敌、强制击杀、传送等均可能影响结果；不是正常通关证明。固定种子不保证不同输入与帧率下完整对局一致。',
                appliedConfig: activeConfig, runtimeFlags: { ...flags, ignoreLimits: activeConfig.ignoreLimits }, rngState: random?.state(), blockedDamageAttempts,
                snapshot: snapshot(), sample: sampleResult, totalErrors, logs: logs.slice() });
        });
        $('import-config').onchange = async event => {
            const file = event.target.files[0];
            if (!file) return;
            try {
                if (file.size > 100000) throw new Error('配置文件不得超过100KB');
                const config = model.validateConfig(JSON.parse(await file.text()), data);
                fillConfig(config); log('已导入配置草稿，尚未改变运行中的游戏'); message('导入成功；点击“载入场景”应用。');
            } catch (error) { log(`导入失败：${error.message}`, true); message(error.message, true); }
            event.target.value = '';
        };
        $('clear-log').onclick = () => { logs.length = 0; totalErrors = 0; log('已清空日志'); };
    }
    frame.addEventListener('load', () => {
        world = frame.contentWindow; game = world.GAME; data = world.TEST_DATA;
        if (!game || !data) { message('游戏初始化失败，请检查CDN网络连接后刷新页面。', true); log('未找到游戏实例，可能是Three.js加载失败', true); return; }
        makeFields(); installHooks(); wireActions(); refresh();
        log('游戏脚本加载成功，测试操作不会写入产品HTML');
        setInterval(refresh, 250);
    });
    for (const button of document.querySelectorAll('[data-tab]')) button.onclick = () => {
        document.querySelectorAll('[data-tab]').forEach(tab => tab.classList.toggle('selected', tab === button));
        document.querySelectorAll('[data-page]').forEach(page => { page.hidden = page.dataset.page !== button.dataset.tab; });
    };
    $('toggle-panel').onclick = () => {
        const collapsed = document.body.classList.toggle('collapsed');
        $('toggle-panel').textContent = collapsed ? '展开面板' : '收起面板';
    };
    window.addEventListener('error', event => { log(event.message, true); message('面板发生错误，请查看记录。', true); });
    fetch('/api/info').then(response => response.json()).then(info => { sourceInfo = info; $('source-title').textContent = `${info.title} · 源码 ${info.sha256.slice(0, 10)}`; }).catch(error => log(`源码信息读取失败：${error.message}`, true));
})();
