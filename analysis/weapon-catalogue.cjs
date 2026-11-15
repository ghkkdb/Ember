// 从产品方法生成武器说明，避免文档手填数值与游戏逐渐分离。
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {setup}=require('./combat-benchmark.cjs');
const root=path.join(__dirname,'..'),{app,context}=setup(11);
const {defs,cores,stats}=vm.runInContext('({defs:Object.values(WEAPONS_DB),cores:CORE_RELICS,stats:Object.fromEntries(STAT_META.map(s=>[s.key,s.key===\'critChance\'?5:0]))})',context);
stats.maxHp=25;app.stats=stats;app.ownedItems=[];app.selectedCoreId=null;
const sourceSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'terrabrotato.html'))).digest('hex');
const records=defs.map(def=>{
    app.selectedCoreId=null;const weapon={id:def.id,tier:def.minTier};
    const baseline=app.getWeaponFacts(weapon,stats);
    const tiers=def.exclusiveBossId?[{tier:'专属',damage:baseline.damage}]:Array.from({length:5-def.minTier},(_,i)=>{const tier=def.minTier+i;return {tier,damage:app.getWeaponFacts({id:def.id,tier},stats).damage};});
    const variants=baseline.cores.map(core=>{app.selectedCoreId=core;return {core,name:cores[core].name,...app.getWeaponFacts(weapon,stats)};});
    return {weaponId:def.id,exclusiveBossId:def.exclusiveBossId||null,baseline,tiers,variants};
});
const result={sourceSha256,basis:'中性16属性，仅角色基础暴击5%；无羁绊、无道具、无强化。最低品质，0范围和0攻速；周期为稳态释放间隔，不包含首次等待、弹道飞行或走位。',records};
fs.writeFileSync(path.join(__dirname,'weapon-catalogue-v1.11.json'),JSON.stringify(result,null,2));
const fmt=n=>Number(n.toFixed(3)).toString();
const coreNames=f=>f.cores.map(id=>cores[id].name).join('、');
const lines=['# 1.11 武器攻击、数值与核心适配','',`源码SHA-256：\`${sourceSha256}\`。由\`node analysis/weapon-catalogue.cjs\`读取当前产品配置生成。`,'',result.basis,'','“伤害”是一次释放的分段预算，不是实战DPS；箭头为连锁，不同目标才能吃到后续伤害。往返攻击可在去返各命中一次。所有距离单位均为世界单位，已含70%基础范围缩减。','',
'## '+records.length+'款武器总表','',
'| 武器 | 攻击方式 | 最低品质 | 伤害/分段 | 释放周期（秒） | 索敌距离 | 适配核心 |',
'| --- | --- | --- | --- | --- | --- | --- |',
...records.map(({baseline:f,exclusiveBossId})=>`| ${f.name} | ${f.action} | ${exclusiveBossId?'专属':f.tier+'阶'} | ${f.damage} | ${fmt(f.cadence)} | ${fmt(f.reach)} | ${coreNames(f)} |`),
'','## 属性、品质与暴击','',
'基础伤害按品质倍率1 / 1.5 / 2.25 / 3.4计算，并除去武器最低品质的倍率，避免原生高阶重复放大。属性系数按实际品质再乘1 / 1.35 / 1.8 / 2.4。',
'','主伤先计算：`round((当前品质基础伤害 + 各伤害属性×对应品质系数) × (1 + 有效全伤害/100) × 核心主伤系数)`，最低1。全伤害有效上限50%。普通武器再按针数、连锁、震波等分段；Boss专武先按整次总预算加一次属性与全伤，再按24/8、10或14/7/4分配，不叠旧百分比强化。三针与双针分摊整数总预算，余数依次分配，允许分到0但不生成0伤害弹。',
'','实际暴击率=角色暴击+武器自带暴击，最高100%；基础暴击倍率1.75。暴击效果初始0，每点再加0.01倍；盈锋转换器将超过100%的部分按2∶1增加每把武器的暴击效果。领域跳伤、持续附着、霜凝碎裂、连锁后续、专武震波/协同/回收/闭环/棱面和导弧分支不暴击，额外分弧也不触发吸血或递归。',
'','范围每点加1%拾取及攻击可达距离；不放大普通领域、爆炸或跳距；铰锤震波随近战范围变化，并在释放原点6单位内裁剪。近战取缩减后基础距离的1.75倍与6的较小值；挥扫判定再取索敌距离×0.85。混合武器刃波独立走远程距离，无数值硬上限，但仍被竞技场边界阻挡。',
'','## '+Object.keys(cores).length+'核心的实际效果','',
...Object.entries(cores).flatMap(([id,c])=>[`### ${c.name}`,'',c.desc,'',`直接适配：${records.filter(r=>r.baseline.cores.includes(id)).map(r=>r.baseline.name).join('、')}。`,'']),
'## 每把武器的详细数据',''];
for(const r of records){const f=r.baseline;lines.push(`### ${f.name}`,'',`**${f.action}**。${f.rules}`,'',
`- 表现：${f.visual}。`,
`- 基准伤害：${f.damage}；周期${fmt(f.cadence)}秒；索敌距离${fmt(f.reach)}${f.meleeReach!==null?'，挥扫判定'+fmt(f.meleeReach):''}${f.projectileReach!==null?'，刃波距离'+fmt(f.projectileReach):''}。`,
`- 各品质伤害：${r.tiers.map(t=>t.tier+'：'+t.damage).join('；')}。`,
`- 最低品质的有效属性系数：${f.scale}。`,
`- 当前基准实际暴击${f.crit}%，暴击倍率${fmt(f.critMultiplier)}；获取：${f.unlock}。`,
...(f.extra?['- 机制参数：'+f.extra+'。']:[]),
...r.variants.map(v=>`- ${v.name}：伤害${v.damage}，周期${fmt(v.cadence)}秒${v.extra?'；'+v.extra:''}。`),'');}
lines.push('## 专武强化与表现边界','',
'3款专武均占普通武器槽、不能合成，改装0～3级。铰锤有冲击储量与聚砧/裂地；蜂巢为持续跟随蜂，有协同储量与聚猎/播簇；棱核有空路回收与聚束/折域。以上表格按0级计算，当前构筑详情会读取等级和分支。指定共鸣替换对应武器的通用核心规则；衍生不暴击、不吸血、不递归。每次新商店最多收费改装一次，刷新不重置，普通四格不被占用。逐级机制及核心变化见《Boss专武专属属性与核心共鸣设计》和《v110-实施记录》。',
'','瞬时特效只作视觉反馈，不额外造成伤害或增加范围；专武攻击实体的实际判定另由共享预算结算。新增瞬时特效不使用战斗随机数，最多96个效果，过期和清场时释放独立几何与材质；暂停及图鉴期间停止更新。敌方危险区域保留红/橙色预警，友方领域与锁线低透明显示。',
'','界面入口：主菜单、战斗HUD、暂停页或商店的“内容图鉴”武器页；商店货架及持有武器的“攻击详情”。图鉴采用本文基准，商店采用当前构筑，二者不应混为同一数值。',
'','已有1.8数值报告属于历史版本；本轮没有以固定脚本通过率宣称全部核心或20波已经平衡。');
fs.writeFileSync(path.join(root,'docs','武器攻击与核心适配.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({sourceSha256,weapons:records.length,output:'docs/武器攻击与核心适配.md'},null,2));
