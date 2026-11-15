# 余烬回路 · Ember Circuit

当前版本：**1.12 全量机制与原创目录实装**。这是可运行的单机浏览器游戏原型，已完整实装 12 款核心协议、6 位 Boss、6 把专武、42 款武器图鉴、50 件机制道具、独立护盾与伤害账本系统。文件夹及入口文件名保留旧路径，后续内容以原创方案为准。

## 启动

需要 Node.js 18或以上。在Windows双击 [启动测试工具](tools/启动测试工具.cmd)，或在本目录执行：

```powershell
node tools/test-server.cjs
```

按终端显示的地址打开游戏 `/` 或测试台 `/test`。默认端口8765，占用时尝试8766～8775。按Ctrl+C停止服务。游戏需要联网加载Three.js r128和Tailwind CDN；本地工具无额外npm依赖。

## 文档

- [交付文档](docs/交付文档.md)：已交付能力、规则、使用及验收限制。
- [1.12实施记录](docs/v112-实施记录.md)：本轮全量功能与技术实装明细。
- [方案实装差异清单](docs/方案实装差异清单.md)：全量机制与原创目录对齐矩阵。
- [文档索引](docs/README.md)：方案、数值和历史资料。
- [项目结构与整理说明](docs/项目结构与整理说明.md)：目录职责和清理记录。
- [测试台说明](tools/README.md)：场景、构筑、Boss、配置及报告操作。

## 回归与数值文档

```powershell
node tests/run.cjs
node analysis/weapon-catalogue.cjs
node analysis/content-catalogue.cjs
```

回归加载当前游戏脚本；163项规则测试全绿通过。

```text
泰拉兄弟/
├─ README.md                  项目入口
├─ terrabrotato.html          游戏配置、界面、渲染、战斗及流程
├─ code_artifact.md           旧文档入口导航兼容页
├─ tools/                    测试服务器、启动器、面板
├─ tests/                    回归用例及统一执行入口
├─ analysis/                 当前分析脚本、生成数据及验证摘要
│  ├─ history/               历史报告与版本验证摘要
│  └─ fixtures/              1.7/1.8源码对照快照
└─ docs/                     交付、计划、原创方案及数值图鉴
   ├─ history/               1.8～1.10实施记录
   └─ media/                 文档截图，不是游戏素材依赖
```
