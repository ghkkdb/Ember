// 从当前产品脚本读取配置与战斗计算，输出理论模型；不模拟走位、命中或玩家胜率。
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const file = path.join(__dirname, '..', 'terrabrotato.html');
const html = fs.readFileSync(file, 'utf8');
const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(Boolean).join('\n');
const context = vm.createContext({ window: { addEventListener() {} }, document: { getElementById: () => ({}) }, setTimeout() {} });
vm.runInContext(source, context);
const result = vm.runInContext(`(() => {
    const neutral = {maxHp:25,hpRegen:0,lifeSteal:0,dmgPct:0,meleeDmg:0,rangedDmg:0,magicDmg:0,attackSpeed:0,critChance:5,critEffectPct:0,rangePct:0,armor:0,dodge:0,speed:0,luck:0,harvesting:0};
    const app = Object.create(TerraBrotatoApp.prototype);
    app.updateHeroCosmetics = () => {};
    const expected = (damage, crit, multiplier=1.75) => damage + (Math.round(damage * multiplier) - damage) * crit / 100;
    const stat = (id, tier, extras = {}) => {
        app.stats = {...neutral, ...extras};
        return app.getWeaponCombatStats({id,tier});
    };
    const weapons = Object.values(WEAPONS_DB).map(weapon => {
        const s = stat(weapon.id, weapon.minTier);
        const mainDamage = s.dmg;
        const mainDps = ['field','turret','charge','charge_melee'].includes(weapon.behavior) ? null : expected(mainDamage, s.crit,s.critMultiplier) / s.cd;
        const possibleTotalDps = app.getBuildDpsCeiling([{id:weapon.id,tier:weapon.minTier}], neutral);
        const possibleExtraDps = mainDps===null ? null : possibleTotalDps - mainDps;
        return {id:weapon.id,name:weapon.name,tier:weapon.minTier,startEligible:getStarterWeaponIds().includes(weapon.id),...s,mainDps,possibleExtraDps,possibleTotalDps,boss10IdealSeconds:(BOSS_SKILLS.eyeHpPerWave*10)/possibleTotalDps};
    });
    const growth = [1,2,3,4].map(tier => {const s=stat('grass_blade',tier);return {tier,...s,dps:expected(s.dmg,s.crit)/s.cd};});
    const combine = ['grass_blade','minishark','water_bolt'].map(id => {
        const calculate = tiers => {
            app.baseStats={...neutral}; app.weapons=tiers.map(tier=>({id,tier})); app.recalcStats();
            return app.getBuildDpsCeiling(app.weapons, app.stats);
        };
        const pairDps=calculate([1,1]), upgradedDps=calculate([2]);
        return {id,pairDps,upgradedDps,changePct:100*(upgradedDps/pairDps-1)};
    });
    const zenithStats = [{label:'无额外加成',stats:{}},{label:'近战+3',stats:{meleeDmg:3}},{label:'全伤+6%',stats:{dmgPct:6}},{label:'攻速+8%',stats:{attackSpeed:8}},{label:'暴击+8个百分点',stats:{critChance:13}}].map(item=>{const s=stat('zenith',4,item.stats);return {label:item.label,...s,dps:expected(s.dmg,s.crit)/s.cd};});
    const waves=[1,5,10,20,30].map(wave=>{
        const factors=[1]; if(wave>=2)factors.push(1,.9);if(wave>=3)factors.push(1.1);if(wave>=4)factors.push(1.7);if(wave>=6)factors.push(1.25);
        const baseHp=24*(1+(wave-1)*.35), meanHp=baseHp*factors.reduce((a,b)=>a+b,0)/factors.length;
        const spawnPerSecond=Math.min(5,1+Math.floor(wave/2))/Math.max(.55,1.8-wave*.1);
        return {wave,baseHp,meanHp,spawnPerSecond,nominalHpPerSecond:meanHp*spawnPerSecond,poolNotice:'均值为基础怪池近似，不含数量受限的守卫和萨满；不能代表实际刷怪生命预算',guardHp:baseHp*ELITE_RULES.guardHp,coinBudget:getWaveCoinBudget(wave),duration:Math.min(55,18+wave*4),damage:4+Math.floor(wave*.7),bossHp:wave%5===0?(wave<=20?[0,1500,6000,10500,15000][wave/5]:Math.round(15000*Math.pow(1.22,wave/5-4))):null};
    });
    const sixSwords = (()=>{app.baseStats={...neutral};app.weapons=Array.from({length:6},()=>({id:'grass_blade',tier:4}));app.recalcStats();return {stats:{...app.stats},weapon:app.getWeaponCombatStats(app.weapons[0])};})();
    const sixHighWeapons=(()=>{app.baseStats={...neutral};app.weapons=Array.from({length:6},()=>({id:'zenith',tier:4}));app.recalcStats();const s=app.getWeaponCombatStats(app.weapons[0]);return {stats:{...app.stats},weapon:s,totalIdealDps:6*expected(s.dmg,s.crit)/s.cd,boss10IdealSeconds:(BOSS_SKILLS.eyeHpPerWave*10)/(6*expected(s.dmg,s.crit)/s.cd)};})();
    const starters=CHARACTERS.map(character=>{const weapon=WEAPONS_DB[character.starter],s=stat(weapon.id,weapon.minTier,character.mods);return {character:character.id,weapon:weapon.id,...s};});
    const synergyTransitions=['grass_blade','light_disc'].map(id=>({id,steps:[4,6].map(count=>{app.baseStats={...neutral};app.weapons=Array.from({length:count},()=>({id,tier:1}));app.recalcStats();return {count,stats:{...app.stats}};})}));
    const economy = {
        shopScenarios: [0, 100, 235, 100000].map(luck => ({completedWave:14,luck,probabilities:getTierProbabilities(15,luck)})),
        randomCrates: [0,1,2,3].map(dropped => ({dropped,pot:getRandomCrateChance(false,100,dropped),tree:getRandomCrateChance(true,100,dropped)})),
        wave14RerollCosts: [0,1,2,3].map(rolls => getShopRerollCost(14,rolls)),
        limitedItems: ITEMS_DB.filter(item=>item.limit).map(item=>({id:item.id,limit:item.limit,stats:item.stats})),
        guideFirstPropCrateProbability:.45*getRandomCrateChance(true,15,0)+.55*getRandomCrateChance(false,15,0)
    };
    return {assumptions:'中性角色基础暴击5%；无额外属性与羁绊（合成与6武器场景除外）；连续理想命中；多段输出仅为条件上限；不含帧量化、首击等待、飞行和落星延迟、过量伤害、索敌与移动。不是实测DPS或胜率。经济部分为规则概率，不预测对局实际收益。',weapons,growth,combine,zenithStats,waves,sixSwords,sixHighWeapons,starters,synergyTransitions,chestItemTiers:ITEMS_DB.reduce((out,item)=>{out[item.tier]=(out[item.tier]||0)+1;return out;},{}),economy};
})()`, context);
const output={source:path.resolve(file),sha256:crypto.createHash('sha256').update(html).digest('hex'),...result};
fs.writeFileSync(path.join(__dirname,'balance-audit.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify(output,null,2));
