// 配置校验与随机抽样独立于浏览器，供面板及Node回归共同使用。
(function (host) {
    'use strict';
    function number(value, min, max, label, integer = false) {
        if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value))) throw new Error(`${label}必须是有限数字`);
        const result = Number(value);
        if (result < min || result > max || (integer && !Number.isInteger(result))) throw new Error(`${label}必须在${min}～${max}之间${integer ? '且为整数' : ''}`);
        return result;
    }
    function validateConfig(input, data) {
        if (!input || input.version !== 1) throw new Error('配置版本不兼容，需要version为1的测试配置');
        if (!data.characters.some(c => c.id === input.character)) throw new Error('职业不存在');
        const config = {
            version: 1, character: input.character,
            difficulty: number(input.difficulty ?? 1,1,5,'难度',true), bossOverride: input.bossOverride || '',
            wave: number(input.wave, 1, 200, '波次', true), gold: number(input.gold, 0, 1000000, '晶币', true),
            seed: number(input.seed, 0, 4294967295, '随机种子', true),
            speed: number(input.speed, .25, 4, '速度'),
            bossOnly: input.bossOnly === true, invincible: input.invincible === true, ignoreLimits: input.ignoreLimits === true,
            core: input.core || null, bonuses: {}, weapons: [], items: []
        };
        if(config.bossOverride&&!Object.hasOwn(data.bosses||{},config.bossOverride))throw new Error('未知Boss');
        if (config.core && !Object.hasOwn(data.cores || {}, config.core)) throw new Error('未知构筑核心');
        if (!Array.isArray(input.weapons) || input.weapons.length < 1 || input.weapons.length > 6) throw new Error('武器必须为1～6把');
        config.weapons = input.weapons.map(w => {
            const definition = Object.hasOwn(data.weapons, w.id) ? data.weapons[w.id] : null;
            if (!definition) throw new Error('存在未知武器');
            const entry={ id: w.id, tier: number(w.tier, definition.minTier, 4, `${definition.name}品质`, true) };
            if(definition.exclusiveBossId){
                entry.tier=definition.minTier;entry.rank=number(w.rank??0,0,3,'专武强化等级',true);
                entry.branch=w.branch||null;
                if(entry.branch&&!['single','area'].includes(entry.branch)||entry.rank>0&&!entry.branch)throw new Error('强化专武必须选择有效路线');
            }else if(w.rank||w.branch)throw new Error('普通武器不能设置专武改装');
            return entry;
        });
        const specials=config.weapons.filter(w=>data.weapons[w.id].exclusiveBossId);
        if(new Set(specials.map(w=>w.id)).size!==specials.length)throw new Error('同款Boss专武不能重复装备');
        if (!Array.isArray(input.items) || input.items.length > data.items.length) throw new Error('饰品配置格式错误');
        const ids = new Set();
        config.items = input.items.map(item => {
            const definition = data.items.find(it => it.id === item.id);
            if (!definition || ids.has(item.id)) throw new Error('饰品不存在或重复，请用数量表示多件');
            ids.add(item.id);
            const count = number(item.count, 1, 100, '饰品数量', true);
            if (!config.ignoreLimits && definition.limit && count > definition.limit) throw new Error(`${definition.name}最多持有${definition.limit}件`);
            return { id: item.id, count };
        });
        for (const stat of data.stats) config.bonuses[stat.key] = number(input.bonuses?.[stat.key] ?? 0, -1000, 10000, stat.name);
        const character = data.characters.find(c => c.id === config.character);
        const maxHp = 25 + (character.mods.maxHp || 0) + (config.bonuses.maxHp || 0)
            + config.items.reduce((sum, item) => sum + (data.items.find(it => it.id === item.id).stats.maxHp || 0) * item.count, 0);
        if (maxHp < 1) throw new Error('应用后的最大生命必须至少为1');
        return config;
    }
    function createRandom(seed) {
        let state = seed >>> 0;
        const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
        random.state = () => state;
        return random;
    }
    function sampleTiers(data, wave, luck, count, seed, randomHost) {
        number(wave, 1, 200, '抽样波次', true); number(luck, -1000, 10000, '抽样幸运'); number(count, 100, 100000, '抽样数量', true);
        number(seed, 0, 4294967295, '随机种子', true);
        const previous = randomHost.random;
        const counts = [0, 0, 0, 0];
        try {
            randomHost.random = createRandom(seed);
            for (let i = 0; i < count; i++) counts[data.rollTier(wave, luck) - 1]++;
        } finally { randomHost.random = previous; }
        return { wave, luck, count, seed, expected: Array.from(data.probabilities(wave, luck)), counts };
    }
    const api = { number, validateConfig, createRandom, sampleTiers };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else host.TestModel = api;
})(typeof window === 'undefined' ? globalThis : window);
