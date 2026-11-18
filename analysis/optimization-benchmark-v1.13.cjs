// 当前规则与优化前固定场景对照；固定脚本结果不代表真人胜率。
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {benchmark,setup}=require('./combat-benchmark.cjs');
const {run}=require('./early-game-benchmark.cjs');
const baseline=require('./optimization-review-2026-11-18.json');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','terrabrotato.html'));
const combat=benchmark();
const progression=[11,29,47].map(seed=>run(seed,'output',20));
const {app,context}=setup(11);context.reviewApp=app;
const merges=vm.runInContext(`['grass_blade','minishark','water_bolt'].map(id=>{
    const a=reviewApp;a.wave=3;a.weapons=Array.from({length:6},()=>({id,tier:1}));
    const p=a.getCombinePreview(0);return{id,before:p.before,after:p.after,changePct:(p.after/p.before-1)*100};
})`,context);
const summary=report=>[5,10].map(wave=>({wave,builds:['blade','gun','star'].map(build=>{
    const rows=report.results.filter(r=>r.wave===wave&&r.build===build&&r.mode==='boss');
    return {build,kills:rows.filter(r=>r.bossKilledAt!==null).length,killSeconds:rows.map(r=>r.bossKilledAt),hp:rows.map(r=>r.hp)};
})}));
const report={sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),baselineSha256:baseline.sourceSha256,
    method:'使用真实产品战斗方法、60Hz及渲染替身；固定构筑对照保持相同属性、品质、数量和种子。流程模拟真实经济、放弃核心且满槽后未优化普通武器替换；不代表真人胜率或浏览器性能。',
    merges,before:summary(baseline.combat),after:summary(combat),combat,progression};
fs.writeFileSync(path.join(__dirname,'optimization-benchmark-v1.13.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({merges,before:report.before,after:report.after,progression:progression.map(r=>({seed:r.seed,wave:r.rows.at(-1)?.wave,outcome:r.outcome,gold:r.closingGold,bossTimes:r.rows.filter(x=>x.wave%5===0).map(x=>({wave:x.wave,seconds:x.metrics?.bossKillSeconds}))}))},null,2));
