# 分析脚本与结果

命令均在项目根目录执行，使用Node.js内置模块，无额外依赖。

| 命令 | 用途与输出 |
| --- | --- |
| `node analysis/weapon-catalogue.cjs` | 当前武器数值，生成1.11武器JSON及中文图鉴 |
| `node analysis/content-catalogue.cjs` | 当前道具/敌人数值，生成1.11内容JSON及中文图鉴 |
| `node analysis/balance-audit.cjs` | 理想命中数值核算，输出`balance-audit.json`；不代表实战DPS |
| `node analysis/combat-benchmark.cjs` | 固定构筑战斗基准，输出`combat-benchmark.json` |
| `node analysis/early-game-benchmark.cjs` | 真实经济和拾取流程的前五波脚本，输出`early-game-benchmark.json` |
| `node analysis/progression-benchmark.cjs` | 20波固定策略可达性，输出`progression-benchmark.json` |

所有脚本读取根目录当前产品，不复现历史快照。战斗基准使用轻量渲染替身，经济脚本采用固定购买和走位，不代表真人胜率或浏览器性能。长流程脚本放弃核心、未充分优化满槽换装，不能据此判定完整难度已经平衡。

当前验证见[版本摘要](verification-v1.11.json)和[整理验证](delivery-verification.json)。旧版资料见[历史索引](history/README.md)。新增输出需核对源码指纹后再引用，避免未标版本JSON被当作当前证据；不要覆盖history内的文件。
