const fs = require('fs');

const menuHtml = `
    <!-- 0. 游戏主菜单界面 (Main Menu Screen) -->
    <div id="screen-main-menu" class="fixed inset-0 z-30 flex items-center justify-center p-4 md:p-8 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <div class="terra-panel max-w-5xl w-full p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8 shadow-2xl relative border-2 border-slate-700/80 overflow-hidden">
            <!-- 工业装饰边框与铆钉 -->
            <div class="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-amber-400 pointer-events-none"></div>
            <div class="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-amber-400 pointer-events-none"></div>
            <div class="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-amber-400 pointer-events-none"></div>
            <div class="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-amber-400 pointer-events-none"></div>

            <!-- 左侧：标题与主要操作导航 -->
            <div class="flex-1 flex flex-col justify-between gap-6">
                <div>
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-mono font-bold mb-3 shadow-inner">
                        <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                        EMBER CIRCUIT 3D · 工业体素战术生存
                    </div>
                    <h1 class="text-3xl sm:text-4xl md:text-5xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-emerald-400 drop-shadow-md">
                        余烬回路
                    </h1>
                    <div class="text-[11px] md:text-xs font-mono tracking-widest text-slate-400 uppercase mt-1">
                        EMBER CIRCUIT : INDUSTRIAL SURVIVOR · v1.12
                    </div>
                    <p class="text-xs text-slate-300 mt-2 leading-relaxed">
                        3D 体素外骨骼 · 42 款全量武器 · 50 件工业配件 · 12 大核心协议 · 6 位首领泰坦
                    </p>
                </div>

                <!-- 主菜单按钮阵列 -->
                <div class="flex flex-col gap-3">
                    <!-- 1. 开始新巡行 -->
                    <button id="btn-menu-new-game" onclick="window.showCharacterSelect()" class="terra-btn px-6 py-3.5 text-base md:text-lg font-black flex items-center justify-between group shadow-lg w-full">
                        <span class="flex items-center gap-3">⚔️ 开始新巡行</span>
                        <span class="text-xs font-mono text-amber-200 opacity-80 group-hover:translate-x-1 transition-transform">START RUN &gt;</span>
                    </button>

                    <!-- 2. 继续上次巡行 (有存档时高亮) -->
                    <button id="btn-menu-continue" onclick="window.resumeActiveRun()" class="px-6 py-3.5 text-sm md:text-base font-bold rounded-lg border-2 border-slate-700 bg-slate-900/60 text-slate-400 flex items-center justify-between group transition w-full">
                        <div class="flex flex-col text-left">
                            <span class="flex items-center gap-2 font-black">💾 继续上次巡行</span>
                            <span id="menu-continue-desc" class="text-[11px] font-mono text-slate-400 font-normal mt-0.5">暂无进行中巡行</span>
                        </div>
                        <span id="menu-continue-tag" class="text-xs font-mono opacity-80 font-bold group-hover:translate-x-1 transition-transform">RESUME &gt;</span>
                    </button>

                    <!-- 3. 全量内容图鉴 -->
                    <button onclick="window.openWeaponGuide()" class="terra-btn terra-btn-blue px-6 py-3 text-sm md:text-base font-bold flex items-center justify-between group shadow-md w-full">
                        <span class="flex items-center gap-3">📖 巡行全量资料库</span>
                        <span class="text-xs font-mono text-sky-200 opacity-80">42武器 · 50道具 · 6Boss</span>
                    </button>

                    <!-- 4. 生涯战绩与统计 -->
                    <button onclick="window.openCareerStats()" class="px-6 py-3 text-sm md:text-base font-bold rounded-lg border border-slate-600 bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center justify-between group shadow-md transition w-full">
                        <span class="flex items-center gap-3">🏆 生涯战绩与统计</span>
                        <span class="text-xs font-mono text-amber-300">STATISTICS &gt;</span>
                    </button>

                    <!-- 5. 系统设置 -->
                    <button onclick="window.openSettings()" class="px-6 py-3 text-sm md:text-base font-bold rounded-lg border border-slate-600 bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center justify-between group shadow-md transition w-full">
                        <span class="flex items-center gap-3">⚙️ 系统与视效设置</span>
                        <span class="text-xs font-mono text-slate-400">SETTINGS &gt;</span>
                    </button>
                </div>

                <div class="text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span>100% OFFLINE ZERO DEPENDENCY</span>
                    <span>THREE.JS VOXEL ENGINE</span>
                </div>
            </div>

            <!-- 右侧：巡行者生涯档案速览 & 3D群落视窗 -->
            <div class="w-full md:w-80 flex flex-col justify-between gap-4 bg-slate-900/70 p-4 md:p-5 rounded-xl border border-slate-700/80 shadow-inner">
                <div>
                    <div class="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-3">
                        <h3 class="text-xs font-mono font-black text-amber-300 tracking-wider flex items-center gap-2">
                            <span>👤</span> 巡行者生涯档案
                        </h3>
                        <span id="menu-difficulty-badge" class="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">最高难度 1</span>
                    </div>

                    <!-- 关键战绩九宫格 -->
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <div class="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                            <div class="text-[10px] text-slate-400 font-mono">最高存活波次</div>
                            <div id="stat-highest-wave" class="text-base font-black text-emerald-300 font-mono mt-0.5">第 0 波</div>
                        </div>
                        <div class="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                            <div class="text-[10px] text-slate-400 font-mono">总通关胜场</div>
                            <div id="stat-total-wins" class="text-base font-black text-amber-300 font-mono mt-0.5">0 胜</div>
                        </div>
                        <div class="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                            <div class="text-[10px] text-slate-400 font-mono">击溃魔物总数</div>
                            <div id="stat-total-kills" class="text-base font-black text-rose-300 font-mono mt-0.5">0 只</div>
                        </div>
                        <div class="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                            <div class="text-[10px] text-slate-400 font-mono">累计开采晶币</div>
                            <div id="stat-total-coins" class="text-base font-black text-sky-300 font-mono mt-0.5">0 💎</div>
                        </div>
                    </div>
                </div>

                <!-- 3D 场景互动与视角切换工具栏 -->
                <div class="bg-slate-950/90 p-3 rounded-lg border border-slate-800 space-y-2">
                    <div class="text-[11px] font-mono text-slate-400 font-bold mb-1 flex items-center justify-between">
                        <span>三维场景预览控制</span>
                        <span class="text-emerald-400 text-[10px]">实时渲染</span>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.cycleBiome()" class="flex-1 py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-amber-300 flex items-center justify-center gap-1.5 transition">
                            <span>🗺️</span> <span id="menu-biome-name">边庭</span>
                        </button>
                        <button onclick="window.switchCameraMode()" class="flex-1 py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-sky-300 flex items-center justify-center gap-1.5 transition">
                            <span>🎥</span> <span id="menu-cam-name">俯视</span>
                        </button>
                    </div>
                    <div class="text-[10px] text-slate-500 font-mono leading-tight">
                        快捷键：[B] 切换四大群落场景 · [V] 切换三维视角
                    </div>
                </div>

                <!-- 操作指令简明提示 -->
                <div class="text-[11px] text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
                    <div class="text-amber-300 font-bold text-[11px]">🎮 战术操作指南：</div>
                    <div>• <kbd class="px-1 bg-slate-800 rounded text-[10px]">WASD</kbd> / 方向键：移动机体</div>
                    <div>• <kbd class="px-1 bg-slate-800 rounded text-[10px]">空格</kbd>：战术冲刺（0.45s 无敌免伤）</div>
                    <div>• <kbd class="px-1 bg-slate-800 rounded text-[10px]">Esc</kbd>：暂停游戏 / 战术面板</div>
                </div>
            </div>
        </div>
    </div>

    <!-- 0.1 历史战绩与统计界面 (Career Stats Modal) -->
    <div id="screen-career" class="fixed inset-0 z-40 hidden items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
        <div class="terra-panel max-w-2xl w-full p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b border-slate-700 pb-3">
                <h2 class="text-xl font-black text-amber-300 flex items-center gap-2">
                    <span>🏆</span> 巡行者生涯总档案与战绩
                </h2>
                <button onclick="window.closeCareerStats()" class="text-slate-400 hover:text-white text-lg font-bold">✕</button>
            </div>

            <!-- 生涯核心指标 -->
            <div id="career-summary-cards" class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs"></div>

            <!-- 6 大职业出战数据 -->
            <div>
                <h3 class="text-xs font-mono font-bold text-sky-300 mb-2">六大职业巡行出战纪录</h3>
                <div id="career-heroes-list" class="space-y-2"></div>
            </div>

            <div class="pt-3 border-t border-slate-700 flex justify-end">
                <button onclick="window.closeCareerStats()" class="terra-btn px-6 py-2.5 text-sm">
                    🔙 返回主菜单
                </button>
            </div>
        </div>
    </div>

    <!-- 0.2 系统设置界面 (Settings Modal) -->
    <div id="screen-settings" class="fixed inset-0 z-40 hidden items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
        <div class="terra-panel max-w-lg w-full p-6 flex flex-col gap-4">
            <div class="flex items-center justify-between border-b border-slate-700 pb-3">
                <h2 class="text-xl font-black text-amber-300 flex items-center gap-2">
                    <span>⚙️</span> 系统设置与偏好
                </h2>
                <button onclick="window.closeSettings()" class="text-slate-400 hover:text-white text-lg font-bold">✕</button>
            </div>

            <div class="space-y-4 text-xs">
                <!-- 音效音量 -->
                <div class="flex items-center justify-between bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <div>
                        <div class="font-bold text-slate-200">主音效开关</div>
                        <div class="text-[11px] text-slate-400">开启或静音游戏全部攻击、受击与UI音效</div>
                    </div>
                    <button id="setting-sound-btn" onclick="window.toggleSettingSound()" class="px-3 py-1.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold">
                        🔊 已开启
                    </button>
                </div>

                <!-- 辉光后期处理 -->
                <div class="flex items-center justify-between bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <div>
                        <div class="font-bold text-slate-200">工业光影辉光 (Unreal Bloom)</div>
                        <div class="text-[11px] text-slate-400">激光、熔岩、暴击与反应堆发光质感（低配设备可关闭）</div>
                    </div>
                    <button id="setting-bloom-btn" onclick="window.toggleSettingBloom()" class="px-3 py-1.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold">
                        ✨ 已开启
                    </button>
                </div>

                <!-- 视角模式 -->
                <div class="flex items-center justify-between bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <div>
                        <div class="font-bold text-slate-200">默认观察视角</div>
                        <div class="text-[11px] text-slate-400">正交俯视、固定追焦或倾斜第三人称</div>
                    </div>
                    <select id="setting-cam-select" onchange="window.changeSettingCam(this.value)" class="bg-slate-950 text-slate-200 p-1.5 rounded border border-slate-700">
                        <option value="ortho">正交俯视(稳)</option>
                        <option value="fixed">固定追焦(动)</option>
                        <option value="tilt">倾斜微距(深)</option>
                    </select>
                </div>

                <!-- 重置存档 -->
                <div class="bg-rose-950/20 p-3 rounded-lg border border-rose-900/50 flex items-center justify-between">
                    <div>
                        <div class="font-bold text-rose-300">重置全部游戏进度</div>
                        <div class="text-[11px] text-rose-400/80">清除生涯战绩、解锁难度及中断存档，恢复初装状态</div>
                    </div>
                    <button onclick="window.resetAllSaveData()" class="px-3 py-1.5 rounded bg-rose-900/60 hover:bg-rose-800 border border-rose-600 text-rose-200 font-bold">
                        ⚠️ 重置数据
                    </button>
                </div>
            </div>

            <div class="pt-3 border-t border-slate-700 flex justify-end">
                <button onclick="window.closeSettings()" class="terra-btn px-6 py-2.5 text-sm">
                    💾 保存并返回
                </button>
            </div>
        </div>
    </div>
`;

console.log('Menu HTML snippet length:', menuHtml.length);
`;

console.log('Script valid');
