// 本地测试服务器只监听回环地址，不修改产品HTML。
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const root = path.join(__dirname, '..');
const product = path.join(root, 'terrabrotato.html');
const bridge = `<script>window.TEST_DATA = { weapons: WEAPONS_DB, items: ITEMS_DB, characters: CHARACTERS, stats: STAT_META, cores: CORE_RELICS, bosses: BOSSES_DB, enemies: ENEMIES_DB, difficulties: DIFFICULTIES, bossSkills: BOSS_SKILLS, arenaHalf: ARENA_HALF, probabilities: getTierProbabilities, rollTier: rollItemTier, crateChance: getRandomCrateChance };<\/script>`;

function createTestServer() {
    return http.createServer((request, response) => {
        const route = new URL(request.url, 'http://127.0.0.1').pathname;
        response.setHeader('Cache-Control', 'no-store');
        try {
            if (route === '/' || route === '/test-game') {
                const source = fs.readFileSync(product, 'utf8');
                response.setHeader('Content-Type', 'text/html; charset=utf-8');
                response.end(route === '/' ? source : source.replace('</body>', bridge + '</body>'));
                return;
            }
            if (route === '/api/info') {
                const source = fs.readFileSync(product, 'utf8');
                response.setHeader('Content-Type', 'application/json; charset=utf-8');
                response.end(JSON.stringify({ toolProtocol: 3, title: source.match(/<title>(.*?)<\/title>/)[1], sha256: crypto.createHash('sha256').update(source).digest('hex') }));
                return;
            }
            const routes = { '/test': ['test-panel.html', 'text/html'], '/test-panel.js': ['test-panel.js', 'text/javascript'], '/test-model.js': ['test-model.js', 'text/javascript'], '/test-panel.css': ['test-panel.css', 'text/css'] };
            const asset = routes[route];
            if (!asset) { response.writeHead(404); response.end('未找到页面'); return; }
            response.setHeader('Content-Type', asset[1] + '; charset=utf-8');
            response.end(fs.readFileSync(path.join(__dirname, asset[0])));
        } catch (error) {
            console.error(error);
            response.writeHead(500); response.end('读取测试资源失败，请查看终端日志。');
        }
    });
}

function openTestPage(url, launch = execFile) {
    const failed = () => console.error(`自动打开浏览器失败，请手动访问：${url}`);
    try {
        launch('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${url}'`], { windowsHide: true }, error => { if (error) failed(); });
    } catch { failed(); }
}

async function startTestServer({ port = 8765, open = false } = {}) {
    let result;
    for (let offset = 0; offset <= 10; offset++) {
        const candidate = port + offset;
        const server = createTestServer();
        try {
            await new Promise((resolve, reject) => {
                server.once('error', reject);
                server.listen(candidate, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
            });
            result = { server, url: `http://127.0.0.1:${server.address().port}/test`, reused: false };
            break;
        } catch (error) {
            if (error.code !== 'EADDRINUSE') throw error;
            // 重复启动时复用本项目的测试服务；其他应用占用端口则换一个端口。
            try {
                const base = `http://127.0.0.1:${candidate}`;
                const info = await fetch(base + '/api/info', { signal: AbortSignal.timeout(1500) }).then(response => response.json());
                const currentHash = crypto.createHash('sha256').update(fs.readFileSync(product, 'utf8')).digest('hex');
                const panel = await fetch(base + '/test', { signal: AbortSignal.timeout(1500) }).then(response => response.text());
                if (info.toolProtocol === 3 && info.sha256 === currentHash && panel.includes('<title>余烬回路 · 游戏测试台</title>') && panel.includes('/test-panel.js')) {
                    result = { server: null, url: base + '/test', reused: true };
                    break;
                }
            } catch { /* 非本项目服务，继续尝试下一端口。 */ }
        }
    }
    if (!result) throw new Error('8765～8775端口均不可用，请关闭旧的测试服务器后重试。');
    console.log(`${result.reused ? '测试台已在运行，直接使用现有服务。\n' : ''}测试面板：${result.url}\n${result.reused ? '原服务仍在运行，此窗口可以关闭。' : '请保留此窗口，按 Ctrl+C 停止服务。'}`);
    if (open && process.platform === 'win32') {
        openTestPage(result.url);
    }
    return result;
}

if (require.main === module) {
    startTestServer({ open: process.argv.includes('--open') }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { createTestServer, startTestServer, openTestPage };
