// 验证长流程可达性；脚本使用固定采购策略、放弃核心，不代表真人通关率。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { run } = require('./early-game-benchmark.cjs');
const report = {
    sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', 'terrabrotato.html'))).digest('hex'),
    method: '难度1，60Hz真实战斗与经济，固定output采购、升级与脚本走位；不加资源、不无敌，核心全部放弃。保留首件Boss专武，按现有分支购买强化。满槽后不主动优化普通武器替换，不能用作平衡通过或真人胜率结论。',
    results: [11,29,47].map(seed => run(seed,'output',20))
};
fs.writeFileSync(path.join(__dirname,'progression-benchmark.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report.results.map(r=>({seed:r.seed,wave:r.rows.at(-1)?.wave,outcome:r.outcome,gold:r.closingGold,bossSeconds:r.rows.at(-1)?.metrics?.bossKillSeconds})),null,2));
