// 同进程运行全部回归，避免受限环境下测试器创建子进程失败。
const fs = require('node:fs');
const path = require('node:path');
for (const file of fs.readdirSync(__dirname).filter(name => name.endsWith('.test.cjs')).sort()) {
    require(path.join(__dirname, file));
}
