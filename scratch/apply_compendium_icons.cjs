const fs = require('fs');
const path = require('path');

const targetFile = 'd:/Desktop/webGame/泰拉兄弟/terrabrotato.html';
let src = fs.readFileSync(targetFile, 'utf8');

console.log('Original terrabrotato.html length:', src.length);

// 1. Upgrade guideCreatureIcon
const oldGuideCreatureStart = src.indexOf('guideCreatureIcon(id,color,boss=false) {');
const oldGuideCreatureEnd = src.indexOf('getItemFacts(item,wave=this.guideWave||this.wave||1) {');

if (oldGuideCreatureStart === -1 || oldGuideCreatureEnd === -1) {
    throw new Error('Could not locate guideCreatureIcon in source');
}

const newGuideCreatureCode = `guideCreatureIcon(id,color,boss=false) {
            const tint='#'+color.toString(16).padStart(6,'0');
            // 工业机械底盘装甲外框与四角重型铆钉
            let parts='<rect x="2" y="2" width="64" height="60" rx="5" fill="#090d16" stroke="#334155" stroke-width="2"/>';
            parts+='<rect x="5" y="5" width="3" height="3" fill="#64748b"/><rect x="60" y="5" width="3" height="3" fill="#64748b"/><rect x="5" y="56" width="3" height="3" fill="#64748b"/><rect x="60" y="56" width="3" height="3" fill="#64748b"/>';
            parts+='<line x1="8" y1="9" x2="60" y2="9" stroke="#1e293b" stroke-width="1"/><line x1="8" y1="55" x2="60" y2="55" stroke="#1e293b" stroke-width="1"/>';
            if(boss)parts+='<rect x="18" y="4" width="32" height="4" rx="1" fill="#f59e0b" opacity="0.85"/><text x="34" y="7.5" font-size="4" font-family="monospace" font-weight="900" fill="#0f172a" text-anchor="middle">BOSS</text>';

            if(boss&&id==='forge') {
                // B01 熔炉巨兽: 双排高耸排气烟道、重型铁甲底座、明亮熔融炉栅与液压夹钳
                parts+='<rect x="20" y="11" width="7" height="13" fill="#334155" stroke="#475569"/><rect x="41" y="11" width="7" height="13" fill="#334155" stroke="#475569"/><rect x="21" y="13" width="5" height="4" fill="#f97316"/><rect x="42" y="13" width="5" height="4" fill="#f97316"/>';
                parts+='<rect x="16" y="22" width="36" height="31" rx="3" fill="#1e293b" stroke="#64748b" stroke-width="1.5"/>';
                parts+='<rect x="22" y="32" width="24" height="15" rx="2" fill="#ea580c"/><rect x="24" y="34" width="20" height="11" fill="#fde047"/>';
                parts+='<line x1="28" y1="32" x2="28" y2="47" stroke="#9a3412" stroke-width="2"/><line x1="34" y1="32" x2="34" y2="47" stroke="#9a3412" stroke-width="2"/><line x1="40" y1="32" x2="40" y2="47" stroke="#9a3412" stroke-width="2"/>';
                parts+='<rect x="24" y="25" width="20" height="4" fill="#f97316"/>';
                parts+='<rect x="9" y="26" width="7" height="18" rx="2" fill="#475569"/><rect x="52" y="26" width="7" height="18" rx="2" fill="#475569"/><rect x="10" y="36" width="5" height="6" fill="#f59e0b"/><rect x="53" y="36" width="5" height="6" fill="#f59e0b"/>';
            } else if(boss&&id==='weaver') {
                // B02 织网构装: 4向铰接液压蜘蛛足、复眼式多光谱传感器晶阵与激光发射毒针
                parts+='<path d="M16 20L6 32L10 54M22 22L9 44L16 56M52 20L62 32L58 54M46 22L59 44L52 56" stroke="#475569" stroke-width="3" stroke-linecap="round" fill="none"/>';
                parts+='<path d="M16 20L6 32L10 54M52 20L62 32L58 54" stroke="'+tint+'" stroke-width="1.5" fill="none"/>';
                parts+='<polygon points="34,16 46,26 42,46 26,46 22,26" fill="#1e293b" stroke="'+tint+'" stroke-width="2"/>';
                parts+='<circle cx="28" cy="27" r="2.5" fill="#ef4444"/><circle cx="40" cy="27" r="2.5" fill="#ef4444"/><circle cx="34" cy="24" r="3" fill="#22d3ee"/><circle cx="34" cy="35" r="4" fill="#38bdf8"/>';
                parts+='<polygon points="31,46 37,46 34,54" fill="#fde047"/><line x1="34" y1="49" x2="34" y2="55" stroke="#ef4444" stroke-width="2"/>';
            } else if(boss&&id==='prism') {
                // B03 棱镜核心: 3枚环绕悬浮偏折护盾片、八面体高透发光水晶核心与激光放电电极
                parts+='<polygon points="12,24 18,16 22,28" fill="#334155" stroke="#38bdf8" stroke-width="1.5"/>';
                parts+='<polygon points="56,24 50,16 46,28" fill="#334155" stroke="#38bdf8" stroke-width="1.5"/>';
                parts+='<polygon points="30,55 38,55 34,48" fill="#334155" stroke="#38bdf8" stroke-width="1.5"/>';
                parts+='<polygon points="34,12 52,30 34,48 16,30" fill="#1e1b4b" stroke="'+tint+'" stroke-width="2"/>';
                parts+='<polygon points="34,12 34,48 16,30" fill="'+tint+'" opacity="0.4"/>';
                parts+='<polygon points="34,18 45,30 34,42 23,30" fill="#a855f7" stroke="#e9d5ff" stroke-width="1.5"/>';
                parts+='<polygon points="34,24 39,30 34,36 29,30" fill="#f5d0fe"/>';
                parts+='<line x1="16" y1="30" x2="23" y2="30" stroke="#38bdf8" stroke-width="2"/><line x1="45" y1="30" x2="52" y2="30" stroke="#38bdf8" stroke-width="2"/>';
            } else if(boss&&id==='tank') {
                // B04 腐蚀重坦: 重装倾斜钢板甲、履带支重轮、发光生化酸液观测窗与双联喷管
                parts+='<rect x="10" y="44" width="48" height="12" rx="3" fill="#0f172a" stroke="#475569" stroke-width="2"/>';
                parts+='<circle cx="16" cy="50" r="3.5" fill="#334155"/><circle cx="28" cy="50" r="3.5" fill="#334155"/><circle cx="40" cy="50" r="3.5" fill="#334155"/><circle cx="52" cy="50" r="3.5" fill="#334155"/>';
                parts+='<line x1="10" y1="46" x2="58" y2="46" stroke="#64748b" stroke-width="1"/>';
                parts+='<polygon points="13,44 18,28 50,28 55,44" fill="#1e293b" stroke="#64748b" stroke-width="2"/>';
                parts+='<rect x="22" y="20" width="24" height="16" rx="4" fill="#064e3b" stroke="'+tint+'" stroke-width="2"/>';
                parts+='<rect x="24" y="24" width="20" height="10" fill="#10b981"/><circle cx="28" cy="27" r="2" fill="#a7f3d0"/><circle cx="38" cy="30" r="1.5" fill="#a7f3d0"/>';
                parts+='<rect x="18" y="14" width="6" height="10" fill="#334155"/><rect x="44" y="14" width="6" height="10" fill="#334155"/><rect x="19" y="12" width="4" height="3" fill="#34d399"/><rect x="45" y="12" width="4" height="3" fill="#34d399"/>';
            } else if(boss&&id==='clock') {
                // B05 时序泰坦: 黄铜工业外齿环、精密齿轮咬合轮廓、双色钟盘指针与摆锤连杆
                parts+='<circle cx="34" cy="33" r="19" fill="#1e293b" stroke="#78350f" stroke-width="3"/>';
                parts+='<path d="M32 10H36V15H32ZM32 51H36V56H32ZM11 31H16V35H11ZM52 31H57V35H52ZM18 17L21 20L18 23L15 20ZM47 46L50 49L47 52L44 49ZM47 20L50 17L53 20L50 23ZM18 49L21 46L18 43L15 46Z" fill="#b45309"/>';
                parts+='<circle cx="34" cy="33" r="13" fill="#0f172a" stroke="'+tint+'" stroke-width="2"/>';
                parts+='<line x1="34" y1="33" x2="34" y2="24" stroke="#f472b6" stroke-width="2.5" stroke-linecap="round"/><line x1="34" y1="33" x2="41" y2="36" stroke="#fde047" stroke-width="2" stroke-linecap="round"/><circle cx="34" cy="33" r="3" fill="#f43f5e"/>';
                parts+='<line x1="34" y1="46" x2="34" y2="57" stroke="#d97706" stroke-width="2"/><circle cx="34" cy="57" r="3" fill="#f59e0b"/>';
            } else if(boss&&id==='train') {
                // B06 装甲裂车: 黄黑防撞警示排障器犁头、三轴联动连杆动轮、双烟囱与超亮卤素射灯
                parts+='<rect x="14" y="18" width="40" height="24" rx="3" fill="#1e293b" stroke="#64748b" stroke-width="2"/>';
                parts+='<polygon points="12,42 56,42 48,53 20,53" fill="#0f172a" stroke="#ca8a04" stroke-width="2"/>';
                parts+='<line x1="22" y1="42" x2="26" y2="53" stroke="#eab308" stroke-width="2"/><line x1="32" y1="42" x2="36" y2="53" stroke="#eab308" stroke-width="2"/><line x1="42" y1="42" x2="46" y2="53" stroke="#eab308" stroke-width="2"/>';
                parts+='<circle cx="20" cy="42" r="5" fill="#334155" stroke="#94a3b8" stroke-width="1.5"/><circle cx="34" cy="42" r="5" fill="#334155" stroke="#94a3b8" stroke-width="1.5"/><circle cx="48" cy="42" r="5" fill="#334155" stroke="#94a3b8" stroke-width="1.5"/>';
                parts+='<line x1="20" y1="42" x2="48" y2="42" stroke="#f8fafc" stroke-width="2"/>';
                parts+='<rect x="18" y="10" width="8" height="9" fill="#475569"/><rect x="16" y="9" width="12" height="3" fill="#64748b"/>';
                parts+='<circle cx="46" cy="26" r="6" fill="#fef08a" stroke="#ca8a04" stroke-width="2"/><circle cx="46" cy="26" r="3" fill="#ffffff"/>';
            } else if(id==='slime_green') {
                // 绿色史莱姆: 强化耐压生化培养罐、泄压阀与内部发光流体搅拌齿轮
                parts+='<rect x="18" y="18" width="32" height="36" rx="6" fill="#064e3b" stroke="#334155" stroke-width="2"/>';
                parts+='<rect x="20" y="26" width="28" height="26" rx="4" fill="#22c55e"/><circle cx="26" cy="34" r="3" fill="#86efac"/><circle cx="38" cy="42" r="2.5" fill="#86efac"/>';
                parts+='<rect x="24" y="12" width="20" height="7" fill="#475569"/><circle cx="34" cy="15" r="4" fill="#f8fafc" stroke="#334155"/><line x1="34" y1="15" x2="36" y2="13" stroke="#ef4444" stroke-width="1.5"/>';
                parts+='<circle cx="34" cy="38" r="4" fill="#b45309" stroke="#facc15" stroke-width="1.5"/>';
            } else if(id==='slime_blue') {
                // 蓝色史莱姆: 高压等离子放电圆柱电容、双极铜触须与高压电弧
                parts+='<rect x="18" y="18" width="32" height="36" rx="6" fill="#1e3a8a" stroke="#334155" stroke-width="2"/>';
                parts+='<rect x="20" y="24" width="28" height="28" rx="4" fill="#3b82f6"/><circle cx="34" cy="36" r="6" fill="#93c5fd"/>';
                parts+='<rect x="22" y="10" width="4" height="9" fill="#b45309"/><rect x="42" y="10" width="4" height="9" fill="#b45309"/>';
                parts+='<path d="M24 10L30 14L34 8L40 13L44 10" stroke="#fde047" stroke-width="2" fill="none"/>';
            } else if(id==='slime_purple') {
                // 紫色史莱姆: 虚空酸液防爆安瓿瓶、危险品警告黄三角标与腐蚀气泡
                parts+='<rect x="18" y="18" width="32" height="36" rx="6" fill="#3b0764" stroke="#334155" stroke-width="2"/>';
                parts+='<rect x="20" y="26" width="28" height="26" rx="4" fill="#a855f7"/><circle cx="26" cy="36" r="3.5" fill="#e9d5ff"/><circle cx="40" cy="40" r="2" fill="#e9d5ff"/>';
                parts+='<polygon points="34,20 42,32 26,32" fill="#facc15"/><text x="34" y="30.5" font-size="7" font-weight="900" fill="#000" text-anchor="middle">!</text>';
            } else if(id==='demon_eye') {
                // 恶魔眼: 4向稳定翼巡查无人侦查机、超大深红多层光圈光学摄像头
                parts+='<circle cx="34" cy="32" r="18" fill="#1e293b" stroke="#475569" stroke-width="2"/>';
                parts+='<polygon points="34,6 30,14 38,14" fill="#64748b"/><polygon points="34,58 30,50 38,50" fill="#64748b"/><polygon points="6,32 14,28 14,36" fill="#64748b"/><polygon points="58,32 50,28 50,36" fill="#64748b"/>';
                parts+='<circle cx="34" cy="32" r="12" fill="#ef4444" stroke="#991b1b" stroke-width="2"/><circle cx="34" cy="32" r="7" fill="#0f172a"/><circle cx="36" cy="30" r="2.5" fill="#38bdf8"/>';
            } else if(id==='goblin_bomber') {
                // 地精投弹手: 防爆护目头盔、肩扛迫击火箭发射管与引燃引线重装炸弹
                parts+='<rect x="16" y="22" width="36" height="32" rx="4" fill="#1e293b" stroke="#64748b" stroke-width="2"/>';
                parts+='<rect x="20" y="24" width="28" height="12" fill="#334155"/><rect x="22" y="28" width="24" height="4" fill="#f59e0b"/>';
                parts+='<rect x="42" y="10" width="10" height="18" rx="2" fill="#475569" stroke="#94a3b8"/><line x1="42" y1="14" x2="52" y2="14" stroke="#f97316" stroke-width="2"/>';
                parts+='<circle cx="20" cy="42" r="7" fill="#0f172a" stroke="#475569" stroke-width="2"/><path d="M20 35Q22 30 26 31" stroke="#f59e0b" stroke-width="2" fill="none"/><circle cx="26" cy="31" r="2" fill="#ef4444"/>';
            } else if(id==='armored_guard') {
                // 重甲守卫: 钛合金镇暴胸甲、战术光条目镜与电荷巨型棱面防暴塔盾
                parts+='<rect x="14" y="16" width="40" height="38" rx="4" fill="#1e293b" stroke="#64748b" stroke-width="2"/>';
                parts+='<rect x="22" y="20" width="24" height="4" fill="#38bdf8"/>';
                parts+='<polygon points="26,14 48,14 44,54 22,54" fill="#334155" stroke="#38bdf8" stroke-width="2"/>';
                parts+='<path d="M30 22L40 32L34 36L42 46" stroke="#93c5fd" stroke-width="2" fill="none"/>';
            } else if(id==='shaman_healer') {
                // 萨满祭司: 纳米维修科技信标、金光太阳能传输塔与悬浮绿色医疗十字
                parts+='<line x1="34" y1="10" x2="34" y2="48" stroke="#ca8a04" stroke-width="3"/><circle cx="34" cy="10" r="4" fill="#facc15"/>';
                parts+='<polygon points="22,48 46,48 34,22" fill="#1e293b" stroke="#eab308" stroke-width="2"/>';
                parts+='<rect x="31" y="26" width="6" height="18" fill="#4ade80"/><rect x="25" y="32" width="18" height="6" fill="#4ade80"/>';
                parts+='<rect x="32" y="28" width="4" height="14" fill="#ffffff"/><rect x="27" y="33" width="14" height="4" fill="#ffffff"/>';
            } else if(id==='skeleton_archer') {
                // 机械骷髅弓手: 钛合金义体骷髅颅骨、红色瞄准目镜单镜与复合滑轮弓
                parts+='<rect x="22" y="18" width="24" height="24" rx="4" fill="#cbd5e1" stroke="#475569" stroke-width="2"/><rect x="26" y="38" width="16" height="8" fill="#94a3b8"/>';
                parts+='<circle cx="28" cy="27" r="4" fill="#ef4444" stroke="#991b1b" stroke-width="1.5"/><circle cx="40" cy="27" r="3" fill="#0f172a"/><circle cx="28" cy="27" r="1.5" fill="#fef08a"/>';
                parts+='<path d="M52 10Q62 32 52 54" stroke="#b45309" stroke-width="3" fill="none"/><circle cx="52" cy="10" r="2.5" fill="#94a3b8"/><circle cx="52" cy="54" r="2.5" fill="#94a3b8"/>';
                parts+='<line x1="52" y1="10" x2="52" y2="54" stroke="#e2e8f0" stroke-width="1.5"/><line x1="36" y1="32" x2="54" y2="32" stroke="#f59e0b" stroke-width="2"/>';
            } else {
                parts+='<rect x="18" y="20" width="32" height="30" rx="4" fill="'+tint+'"/><rect x="24" y="28" width="6" height="6" fill="#f8fafc"/><rect x="38" y="28" width="6" height="6" fill="#f8fafc"/>';
            }

            return '<svg class="w-16 h-16 shrink-0" viewBox="0 0 68 64" aria-hidden="true" shape-rendering="crispEdges">'+parts+'</svg>';
        }

        `;

src = src.substring(0, oldGuideCreatureStart) + newGuideCreatureCode + src.substring(oldGuideCreatureEnd);
console.log('guideCreatureIcon replaced successfully');

// 2. Upgrade VoxelArtFactory constructor
const oldVoxelConstructorStart = src.indexOf('this.initSprites();\n            // 沿用8×8像素挤压体素');
const oldVoxelConstructorEnd = src.indexOf('getMat(hex, opts = {}) {');

if (oldVoxelConstructorStart === -1 || oldVoxelConstructorEnd === -1) {
    throw new Error('Could not locate VoxelArtFactory constructor in source');
}

const newVoxelConstructorCode = `this.initSprites();

            // 工业武器高精 8×8 挤压体素字形库，覆盖所有 42 把武器
            const weaponGlyphs = {
                sword_broad: ['.....CCC','....CCCC','...CCCCC','..CCCCC.','.DCCCC..','DDDC....','.DD.....','D.......'],
                sword_curved: ['....CCCC','...CCCCC','..CCC...','.CCC....','DCCC....','DDD.....','.D......','D.......'],
                spear: ['......CC','.....CCC','....CCC.','...DCC..','..DD....','.DD.....','DD......','D.......'],
                scythe: ['..CCCCC.','.CCCCCCC','CCC...CC','CC..D...','..DDD...','.DD.....','DD......','D.......'],
                hammer: ['..CCCCCC','.CCCCCC.','.CCCCCC.','..DCC...','..DD....','.DD.....','DD......','D.......'],
                bow: ['..DDDD..','.D...DCC','D....DCC','D....DCC','D....DCC','.D...DCC','..DDDD..','........'],
                gun_rapid: ['........','..DDDDD.','.CCCCCCD','DDDDDCC.','...DD...','...DD...','........','........'],
                gun_heavy: ['........','DDDDDDDD','CCCCCCCD','DDDDDDD.','..DD....','..DD....','........','........'],
                shotgun: ['........','.DDDDDD.','CCCCCCCC','CCCCCCCC','DDDDDDDD','...DD...','........','........'],
                railgun: ['DDDDDDDD','..CCCC..','DDDDDDDD','...DD...','..DCCD..','...DD...','........','........'],
                disc: ['..CCCC..','.CDDDDC.','CD....DC','CD.CC.DC','CD.CC.DC','CD....DC','.CDDDDC.','..CCCC..'],
                prism: ['...CC...','..CCCC..','.CCCCCC.','CCCCCCCC','.CCCCCC.','..CCCC..','...CC...','........'],
                nozzle: ['........','....CCCC','..DCCCCC','.DDDDCC.','.DCC....','..DD....','..DD....','........'],
                trap: ['........','...CC...','..CDDC..','.CDDDDC.','CCDDDDCC','CCCCCCCC','.D....D.','........'],
                turret: ['..DDDD..','.DCCCCD.','DDDDDDDD','...DD...','..D..D..','.D....D.','D......D','........'],
                hive: ['..DDDD..','.DCCCCD.','DC.CC.CD','DCCCCCCD','DC.CC.CD','.DCCCCD.','..DDDD..','........'],
                ring: ['..DDDD..','.DCCCCD.','DC....CD','DC.DD.CD','DC.DD.CD','DC....CD','.DCCCCD.','..DDDD..'],
                anchor: ['...DD...','..DCCD..','...DD...','...DD...','D..DD..D','DD.DD.DD','.DDDDDD.','..DDDD..'],
                gear: ['.D.DD.D.','DDCCCCDD','.DC..CD.','DCC..CCD','DCC..CCD','.DC..CD.','DDCCCCDD','.D.DD.D.'],
                wand: ['.....CCC','....CCCC','.....CCC','...DD...','..DD....','.DD.....','DD......','D.......']
            };

            const getWeaponGlyphKind = (def) => {
                if (def.id === 'boss_hammer') return 'hammer';
                if (def.id === 'boss_hive' || def.id === 'scavenger_bee') return 'hive';
                if (def.id === 'boss_prism' || def.id === 'pulse_chain') return 'prism';
                if (def.id === 'gravity_anchor') return 'anchor';
                if (def.id === 'tracking_gear') return 'gear';
                if (def.id === 'pulse_ring') return 'ring';
                if (def.id === 'shard_blaster') return 'shotgun';
                if (def.id === 'heavy_bolt_rifle') return 'gun_heavy';
                if (def.id === 'bind_spear' || def.id === 'cinder_spear') return 'spear';
                if (def.id === 'sentry') return 'turret';
                if (def.id === 'trigger_wand' || def.id === 'seal_needle') return 'wand';
                if (def.behavior === 'corrosion' || def.behavior === 'vortex') return 'nozzle';
                if (def.behavior === 'trap') return 'trap';
                if (def.behavior === 'charge') return 'railgun';
                if (def.behavior === 'scythe') return 'scythe';
                if (def.behavior === 'thrust') return 'spear';
                if (def.behavior === 'sweep') return 'sword_curved';
                if (['sweep_beam', 'charge_melee'].includes(def.behavior)) return 'sword_broad';
                if (def.behavior === 'rapid') return 'gun_rapid';
                if (['proj', 'burst'].includes(def.behavior)) return def.sprite.includes('bow') ? 'bow' : 'gun_heavy';
                if (def.behavior === 'scatter') return 'shotgun';
                if (['boomerang', 'zenith', 'orbit', 'bounce'].includes(def.behavior)) return 'disc';
                return 'sword_broad';
            };

            for (const def of Object.values(WEAPONS_DB)) {
                const kind = getWeaponGlyphKind(def);
                const palette = { C: '#' + def.color.toString(16).padStart(6, '0'), D: '#94a3b8' };
                // 专属武器 ID 注册，确保每一把武器在图鉴和背包均拥有专属像素图
                this.register(def.id, weaponGlyphs[kind], palette);
                if (!this.patterns[def.sprite]) {
                    this.register(def.sprite, weaponGlyphs[kind], palette);
                }
            }

            // 12 类工业配件高精像素字形库，全面覆盖 50 件道具
            const itemTemplates = {
                chip: ['..DDDD..','.DCCCCD.','DCY..YCD','DC.YY.CD','DC.YY.CD','DCY..YCD','.DCCCCD.','..DDDD..'],
                battery: ['..DDDD..','..DYYD..','.DCCCCD.','.DCYYCD.','.DCYYCD.','.DCYYCD.','.DCCCCD.','.DDDDDD.'],
                armor_plate: ['DDDDDDDD','DCCCCCCD','DCY..YCD','DCCCCCCD','DCCCCCCD','DCY..YCD','DCCCCCCD','DDDDDDDD'],
                lens: ['..DDDD..','.DCCCCD.','DCCYYCCD','DCYYYYCD','DCYYYYCD','DCCYYCCD','.DCCCCD.','..DDDD..'],
                valve: ['.DDDDDD.','..DCCCD.','..DC.CD.','..DCCCD.','...DCD..','..DYYD..','.DYYYYD.','.DDDDDD.'],
                gear: ['.D.DD.D.','DDCCCCDD','.DC..CD.','DCCYYCCD','DCCYYCCD','.DC..CD.','DDCCCCDD','.D.DD.D.'],
                syringe: ['.....DD.','....DCC.','...DCCD.','..DYYD..','.DYYD...','DYYD....','.DD.....','D.......'],
                shield: ['DDDDDDDD','DCCCCCCD','DCCYYCCD','.DCCCCD.','.DCCCCD.','..DCCD..','..DCCD..','...DD...'],
                boots: ['...DDDD.','...DCCCD','..DCCCCD','.DCCCCCD','DDDDDDDD','DYYYYYYD','.DDDDDD.','........'],
                antennae: ['....DD..','...DCCD.','...DCCD.','..DCCCCD','.D.DCCD.','D..DCCD.','...DCCD.','..DDDDDD'],
                insulator: ['DDDDDDDD','.DCCCCD.','.DDDDDD.','.DCCCCD.','.DDDDDD.','.DCCCCD.','.DDDDDD.','DDDDDDDD'],
                module: ['DDDDDDDD','DCCCCCCD','DCY.Y.CD','DCCCCCCD','DCY.Y.CD','DCCCCCCD','DYYYYYYD','DDDDDDDD']
            };

            const getItemTemplateAndPalette = (item) => {
                const tierColors = {
                    1: { border: '#64748b', core: '#94a3b8', accent: '#f8fafc' },
                    2: { border: '#0284c7', core: '#38bdf8', accent: '#bae6fd' },
                    3: { border: '#7c3aed', core: '#c084fc', accent: '#f5d0fe' },
                    4: { border: '#d97706', core: '#fbbf24', accent: '#fef08a' }
                };
                const tCol = tierColors[item.tier] || tierColors[1];
                let kind = 'module', c = tCol.core, d = tCol.border, y = tCol.accent;

                if (item.id === 'insulator') { kind = 'insulator'; c = '#7dd3fc'; d = '#0369a1'; y = '#e0f2fe'; }
                else if (item.id === 'long_burn') { kind = 'battery'; c = '#a3e635'; d = '#4d7c0f'; y = '#fef08a'; }
                else if (item.id === 'cold_sleeve') { kind = 'insulator'; c = '#67e8f9'; d = '#0891b2'; y = '#cffafe'; }
                else if (item.id === 'blast_fuse') { kind = 'valve'; c = '#fb923c'; d = '#c2410c'; y = '#fef08a'; }
                else if (item.id === 'target_antenna') { kind = 'antennae'; c = '#eab308'; d = '#a16207'; y = '#fef9c3'; }
                else if (item.id === 'voltage_frame') { kind = 'chip'; c = '#facc15'; d = '#ca8a04'; y = '#ffffff'; }
                else if (item.id === 'crit_converter') { kind = 'lens'; c = '#c084fc'; d = '#7e22ce'; y = '#f472b6'; }
                else if (item.id === 'range_ring') { kind = 'gear'; c = '#38bdf8'; d = '#0284c7'; y = '#bae6fd'; }
                else if (item.id === 'crit_lens') { kind = 'lens'; c = '#38bdf8'; d = '#0369a1'; y = '#f0fdf4'; }
                else if (item.id === 'hermes') { kind = 'boots'; c = '#22c55e'; d = '#15803d'; y = '#facc15'; }
                else if (item.id === 'regen_band') { kind = 'syringe'; c = '#ef4444'; d = '#991b1b'; y = '#4ade80'; }
                else if (item.id === 'shackle') { kind = 'armor_plate'; c = '#94a3b8'; d = '#475569'; y = '#f1f5f9'; }
                else if (item.id === 'shark_tooth') { kind = 'gear'; c = '#e2e8f0'; d = '#64748b'; y = '#38bdf8'; }
                else if (item.id === 'horseshoe') { kind = 'chip'; c = '#facc15'; d = '#ca8a04'; y = '#ffffff'; }
                else if (item.id === 'claws') { kind = 'module'; c = '#f97316'; d = '#9a3412'; y = '#fed7aa'; }
                else if (item.id === 'obsidian') { kind = 'armor_plate'; c = '#7c3aed'; d = '#3b0764'; y = '#c084fc'; }
                else if (item.id === 'mana_flower') { kind = 'chip'; c = '#818cf8'; d = '#4338ca'; y = '#38bdf8'; }
                else if (item.id === 'ranger_emb') { kind = 'lens'; c = '#38bdf8'; d = '#0369a1'; y = '#facc15'; }
                else if (item.id === 'vamp_ring') { kind = 'syringe'; c = '#ef4444'; d = '#7f1d1d'; y = '#fca5a5'; }
                else if (item.id === 'cthulhu_sh') { kind = 'shield'; c = '#a855f7'; d = '#581c87'; y = '#f472b6'; }
                else if (item.id === 'frost_boots') { kind = 'boots'; c = '#38bdf8'; d = '#0284c7'; y = '#f8fafc'; }
                else if (item.id === 'greedy_ring') { kind = 'gear'; c = '#facc15'; d = '#a16207'; y = '#fef08a'; }
                else if (item.id === 'destroyer') { kind = 'battery'; c = '#f43f5e'; d = '#9f1239'; y = '#facc15'; }
                else if (item.id === 'ankh_shield') { kind = 'shield'; c = '#facc15'; d = '#854d0e'; y = '#38bdf8'; }
                else if (item.id === 'wings_solar') { kind = 'antennae'; c = '#f97316'; d = '#9a3412'; y = '#fef08a'; }
                else if (item.id === 'celestial') { kind = 'battery'; c = '#e879f9'; d = '#86198f'; y = '#38bdf8'; }
                else if (item.id === 'blade_mount') { kind = 'module'; c = '#94a3b8'; d = '#475569'; y = '#f59e0b'; }
                else if (item.id === 'narrow_ring') { kind = 'gear'; c = '#0ea5e9'; d = '#0369a1'; y = '#7dd3fc'; }
                else if (item.id === 'thermal_film') { kind = 'armor_plate'; c = '#eab308'; d = '#a16207'; y = '#fef08a'; }
                else if (item.id === 'rest_prism') { kind = 'lens'; c = '#c084fc'; d = '#6b21a8'; y = '#38bdf8'; }
                else if (item.id === 'credit_voucher') { kind = 'module'; c = '#facc15'; d = '#854d0e'; y = '#ffffff'; }
                else if (item.id === 'wax_clip') { kind = 'module'; c = '#dc2626'; d = '#7f1d1d'; y = '#fde047'; }
                else if (item.id === 'salvage_license') { kind = 'module'; c = '#10b981'; d = '#065f46'; y = '#fef08a'; }
                else if (item.id === 'throttle_valve') { kind = 'valve'; c = '#f59e0b'; d = '#b45309'; y = '#fef3c7'; }
                else if (item.id === 'shelf_index') { kind = 'module'; c = '#6366f1'; d = '#3730a3'; y = '#facc15'; }
                else if (item.id === 'traction_joint') { kind = 'gear'; c = '#64748b'; d = '#334155'; y = '#94a3b8'; }
                else if (item.id === 'bearing_cap') { kind = 'gear'; c = '#94a3b8'; d = '#475569'; y = '#facc15'; }
                else if (item.id === 'slide_axle') { kind = 'module'; c = '#cbd5e1'; d = '#475569'; y = '#38bdf8'; }
                else if (item.id === 'tread_sole') { kind = 'boots'; c = '#334155'; d = '#0f172a'; y = '#eab308'; }
                else if (item.id === 'needle_box') { kind = 'syringe'; c = '#f43f5e'; d = '#881337'; y = '#e2e8f0'; }
                else if (item.id === 'relay_pickup') { kind = 'chip'; c = '#06b6d4'; d = '#0e7490'; y = '#facc15'; }
                else if (item.id === 'battery_cell') { kind = 'battery'; c = '#10b981'; d = '#047857'; y = '#fde047'; }
                else if (item.id === 'brake_buckle') { kind = 'valve'; c = '#ef4444'; d = '#991b1b'; y = '#f1f5f9'; }
                else if (item.id === 'crit_glass') { kind = 'lens'; c = '#a855f7'; d = '#6b21a8'; y = '#38bdf8'; }
                else if (item.id === 'phase_rectifier') { kind = 'chip'; c = '#3b82f6'; d = '#1d4ed8'; y = '#f59e0b'; }
                else if (item.id === 'fuse_breaker') { kind = 'battery'; c = '#f59e0b'; d = '#b45309'; y = '#ef4444'; }
                else if (item.id === 'parasite_valve') { kind = 'valve'; c = '#9333ea'; d = '#581c87'; y = '#ef4444'; }
                else if (item.id === 'silent_mount') { kind = 'module'; c = '#475569'; d = '#1e293b'; y = '#94a3b8'; }
                else if (item.id === 'void_box') { kind = 'battery'; c = '#c084fc'; d = '#581c87'; y = '#facc15'; }
                else if (item.id === 'end_counter') { kind = 'module'; c = '#10b981'; d = '#047857'; y = '#22d3ee'; }

                return { pattern: itemTemplates[kind] || itemTemplates.module, palette: { C: c, D: d, Y: y } };
            };

            // 注册所有 50 件道具专属图案，解决无 targets 道具无专属 sprite 缺失问题
            for (const item of ITEMS_DB) {
                const info = getItemTemplateAndPalette(item);
                this.register(item.id, info.pattern, info.palette);
                this.register('item_' + item.id, info.pattern, info.palette);
                if (item.targets) {
                    this.register(item.sprite, info.pattern, info.palette);
                }
            }
        }

        `;

src = src.substring(0, oldVoxelConstructorStart) + newVoxelConstructorCode + src.substring(oldVoxelConstructorEnd);
console.log('VoxelArtFactory constructor replaced successfully');

// 3. Upgrade renderContentGuide method
const oldRenderGuideStart = src.indexOf('renderContentGuide() {');
const oldRenderGuideEnd = src.indexOf('closeWeaponGuide() {');

if (oldRenderGuideStart === -1 || oldRenderGuideEnd === -1) {
    throw new Error('Could not locate renderContentGuide in source');
}

const newRenderGuideCode = `renderContentGuide() {
            const category=this.guideCategory||'weapons',labels={weapons:'武器',items:'道具',bosses:'Boss',enemies:'小怪'},counts={weapons:Object.keys(WEAPONS_DB).length,items:ITEMS_DB.length,bosses:Object.keys(BOSSES_DB).length,enemies:Object.keys(ENEMIES_DB).length};
            const tabIcons={weapons:'⚔️ ',items:'⚙️ ',bosses:'👹 ',enemies:'👾 '};
            const wave=this.guideWave||5,difficulty=this.guideDifficulty||1,query=(this.guideSearch||'').trim().toLowerCase();
            const entries=category==='weapons'?Object.values(WEAPONS_DB):category==='items'?ITEMS_DB:Object.entries(category==='bosses'?BOSSES_DB:ENEMIES_DB).map(([id,def])=>({id,...def}));
            const filtered=entries.filter(def=>def.name.toLowerCase().includes(query));
            document.getElementById('content-guide-title').textContent='巡行内容图鉴 · '+labels[category];
            document.getElementById('content-guide-tabs').innerHTML=Object.entries(labels).map(([id,name])=>'<button class="terra-btn px-3 py-2 text-xs '+(id===category?'terra-btn-blue shadow-lg border-sky-400/50':'')+'" aria-pressed="'+(id===category)+'" onclick="window.openContentGuide(\\''+id+'\\')">'+(tabIcons[id]||'')+name+'图鉴 ('+counts[id]+')</button>').join('');
            document.getElementById('content-guide-wave').value=wave;document.getElementById('content-guide-difficulty').value=difficulty;
            const intros={weapons:'中性16属性、基础暴击5%、无道具/核心、最低品质的基准值；当前构筑请看商店攻击详情。',items:'展示实际效果、代价、持有上限和最早开放波次；标价按预览波次估算，不代表该波必定出售。',bosses:'按预览波次及之后最近的Boss波计算（如第6波按第10波）；生命随该波和难度变化；伤害为护甲/闪避前原始伤害，难度只增加生命。每5波从已实装Boss随机出场，不掉宝箱。',enemies:'数值与生成怪物共享配置。生命随波次和难度变化，接触及箭矢伤害为防御前原始值；出场波次是加入随机池的时间，颜色变体单独列出。'};
            document.getElementById('content-guide-intro').textContent=intros[category]+' 图鉴期间所有战斗计时暂停；预览不会改变本局难度、波次或奖励随机数。';
            document.getElementById('content-guide-count').textContent='显示 '+filtered.length+' / '+entries.length+' · 预览第'+wave+'波 / 难度'+difficulty;
            document.getElementById('weapon-guide-cards').innerHTML=filtered.map(def=>{
                const head='<h3 class="font-bold text-emerald-300 text-sm tracking-wide">'+def.name+'</h3>';
                if(category==='weapons'){
                    const iconUrl=this.art.urls[def.id]||this.art.urls[def.sprite];
                    return '<article class="terra-card p-3 border border-slate-700/80 bg-slate-900/90 hover:border-sky-500/50 transition-colors shadow-lg"><div class="flex gap-2.5 items-center pb-2 border-b border-slate-800"><div class="w-10 h-10 rounded bg-slate-950 p-1 border border-slate-700 flex items-center justify-center shrink-0 shadow-inner"><img class="w-8 h-8 pixel-icon" src="'+iconUrl+'"></div><div class="flex-1">'+head+(def.exclusiveBossId?' <span class="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">专属改装</span>':'')+'</div></div>'+this.weaponDetailHtml({id:def.id,tier:def.minTier},true)+'</article>';
                }
                if(category==='items'){
                    const f=this.getItemFacts(def,wave);
                    const iconUrl=this.art.urls[def.id]||this.art.urls['item_'+def.id]||this.art.urls[def.sprite];
                    return '<article class="terra-card tier-'+f.tier+' p-3 text-xs space-y-2 border border-slate-700/80 bg-slate-900/90 hover:border-amber-500/40 transition-colors shadow-lg"><div class="flex items-center gap-2.5 pb-2 border-b border-slate-800"><div class="w-12 h-12 rounded bg-slate-950 p-1 border border-slate-700 flex items-center justify-center shrink-0 shadow-inner"><img class="w-10 h-10 pixel-icon" src="'+iconUrl+'"></div><div class="flex-1">'+head+'<div class="text-xs text-amber-200/90 font-mono mt-0.5">'+f.tier+'阶 · 第'+f.unlock+'波起 · 最多'+f.limit+'件</div></div></div><p class="text-slate-200">'+f.desc+'</p>'+(f.stats?'<p class="text-slate-300 font-mono">属性变化：'+f.stats+'</p>':'<p class="text-slate-400">机制配件：不直接增加角色基础属性。</p>')+(f.targets.length?'<p class="text-sky-300 font-mono">适用：'+f.targets.join('、')+'</p>':'')+'<p class="text-amber-300/90 font-mono">预览商店价 '+f.price+'晶币 · '+(wave<f.unlock?'该波尚未开放':'达到开放条件')+' · 本局持有'+f.owned+'/'+f.limit+'</p>'+(f.cosmetic?'<p class="text-slate-400">包含角色外观；具体战斗效果以上述规则为准。</p>':'')+'</article>';
                }
                if(category==='bosses'){
                    const f=this.getBossFacts(def.id,wave,difficulty);
                    return '<article class="terra-card p-3 text-xs space-y-2 border border-slate-700/80 bg-slate-900/90 hover:border-rose-500/40 transition-colors shadow-lg"><div class="flex gap-3 items-center pb-2 border-b border-slate-800">'+this.guideCreatureIcon(def.id,def.color,true)+'<div class="flex-1">'+head+'<p class="text-amber-300 font-mono mt-0.5">第'+f.encounterWave+'波 · 生命 '+f.hp+' · 接触 '+f.contactDamage+' · 移速 '+f.speed+'</p></div></div><p class="text-slate-300">预警'+f.warning+'秒 / 硬直'+f.recovery+'秒；半血追击间隔'+f.chase+'→'+f.rageChase+'秒。</p>'+f.skills.map(skill=>'<div class="border-t border-slate-800 pt-2"><b class="text-amber-200">'+skill.name+'</b><p class="text-slate-300">'+skill.desc+'</p><p class="text-orange-300 font-mono">'+(skill.damage===null?'幼体伤害'+f.droneDamage+'；生命max(10，Boss生命×1.2%)，无奖励，'+f.droneLife+'秒后消失。':'原始伤害 '+skill.damage+' / 半血 '+skill.rageDamage)+'</p></div>').join('')+'<p class="text-sky-300 border-t border-slate-800/80 pt-1.5 font-mono">专属掉落：'+WEAPONS_DB[f.weapon].name+'。保留才开放改装；专武详情见武器页。</p></article>';
                }
                const f=getEnemyEncounterStats(def.id,wave,difficulty);
                return '<article class="terra-card p-3 text-xs space-y-2 border border-slate-700/80 bg-slate-900/90 hover:border-emerald-500/40 transition-colors shadow-lg"><div class="flex gap-3 items-center pb-2 border-b border-slate-800">'+this.guideCreatureIcon(def.id,def.color)+'<div class="flex-1">'+head+'<p class="text-amber-300 font-mono mt-0.5">生命 '+Number(f.hp.toFixed(2))+' · 接触 '+f.dmg+' · 移速 '+f.speed+'</p></div></div><p class="text-slate-300">第'+def.unlockWave+'波加入随机池 · 碰撞半径'+f.radius+(wave<def.unlockWave?' · 预览波次尚未开放':'')+'</p><p class="text-slate-300">'+def.tactic+'</p>'+(def.behavior==='archer'?'<p class="text-orange-300 font-mono">箭矢原始伤害 '+f.dmg+'，射击间隔2.4秒；同时保留接触伤害。</p>':'')+'<p class="text-slate-400">基础掉落权重 '+f.gold+'；实际晶币受本波发行预算、比例与小额累计影响，不是每只固定到账数量。</p></article>';
            }).join('')||'<p class="text-slate-300 p-4">没有匹配的条目，请修改搜索名称。</p>';
        }

        `;

src = src.substring(0, oldRenderGuideStart) + newRenderGuideCode + src.substring(oldRenderGuideEnd);
console.log('renderContentGuide replaced successfully');

// 4. Update shop and inventory item image lookups to support item.id
src = src.replace(
    '<img src="${this.art.urls[it.sprite]}" class="w-9 h-9 bg-slate-950 p-1 rounded border border-slate-700 pixel-icon">',
    '<img src="${this.art.urls[it.id] || this.art.urls[it.sprite]}" class="w-9 h-9 bg-slate-950 p-1 rounded border border-slate-700 pixel-icon">'
);
src = src.replace(
    '<img src="${this.art.urls[chosen.sprite]}" class="w-12 h-12 bg-slate-950 p-1.5 rounded border border-slate-700 pixel-icon">',
    '<img src="${this.art.urls[chosen.id] || this.art.urls[chosen.sprite]}" class="w-12 h-12 bg-slate-950 p-1.5 rounded border border-slate-700 pixel-icon">'
);
src = src.replace(
    '<img src="${this.art.urls[it.sprite]}" class="w-4 h-4 pixel-icon"> ${it.name}',
    '<img src="${this.art.urls[it.id] || this.art.urls[it.sprite]}" class="w-4 h-4 pixel-icon"> ${it.name}'
);

fs.writeFileSync(targetFile, src, 'utf8');
console.log('Updated terrabrotato.html length:', src.length);
console.log('Done!');
