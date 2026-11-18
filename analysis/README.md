# 分析脚本与结果

命令均在项目根目录执行；数值脚本使用Node.js内置模块，浏览器验收需要项目Playwright依赖和本机Chrome。

| 命令 | 用途与输出 |
| --- | --- |
| `node analysis/browser-smoke-v1.15.1.cjs` | 当前商店锁定与取消、刷新及读档保留、手机横屏战斗截图与界面回归，写入`artifacts/v1151/` |
| `node analysis/weapon-catalogue.cjs` | 当前武器数值，按包版本生成JSON及中文图鉴 |
| `node analysis/content-catalogue.cjs` | 当前道具/敌人数值，按包版本生成JSON及中文图鉴 |
| `node analysis/optimization-benchmark-v1.13.cjs` | 优化前后固定场景对照、当前合成收益与20波固定采购尝试 |
| `node analysis/browser-smoke-v1.13.cjs` | 本机Chrome页面验收，结果及截图写入`artifacts/v113/`，需要Playwright依赖和Chrome |
| `node analysis/browser-smoke-range-camera.cjs` | 最新范围与镜头验收，含桌面/手机截图、镜头高度、可见地面跨度和视角存档，写入`artifacts/range-camera/` |
| `node analysis/browser-smoke-v1.15.cjs` | 1.15紧凑武器槽、饰品适配、镜头高度、密集击杀、触屏摇杆/冲刺、横竖屏和结算读档，写入`artifacts/v115/` |
| `analysis/browser-smoke-combat-ui.cjs` | 1.14独立战报弹窗验收脚本，当前已取消该弹窗；历史结果见`artifacts/combat-ui/` |
| `node analysis/balance-audit.cjs` | 理想命中数值核算，输出`balance-audit.json`；不代表实战DPS |
| `node analysis/combat-benchmark.cjs` | 固定构筑战斗基准，输出`combat-benchmark.json` |
| `node analysis/early-game-benchmark.cjs` | 真实经济和拾取流程的前五波脚本，输出`early-game-benchmark.json` |
| `node analysis/progression-benchmark.cjs` | 20波固定策略可达性，输出`progression-benchmark.json` |

所有脚本读取根目录当前产品，不复现历史快照。战斗基准使用轻量渲染替身，经济脚本采用固定购买和走位，不代表真人胜率或浏览器性能。长流程脚本放弃核心、未充分优化满槽换装，不能据此判定完整难度已经平衡。

当前界面验证见[1.15.1实施记录](../docs/v1151-实施记录.md)与`artifacts/v1151/browser-smoke.json`。1.13平衡基准、早期版本摘要及未更新报告只代表各自源码指纹；旧版资料见[历史索引](history/README.md)。不要覆盖history内的文件。
