const fs = require('fs');
const path = require('path');

const targetFile = 'd:/Desktop/webGame/泰拉兄弟/terrabrotato.html';
let src = fs.readFileSync(targetFile, 'utf8');

console.log('Original terrabrotato.html length:', src.length);

// 1. Insert EmberStorage right before class TerraBrotatoApp
const appClassMarker = 'class TerraBrotatoApp {';
const appClassPos = src.indexOf(appClassMarker);

if (appClassPos === -1) {
    throw new Error('Could not find TerraBrotatoApp class');
}

const emberStorageCode = `/**
     * 《余烬回路》数据持久化与生涯进度管理器 (EmberStorage)
     * 支持 LocalStorage 永久生涯战绩存储、中断巡行存档（自动/手动检查点）与设置持久化。
     */
    const EmberStorage = {
        CAREER_KEY: 'ember-career',
        ACTIVE_RUN_KEY: 'ember-active-run',
        DIFFICULTY_KEY: 'ember-difficulty',

        getDefaultCareer() {
            return {
                highestDifficulty: 1,
                totalRuns: 0,
                totalWins: 0,
                highestWave: 0,
                totalKills: 0,
                totalBossKills: 0,
                totalCoinsEarned: 0,
                heroStats: {
                    guide: { runs: 0, wins: 0, highestWave: 0 },
                    warrior: { runs: 0, wins: 0, highestWave: 0 },
                    ranger: { runs: 0, wins: 0, highestWave: 0 },
                    mage: { runs: 0, wins: 0, highestWave: 0 },
                    ninja: { runs: 0, wins: 0, highestWave: 0 },
                    summoner: { runs: 0, wins: 0, highestWave: 0 }
                },
                settings: {
                    soundEnabled: true,
                    sfxVolume: 0.8,
                    bloomEnabled: true,
                    camMode: 'ortho',
                    damageNumbers: true
                }
            };
        },

        getCareer() {
            try {
                if (typeof localStorage === 'undefined') return this.getDefaultCareer();
                const raw = localStorage.getItem(this.CAREER_KEY);
                if (!raw) {
                    const legacyDiff = Number(localStorage.getItem(this.DIFFICULTY_KEY)) || 1;
                    const career = this.getDefaultCareer();
                    career.highestDifficulty = Math.max(1, Math.min(5, legacyDiff));
                    return career;
                }
                const data = JSON.parse(raw);
                return { ...this.getDefaultCareer(), ...data, settings: { ...this.getDefaultCareer().settings, ...(data.settings || {}) } };
            } catch (e) {
                return this.getDefaultCareer();
            }
        },

        saveCareer(data) {
            try {
                if (typeof localStorage === 'undefined') return;
                localStorage.setItem(this.CAREER_KEY, JSON.stringify(data));
                if (data.highestDifficulty) {
                    localStorage.setItem(this.DIFFICULTY_KEY, String(data.highestDifficulty));
                }
            } catch (e) {}
        },

        getActiveRun() {
            try {
                if (typeof localStorage === 'undefined') return null;
                const raw = localStorage.getItem(this.ACTIVE_RUN_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        },

        saveActiveRun(app) {
            try {
                if (typeof localStorage === 'undefined' || !app || app.state === 'GAMEOVER') return;
                const runData = {
                    savedAt: Date.now(),
                    wave: app.wave || 1,
                    difficulty: app.difficulty || 1,
                    biomeIndex: app.biomeIndex || 0,
                    charId: app.selectedCharId || 'guide',
                    level: app.level || 1,
                    xp: app.xp || 0,
                    xpNext: app.xpNext || 16,
                    gold: app.gold || 0,
                    baggedGold: app.baggedGold || 0,
                    baseStats: { ...(app.baseStats || {}) },
                    weapons: (app.weapons || []).map(w => ({ id: w.id, tier: w.tier, rank: w.rank || 0, branch: w.branch || null })),
                    ownedItems: (app.ownedItems || []).map(it => it.id),
                    selectedCoreId: app.selectedCoreId || null,
                    totalKills: app.totalKills || 0,
                    totalDmg: app.totalDmg || 0
                };
                localStorage.setItem(this.ACTIVE_RUN_KEY, JSON.stringify(runData));
            } catch (e) {}
        },

        clearActiveRun() {
            try {
                if (typeof localStorage === 'undefined') return;
                localStorage.removeItem(this.ACTIVE_RUN_KEY);
            } catch (e) {}
        },

        recordRunEnd(app, victory = false) {
            try {
                const career = this.getCareer();
                career.totalRuns++;
                if (victory) career.totalWins++;
                career.highestWave = Math.max(career.highestWave || 0, app.wave || 1);
                career.totalKills = (career.totalKills || 0) + (app.totalKills || 0);
                career.totalCoinsEarned = (career.totalCoinsEarned || 0) + Math.max(0, (app.gold || 0) + (app.baggedGold || 0));

                const charId = app.selectedCharId || 'guide';
                if (!career.heroStats) career.heroStats = this.getDefaultCareer().heroStats;
                if (!career.heroStats[charId]) career.heroStats[charId] = { runs: 0, wins: 0, highestWave: 0 };
                career.heroStats[charId].runs++;
                if (victory) career.heroStats[charId].wins++;
                career.heroStats[charId].highestWave = Math.max(career.heroStats[charId].highestWave || 0, app.wave || 1);

                if (victory && (app.difficulty || 1) >= (career.highestDifficulty || 1) && (career.highestDifficulty || 1) < 5) {
                    career.highestDifficulty = Math.min(5, (app.difficulty || 1) + 1);
                }

                this.saveCareer(career);
                this.clearActiveRun();
                return career;
            } catch (e) {
                return this.getDefaultCareer();
            }
        }
    };

    `;

src = src.substring(0, appClassPos) + emberStorageCode + src.substring(appClassPos);
console.log('Inserted EmberStorage class successfully');

// 2. In TerraBrotatoApp constructor, load career and initialize main menu
const oldConstructorCall = 'this.initInput();\n            this.renderStartMenu();';
const newConstructorCall = `this.initInput();
            this.career = EmberStorage.getCareer();
            this.unlockedDifficulty = this.career.highestDifficulty || readDifficultyUnlock();
            this.camMode = this.career.settings?.camMode || 'ortho';
            if (this.career.settings && typeof sfx !== 'undefined') {
                sfx.muted = !this.career.settings.soundEnabled;
            }
            this.renderMainMenu();
            this.renderStartMenu();`;

src = src.replace(oldConstructorCall, newConstructorCall);

// 3. Add Main Menu, Career, Settings, and Run Restore methods to TerraBrotatoApp prototype
const markerBeforeMethods = 'renderStartMenu() {';
const methodsPos = src.indexOf(markerBeforeMethods);

if (methodsPos === -1) {
    throw new Error('Could not find renderStartMenu method');
}

const newAppMethods = `renderMainMenu() {
            this.career = EmberStorage.getCareer();
            const activeRun = EmberStorage.getActiveRun();
            const continueBtn = document.getElementById('btn-menu-continue');
            const continueDesc = document.getElementById('menu-continue-desc');
            const continueTag = document.getElementById('menu-continue-tag');

            if (continueBtn && continueDesc && continueTag) {
                if (activeRun && activeRun.weapons && activeRun.weapons.length > 0) {
                    const cDef = CHARACTERS.find(c => c.id === activeRun.charId) || CHARACTERS[0];
                    continueBtn.className = "px-5 py-3 text-sm md:text-base font-bold rounded-lg border-2 border-emerald-400 bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900/80 shadow-lg flex items-center justify-between group transition w-full cursor-pointer";
                    continueBtn.disabled = false;
                    continueDesc.textContent = '第 ' + activeRun.wave + ' 波 · ' + cDef.name.split(' ')[0] + ' · ' + activeRun.weapons.length + '把武器 · 💎 ' + activeRun.gold;
                    continueDesc.className = "text-[11px] font-mono text-emerald-200/90 font-normal mt-0.5";
                    continueTag.textContent = 'RESUME >';
                    continueTag.className = "text-xs font-mono text-emerald-300 font-bold group-hover:translate-x-1 transition-transform";
                } else {
                    continueBtn.className = "px-5 py-3 text-sm md:text-base font-bold rounded-lg border border-slate-700 bg-slate-900/50 text-slate-500 cursor-not-allowed flex items-center justify-between w-full opacity-60";
                    continueBtn.disabled = true;
                    continueDesc.textContent = '暂无进行中巡行';
                    continueDesc.className = "text-[11px] font-mono text-slate-400 font-normal mt-0.5";
                    continueTag.textContent = '无存档';
                    continueTag.className = "text-xs font-mono text-slate-500 font-normal";
                }
            }

            // 渲染生涯档案卡片
            const highestWaveEl = document.getElementById('stat-highest-wave');
            if (highestWaveEl) highestWaveEl.textContent = '第 ' + (this.career.highestWave || 0) + ' 波';
            const totalWinsEl = document.getElementById('stat-total-wins');
            if (totalWinsEl) totalWinsEl.textContent = (this.career.totalWins || 0) + ' 胜';
            const totalKillsEl = document.getElementById('stat-total-kills');
            if (totalKillsEl) totalKillsEl.textContent = (this.career.totalKills || 0).toLocaleString() + ' 只';
            const totalCoinsEl = document.getElementById('stat-total-coins');
            if (totalCoinsEl) totalCoinsEl.textContent = (this.career.totalCoinsEarned || 0).toLocaleString() + ' 💎';
            const diffBadge = document.getElementById('menu-difficulty-badge');
            if (diffBadge) diffBadge.textContent = '最高难度 ' + (this.career.highestDifficulty || 1);

            const biomeNameEl = document.getElementById('menu-biome-name');
            if (biomeNameEl) biomeNameEl.textContent = BIOME_THEMES[BIOME_ORDER[this.biomeIndex]]?.name || '边庭';
            const camNameEl = document.getElementById('menu-cam-name');
            if (camNameEl) camNameEl.textContent = this.camMode === 'ortho' ? '正交俯视' : (this.camMode === 'fixed' ? '固定追焦' : '倾斜微距');
        }

        renderCareerStats() {
            this.career = EmberStorage.getCareer();
            const summaryGrid = document.getElementById('career-summary-cards');
            if (summaryGrid) {
                const winRate = this.career.totalRuns > 0 ? ((this.career.totalWins / this.career.totalRuns) * 100).toFixed(1) + '%' : '0.0%';
                summaryGrid.innerHTML = \`
                    <div class="bg-slate-900/90 p-3 rounded-lg border border-slate-700">
                        <div class="text-slate-400 text-[11px]">总巡行探索</div>
                        <div class="text-lg font-black text-amber-300 font-mono mt-0.5">\${this.career.totalRuns} 次</div>
                    </div>
                    <div class="bg-slate-900/90 p-3 rounded-lg border border-slate-700">
                        <div class="text-slate-400 text-[11px]">20波通关胜场</div>
                        <div class="text-lg font-black text-emerald-300 font-mono mt-0.5">\${this.career.totalWins} 胜 (\${winRate})</div>
                    </div>
                    <div class="bg-slate-900/90 p-3 rounded-lg border border-slate-700">
                        <div class="text-slate-400 text-[11px]">历史最高波次</div>
                        <div class="text-lg font-black text-sky-300 font-mono mt-0.5">第 \${this.career.highestWave || 0} 波</div>
                    </div>
                    <div class="bg-slate-900/90 p-3 rounded-lg border border-slate-700">
                        <div class="text-slate-400 text-[11px]">累计击溃魔物</div>
                        <div class="text-lg font-black text-rose-300 font-mono mt-0.5">\${(this.career.totalKills || 0).toLocaleString()} 只</div>
                    </div>
                    <div class="bg-slate-900/90 p-3 rounded-lg border border-slate-700">
                        <div class="text-slate-400 text-[11px]">累计开采晶币</div>
                        <div class="text-lg font-black text-yellow-300 font-mono mt-0.5">\${(this.career.totalCoinsEarned || 0).toLocaleString()} 💎</div>
                    </div>
                    <div class="bg-slate-900/90 p-3 rounded-lg border border-slate-700">
                        <div class="text-slate-400 text-[11px]">已解锁挑战难度</div>
                        <div class="text-lg font-black text-purple-300 font-mono mt-0.5">难度 \${this.career.highestDifficulty || 1} / 5</div>
                    </div>
                \`;
            }

            const heroList = document.getElementById('career-heroes-list');
            if (heroList) {
                const stats = this.career.heroStats || {};
                heroList.innerHTML = CHARACTERS.map(c => {
                    const st = stats[c.id] || { runs: 0, wins: 0, highestWave: 0 };
                    const rate = st.runs > 0 ? ((st.wins / st.runs) * 100).toFixed(0) + '%' : '0%';
                    return \`
                        <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 text-xs">
                            <div class="flex items-center gap-2.5">
                                <img src="\${this.art.urls[c.sprite]}" class="w-8 h-8 rounded bg-slate-950 p-1 border border-slate-700 pixel-icon">
                                <div>
                                    <div class="font-bold text-slate-200">\${c.name}</div>
                                    <div class="text-[10px] text-slate-400">初始武器: \${WEAPONS_DB[c.starter]?.name || c.starter}</div>
                                </div>
                            </div>
                            <div class="flex items-center gap-4 text-right font-mono text-[11px]">
                                <div><span class="text-slate-400">出战: </span><b class="text-amber-300">\${st.runs}</b></div>
                                <div><span class="text-slate-400">胜率: </span><b class="text-emerald-300">\${rate} (\${st.wins}胜)</b></div>
                                <div><span class="text-slate-400">最高: </span><b class="text-sky-300">第\${st.highestWave}波</b></div>
                            </div>
                        </div>
                    \`;
                }).join('');
            }
        }

        renderSettings() {
            this.career = EmberStorage.getCareer();
            const soundBtn = document.getElementById('setting-sound-btn');
            if (soundBtn) {
                soundBtn.textContent = this.career.settings?.soundEnabled ? '🔊 已开启' : '🔇 已静音';
                soundBtn.className = this.career.settings?.soundEnabled ? 'px-3 py-1.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold' : 'px-3 py-1.5 rounded bg-slate-800 border border-slate-600 text-slate-400 font-bold';
            }
            const bloomBtn = document.getElementById('setting-bloom-btn');
            if (bloomBtn) {
                bloomBtn.textContent = this.career.settings?.bloomEnabled ? '✨ 已开启' : '🌑 已关闭';
                bloomBtn.className = this.career.settings?.bloomEnabled ? 'px-3 py-1.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold' : 'px-3 py-1.5 rounded bg-slate-800 border border-slate-600 text-slate-400 font-bold';
            }
            const camSelect = document.getElementById('setting-cam-select');
            if (camSelect) camSelect.value = this.camMode || 'ortho';
        }

        restoreActiveRun(save) {
            if (!save) return;
            sfx.init();
            this.wave = save.wave || 1;
            this.difficulty = save.difficulty || 1;
            this.biomeIndex = save.biomeIndex || 0;
            this.selectedCharId = save.charId || 'guide';
            this.level = save.level || 1;
            this.xp = save.xp || 0;
            this.xpNext = save.xpNext || 16;
            this.gold = save.gold || 0;
            this.baggedGold = save.baggedGold || 0;
            this.baseStats = save.baseStats || { maxHp: 25 };
            this.selectedCoreId = save.selectedCoreId || null;
            this.totalKills = save.totalKills || 0;
            this.totalDmg = save.totalDmg || 0;
            this.weapons = [];
            this.ownedItems = [];
            this.pendingCrates = 0;
            this.pendingLevelUps = 0;
            this.victory = false;

            // 恢复所有已装备武器
            for (const w of save.weapons || []) {
                this.addWeapon(w.id, w.tier);
                const instance = this.weapons.at(-1);
                if (instance) {
                    instance.rank = w.rank || 0;
                    instance.branch = w.branch || null;
                }
            }

            // 恢复所有已购道具
            for (const id of save.ownedItems || []) {
                const itemDef = ITEMS_DB.find(it => it.id === id);
                if (itemDef) this.ownedItems.push(itemDef);
            }

            this.createPlayerMesh(this.selectedCharId);
            this.buildBiomeDiorama(BIOME_ORDER[this.biomeIndex]);
            this.updateHeroCosmetics();

            // 隐藏菜单界面，显示战斗 HUD 并直通本波商店
            document.getElementById('screen-main-menu')?.classList.add('hidden');
            document.getElementById('screen-main-menu')?.classList.remove('flex');
            document.getElementById('screen-start')?.classList.add('hidden');
            document.getElementById('screen-start')?.classList.remove('flex');
            document.getElementById('hud-layer')?.classList.remove('hidden');

            const cDef = CHARACTERS.find(c => c.id === this.selectedCharId) || CHARACTERS[0];
            const hudChar = document.getElementById('hud-char-name');
            if (hudChar) hudChar.textContent = cDef.name.split(' ')[0];

            this.updateHUD();
            this.updateHUDWeapons();
            this.openShop();
        }

        `;

src = src.substring(0, methodsPos) + newAppMethods + src.substring(methodsPos);
console.log('Inserted new methods to TerraBrotatoApp prototype successfully');

// 4. In openShop, add auto-save checkpoint
const oldOpenShopStart = 'openShop() {\n            this.state = \'SHOP\';';
const newOpenShopStart = `openShop() {\n            this.state = 'SHOP';\n            EmberStorage.saveActiveRun(this);`;
src = src.replace(oldOpenShopStart, newOpenShopStart);

// 5. In triggerGameOver, record run end and clear active run
const oldGameOverStorage = `if (victory && !this.testingMode) {
                this.unlockedDifficulty = Math.max(this.unlockedDifficulty || 1, Math.min(5, (this.difficulty || 1) + 1));
                try { localStorage.setItem('ember-difficulty', String(this.unlockedDifficulty)); } catch {}
            }`;

const newGameOverStorage = `if (!this.testingMode) {
                EmberStorage.recordRunEnd(this, victory);
                this.career = EmberStorage.getCareer();
                this.unlockedDifficulty = this.career.highestDifficulty;
            }`;

src = src.replace(oldGameOverStorage, newGameOverStorage);

// 6. Update window.* global methods at the bottom of the script
const oldReturnToTitle = `window.returnToTitle = function() {
        if (!app) return;
        ['screen-weapon-guide','screen-boss-reward','screen-core', 'screen-pause', 'screen-gameover', 'screen-shop', 'screen-crate', 'screen-levelup', 'hud-layer', 'joystick-zone', 'joystick-visual'].forEach(id => {
            const el = document.getElementById(id);
            el.classList.add('hidden'); el.classList.remove('flex');
        });
        document.getElementById('screen-start').classList.remove('hidden');
        app.state = 'MENU';
        app.keys = {};
        app.joyVec = { x: 0, y: 0 };
        app.clearEntities();
    };`;

const newReturnToTitle = `window.showMainMenu = function() {
        if (!app) return;
        ['screen-weapon-guide','screen-boss-reward','screen-core', 'screen-pause', 'screen-gameover', 'screen-shop', 'screen-crate', 'screen-levelup', 'screen-career', 'screen-settings', 'hud-layer', 'joystick-zone', 'joystick-visual', 'screen-start'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.add('hidden'); el.classList.remove('flex'); }
        });
        const menu = document.getElementById('screen-main-menu');
        if (menu) { menu.classList.remove('hidden'); menu.classList.add('flex'); }
        app.state = 'MENU';
        app.keys = {};
        app.joyVec = { x: 0, y: 0 };
        app.clearEntities();
        app.renderMainMenu();
    };

    window.showCharacterSelect = function() {
        if (!app) return;
        const menu = document.getElementById('screen-main-menu');
        if (menu) { menu.classList.add('hidden'); menu.classList.remove('flex'); }
        const start = document.getElementById('screen-start');
        if (start) { start.classList.remove('hidden'); start.classList.add('flex'); }
        app.renderStartMenu();
    };

    window.resumeActiveRun = function() {
        if (!app) return;
        const activeRun = EmberStorage.getActiveRun();
        if (activeRun) {
            app.restoreActiveRun(activeRun);
        }
    };

    window.saveAndQuitToMenu = function() {
        if (!app) return;
        EmberStorage.saveActiveRun(app);
        window.showMainMenu();
    };

    window.openCareerStats = function() {
        if (!app) return;
        app.renderCareerStats();
        const el = document.getElementById('screen-career');
        if (el) { el.classList.remove('hidden'); el.classList.add('flex'); }
    };

    window.closeCareerStats = function() {
        const el = document.getElementById('screen-career');
        if (el) { el.classList.add('hidden'); el.classList.remove('flex'); }
    };

    window.openSettings = function() {
        if (!app) return;
        app.renderSettings();
        const el = document.getElementById('screen-settings');
        if (el) { el.classList.remove('hidden'); el.classList.add('flex'); }
    };

    window.closeSettings = function() {
        const el = document.getElementById('screen-settings');
        if (el) { el.classList.add('hidden'); el.classList.remove('flex'); }
        if (app) EmberStorage.saveCareer(app.career);
    };

    window.toggleSettingSound = function() {
        if (!app) return;
        sfx.init();
        const on = sfx.toggle();
        if (!app.career.settings) app.career.settings = {};
        app.career.settings.soundEnabled = on;
        EmberStorage.saveCareer(app.career);
        app.renderSettings();
    };

    window.toggleSettingBloom = function() {
        if (!app) return;
        if (!app.career.settings) app.career.settings = {};
        app.career.settings.bloomEnabled = !app.career.settings.bloomEnabled;
        if (app.bloomPass) {
            app.bloomPass.enabled = app.career.settings.bloomEnabled;
        }
        EmberStorage.saveCareer(app.career);
        app.renderSettings();
    };

    window.changeSettingCam = function(mode) {
        if (!app) return;
        app.camMode = mode;
        if (!app.career.settings) app.career.settings = {};
        app.career.settings.camMode = mode;
        app.applyCameraMode();
        EmberStorage.saveCareer(app.career);
        app.renderMainMenu();
    };

    window.resetAllSaveData = function() {
        if (typeof confirm !== 'undefined' && !confirm('确定要清除所有游戏进度与战绩？此操作无法撤销！')) return;
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('ember-career');
                localStorage.removeItem('ember-active-run');
                localStorage.setItem('ember-difficulty', '1');
            }
        } catch (e) {}
        if (app) {
            app.career = EmberStorage.getDefaultCareer();
            app.unlockedDifficulty = 1;
            app.selectedDifficulty = 1;
            app.renderMainMenu();
            app.renderStartMenu();
            app.renderSettings();
        }
        alert('游戏数据已成功重置为初装状态。');
    };

    window.returnToTitle = function() {
        window.showMainMenu();
    };`;

src = src.replace(oldReturnToTitle, newReturnToTitle);

// 7. Update closeWeaponGuide to return to main menu if coming from main menu
src = src.replace(
    `this.state=this.weaponGuideReturnState||'MENU';`,
    `this.state=this.weaponGuideReturnState||'MENU'; if (this.state==='MENU') { const menu=document.getElementById('screen-main-menu'); if (menu) { menu.classList.remove('hidden'); menu.classList.add('flex'); } }`
);

fs.writeFileSync(targetFile, src, 'utf8');
console.log('Updated terrabrotato.html with full persistence and main menu!');
console.log('New file length:', src.length);
