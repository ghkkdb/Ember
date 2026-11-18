// 直接读取产品图鉴方法，导出当前已实装的道具、Boss和小怪，不手填战斗数值。
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {setup}=require('./combat-benchmark.cjs');
const root=path.join(__dirname,'..'),{app,context}=setup(11);
const data=vm.runInContext('({items:ITEMS_DB,bosses:BOSSES_DB,enemies:ENEMIES_DB,enemyStats:getEnemyEncounterStats})',context);
const sourceSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'terrabrotato.html'))).digest('hex');
const items=Array.from(data.items,item=>({...app.getItemFacts(item,5),prices:[3,5,10,20].map(wave=>({wave,price:app.getItemFacts(item,wave).price}))}));
const bosses=Object.keys(data.bosses).map(id=>({...app.getBossFacts(id,5,1),health:[5,10,15,20,30,50].map(wave=>({wave,values:[1,2,3,4,5].map(difficulty=>app.getBossFacts(id,wave,difficulty).hp)}))}));
const enemies=Object.keys(data.enemies).map(id=>({id,...data.enemyStats(id,5,1),scenarios:[1,5,10,20,50].map(wave=>({wave,values:[1,2,3,4,5].map(difficulty=>data.enemyStats(id,wave,difficulty))}))}));
const version=require('../package.json').version.replace(/\.0$/,'');
const result={version,sourceSha256,basis:'产品配置与实际图鉴方法；默认第5波、难度1。敌方伤害均为防御前原始值。商店价格为波次基价，不保证当波投放。',items,bosses,enemies};
fs.writeFileSync(path.join(__dirname,`content-catalogue-v${version}.json`),JSON.stringify(result,null,2)+'\n');
const clean=value=>String(value).replaceAll('|','／').replaceAll('\n',' ');
const lines=[`# ${version} 道具、Boss与小怪图鉴`,'',`源码SHA-256：\`${sourceSha256}\`。由\`node analysis/content-catalogue.cjs\`读取当前产品生成。`,'',result.basis,'',
`## ${items.length}件道具`,'','| 名称 | 品质／开放波 | 上限 | 实际效果与代价 | 适用武器 | 第5波基价 |','| --- | --- | --- | --- | --- | --- |',
...items.map(f=>`| ${f.name} | ${f.tier}阶／${f.unlock}波 | ${f.limit} | ${clean(f.desc)} | ${f.targets.join('、')||'按效果作用于角色或对应攻击'} | ${f.price} |`),'',
`## ${bosses.length}位Boss`,'','每5波从已实现Boss洗牌出场。同一波不同Boss生命一致；难度只影响生命，未把护甲减伤算进伤害。非Boss波预览按之后最近的Boss波计算。第5波基础不变，第10／15／20波难度1生命为7800／16800／28500；之后每5波乘1.30。出场波次同时提升伤害、移速和进攻频率，预警最低0.72秒。各技能实际数值以所选波次预览为准。',''];
for(const boss of bosses){lines.push(`### ${boss.name}`,'',`第5波难度1生命${boss.hp}，原始接触伤害${boss.contactDamage}，移速${boss.speed}；预警${boss.warning}秒、恢复硬直${boss.recovery}秒，半血追击间隔${boss.chase}→${boss.rageChase}秒。`,'',
...Array.from(boss.skills,skill=>`- **${skill.name}**：${skill.desc} ${skill.damage===null?`幼体伤害${boss.droneDamage}，无奖励，${boss.droneLife}秒后消失。`:`原始伤害${skill.damage}／半血${skill.rageDamage}。`}`),'',
'| 波次 | 难度1 | 难度2 | 难度3 | 难度4 | 难度5 |','| --- | --- | --- | --- | --- | --- |',...boss.health.map(row=>`| ${row.wave} | ${row.values.join(' | ')} |`),'');}
lines.push(`## ${enemies.length}类小怪`,'','以下为第5波难度1的数值预览，未到开放波次的类型仍可查阅，但不会提前进入正常随机池。','',
'| 名称 | 开放波 | 生命 | 接触伤害 | 移速 | 行为与应对 |','| --- | --- | --- | --- | --- | --- |',
...enemies.map(f=>`| ${f.name} | ${f.unlockWave} | ${Number(f.hp.toFixed(2))} | ${f.dmg} | ${f.speed} | ${clean(f.tactic)} |`),'',
'普通怪生命公式：`24 × (1 + (波次 - 1) × 0.35) × 类型生命系数 × 难度倍率 × 无尽倍率`。第25波起无尽倍率为`1.12 ** floor((波次 - 20) / 5)`，此前为1。难度倍率为1／1.25／1.55／1.9／2.3。普通接触伤害为`4 + floor(波次×0.7) + 类型附加值`，哥布林附加3。',
'',`数值完整场景及道具多波次价格见\`analysis/content-catalogue-v${version}.json\`。图鉴查询不生成怪物、不消费战斗或奖励随机数，也不修改本局波次与难度。`);
fs.writeFileSync(path.join(root,'docs','道具与敌人图鉴.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({sourceSha256,items:items.length,bosses:bosses.length,enemies:enemies.length},null,2));
