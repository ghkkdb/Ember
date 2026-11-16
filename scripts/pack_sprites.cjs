const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const spritesDir = path.join(rootDir, 'assets', 'sprites');
const manifestPath = path.join(spritesDir, 'sprites_manifest.json');

// Read game DBs for auto-enriching metadata
const html = fs.readFileSync(path.join(rootDir, 'terrabrotato.html'), 'utf8');

const wpnMatch = html.match(/const WEAPONS_DB\s*=\s*\{([\s\S]*?)\n\s*\};/);
const WEAPONS_DB = eval('({' + wpnMatch[1] + '})');

const itemMatch = html.match(/const ITEMS_DB\s*=\s*(\[[\s\S]*?\]);/);
const ITEMS_DB = eval(itemMatch[1]);

const coreMatch = html.match(/const CORE_RELICS\s*=\s*Object\.freeze\(\{([\s\S]*?)\n\s*\}\);/);
const CORE_RELICS = eval('({' + coreMatch[1] + '})');

const files = fs.readdirSync(spritesDir).filter(f => f.endsWith('.png'));

// Hand-curated definitions for heroes, enemies, bosses
const baseDefinitions = {
  // 6 Heroes
  char_guide: { category: 'hero', id: 'guide', name: '巡线者', size: 32, desc: '基础全能型侦察兵，翠绿轻型装甲，配备感应天线与目镜' },
  char_warrior: { category: 'hero', id: 'warrior', name: '压铸卫', size: 32, desc: '重甲近战坦克，深绯合金重铠，宽肩甲、双排排气烟囱与熔融面罩' },
  char_ranger: { category: 'hero', id: 'ranger', name: '远测手', size: 32, desc: '远程战术射手，深蓝流线型外骨骼，水平双联瞄准镜与长距天线' },
  char_mage: { category: 'hero', id: 'mage', name: '弧流师', size: 32, desc: '能量高爆法师，深紫虚空聚能铠，尖顶导流战盔与悬浮离子导能晶石' },
  char_ninja: { category: 'hero', id: 'ninja', name: '疾行客', size: 32, desc: '极速刺客，黑曜石潜行贴身甲，单红光瞬逝目镜与飘逸能量围巾' },
  char_summoner: { category: 'hero', id: 'summoner', name: '构装师', size: 32, desc: '无人机母舰工程师，烈阳金装甲，工程护目镜与伴随护卫浮游机' },

  // 8 Enemies
  enemy_green_slime: { category: 'enemy', id: 'slime_green', name: '机械凝胶罐 (绿)', size: 32, desc: '基础自爆凝胶罐，翠绿凝胶，内部黄铜齿轮与顶部密封螺栓' },
  enemy_blue_slime: { category: 'enemy', id: 'slime_blue', name: '等离子电容 (蓝)', size: 32, desc: '高压电容罐，高能天蓝等离子核心，顶端双紫铜放电极与高压电弧' },
  enemy_purple_slime: { category: 'enemy', id: 'slime_purple', name: '生化废料袋 (紫)', size: 32, desc: '生化剧毒废料袋，高压紫色剧毒气囊，生化黄色警示标与顶部泄压阀' },
  enemy_demon_eye: { category: 'enemy', id: 'demon_eye', name: '多光谱侦查眼', size: 32, desc: '空中巡逻浮游眼，四向铰接式钛金导流外罩，红宝石激光镜头与液压数据线缆' },
  enemy_goblin_bomber: { category: 'enemy', id: 'goblin_bomber', name: '迫击工兵', size: 32, desc: '地底工兵，焊工护目面罩，肩扛废料迫击炮管与引信火花炸药罐' },
  enemy_armored_guard: { category: 'enemy', id: 'armored_guard', name: '防暴镇压泰坦', size: 48, desc: '重型精锐防暴机体，折叠钛合金防暴大盾，黄色黑斜线警戒斑马纹与高压电击矛' },
  enemy_shaman_healer: { category: 'enemy', id: 'shaman_healer', name: '修复维修基站', size: 48, desc: '精锐战术信标，双层反向旋转黄铜八面体，翡翠绿纳米修复光束与太阳能集能翼' },
  enemy_skeleton_archer: { category: 'enemy', id: 'skeleton_archer', name: '机能骷髅巡兵', size: 32, desc: '外骨骼骨骸斥候，钛合金颅骨，单眼红外狙击瞄准激光与复合能量滑轮弓' },

  // 6 Boss Titans
  boss_forge: { category: 'boss', id: 'forge', name: '裂砧执刑者 (熔炉泰坦)', size: 64, desc: '高耸铸铁冶炼高炉躯干、白炽发光炉栅（内部熔岩翻滚）、右臂重型压铸砧、左臂液压冶金夹钳' },
  boss_weaver: { category: 'boss', id: 'weaver', name: '鸣砂织母 (织网构装)', size: 64, desc: '三足重型液压铰接蜘蛛机甲、顶部 360° 自转雷达穹顶、下挂双联多波段光纤激光编织发射枪' },
  boss_prism: { category: 'boss', id: 'prism', name: '棱镜巡弋机 (棱面核心)', size: 64, desc: '磁约束悬浮正八面体聚能发光水晶核心、外层 3 块环绕自转的合金磁浮护盾反射板' },
  boss_tank: { category: 'boss', id: 'tank', name: '潮蚀容器', size: 80, desc: '铰接式双联履带底盘（动轮滚动）、透明耐压生化酸液大罐（内部冒绿光气泡）、双联气动喷嘴与黄铜压力表盘' },
  boss_clock: { category: 'boss', id: 'clock', name: '逆相钟匠', size: 80, desc: '工业钟楼机械偶巨像、胸前咬合联动的三组黄铜齿轮、发光罗马数字钟面表盘、左手持平衡摆轮长枪、右手持遮断盾' },
  boss_train: { category: 'boss', id: 'train', name: '灰穹列车', size: 96, desc: '重型末日装甲机车头、前方巨大 V 型重装排障铲角（黄黑相间警示斜纹）、三轴联动连杆动轮、双联刺目卤素探照灯' },

  // Biomes & Props & Icons
  tile_forest: { category: 'environment', id: 'forest', name: '绿荫边庭 - 无缝工业地板', size: 32, desc: '青灰铸钢地板 + 嵌合苔藓铜锈纹理 + 浅绿发光能量槽' },
  tile_hallow: { category: 'environment', id: 'hallow', name: '镜井天池 - 无缝工业地板', size: 32, desc: '高反光镀铬银镜钢板 + 浅蓝超导冷却液细槽' },
  tile_corruption: { category: 'environment', id: 'corruption', name: '鸣砂裂谷 - 无缝工业地板', size: 32, desc: '黄铜锈蚀钢板 + 工业废气通风网格 + 琥珀橙发光地脉' },
  tile_underworld: { category: 'environment', id: 'underworld', name: '熔火炉庭 - 无缝工业地板', size: 32, desc: '黑曜石耐火耐热重砖 + 裂隙白炽熔岩发光回路' },
  prop_forest_crate: { category: 'obstacle', id: 'prop_forest', name: '绿荫边庭 - 战术复合补给箱', size: 32, desc: '装甲补给箱，内置晶币与微型医疗凝胶' },
  prop_hallow_pylon: { category: 'obstacle', id: 'prop_hallow', name: '镜井天池 - 冷却电容储能塔', size: 32, desc: '高能电容储能塔，受损破裂释放电弧' },
  prop_corruption_vent: { category: 'obstacle', id: 'prop_corruption', name: '鸣砂裂谷 - 工业排气过滤箱', size: 32, desc: '沉砂机械过滤箱，防爆碳化钨外壳' },
  prop_underworld_forge: { category: 'obstacle', id: 'prop_underworld', name: '熔火炉庭 - 重型出铁压铸桩', size: 32, desc: '废渣高温出铁口与重型工业防爆管桩' },
  app_icon: { category: 'branding', id: 'app_icon', name: '《余烬回路》游戏主图标', size: 64, desc: '微型聚变反应堆 + 环绕咬合工业发光齿轮回路与余烬火花' }
};

const manifest = {
  version: '2.0.0',
  generatedAt: new Date().toISOString(),
  totalAssets: files.length,
  categories: {
    hero: 6,
    enemy: 8,
    boss: 6,
    weapon: 42,
    item: 50,
    core: 12,
    environment: 4,
    obstacle: 4,
    branding: 1
  },
  assets: {}
};

for (const file of files) {
  const key = file.replace('.png', '');
  const filePath = path.join(spritesDir, file);
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  const dataUri = `data:image/png;base64,${base64}`;

  let def = baseDefinitions[key];

  if (!def) {
    if (key.startsWith('wpn_')) {
      const wpnId = key.replace('wpn_', '');
      const wInfo = WEAPONS_DB[wpnId] || {};
      def = {
        category: 'weapon',
        id: wpnId,
        name: wInfo.name || wpnId,
        size: 32,
        desc: wInfo.desc || '',
        synergy: wInfo.synergy || [],
        color: wInfo.color ? `#${wInfo.color.toString(16).padStart(6, '0')}` : '#ffffff'
      };
    } else if (key.startsWith('item_')) {
      const itemId = key.replace('item_', '');
      const itInfo = ITEMS_DB.find(i => i.id === itemId) || {};
      def = {
        category: 'item',
        id: itemId,
        name: itInfo.name || itemId,
        tier: itInfo.tier || 1,
        size: 32,
        desc: itInfo.desc || '',
        color: itInfo.color ? `#${itInfo.color.toString(16).padStart(6, '0')}` : '#ffffff'
      };
    } else if (key.startsWith('core_')) {
      const coreId = key.replace('core_', '');
      const cInfo = CORE_RELICS[coreId] || {};
      def = {
        category: 'core',
        id: coreId,
        name: cInfo.name || coreId,
        size: 32,
        desc: cInfo.desc || ''
      };
    } else {
      def = {
        category: 'other',
        id: key,
        name: key,
        size: 32,
        desc: ''
      };
    }
  }

  manifest.assets[key] = {
    ...def,
    filename: file,
    byteLength: buffer.length,
    dataUri
  };
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`Successfully packed ${files.length} assets into manifest: ${manifestPath}`);
