/**
 * 关键功能截图脚本：首页 + 对话页 + AI 查询 + AI 新增
 * 依赖：npm i -D puppeteer-core
 * 运行：node scripts/screenshot-features.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];
const EDGE = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
const BASE = process.env.PAGE_URL || 'http://localhost:3000';
const OUT_DIR = path.resolve(__dirname, '..', 'screenshots');

fs.mkdirSync(OUT_DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  const p = path.join(OUT_DIR, name);
  await page.screenshot({ path: p });
  console.log('✓ ' + name);
  return p;
}

(async () => {
  if (!EDGE) { console.error('未找到 Edge 浏览器'); process.exit(1); }

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=1']
  });

  try {
    // ---------- 1. 首页正常列表 ----------
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () => !document.getElementById('activityTable').hidden,
        { timeout: 10000 }
      );
      await sleep(500);
      await shot(page, 'home-list.png');
      await page.close();
    }

    // ---------- 2. 对话页欢迎语 ----------
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(BASE + '/chat.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () => document.querySelector('#chatbox .msg') !== null,
        { timeout: 10000 }
      );
      await sleep(500);
      await shot(page, 'chat-welcome.png');
      await page.close();
    }

    // ---------- 3. AI 查询活动（数据注入 + 流式） ----------
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(BASE + '/chat.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () => document.querySelector('#chatbox .msg') !== null,
        { timeout: 10000 }
      );
      await page.type('#input', '现在有哪些活动？');
      await page.click('#sendBtn');
      // 等待出现第二个 assistant 气泡（AI 回复）
      await page.waitForFunction(
        () => document.querySelectorAll('#chatbox .msg.assistant').length >= 2,
        { timeout: 40000 }
      );
      // 等待「停止生成」按钮消失（流式结束）再截图，确保回答完整
      await page.waitForFunction(
        () => document.getElementById('stopBtn').hidden === true,
        { timeout: 40000 }
      );
      await sleep(500);
      await shot(page, 'chat-query.png');
      await page.close();
    }

    // ---------- 4. AI 新增活动（工具调用） ----------
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(BASE + '/chat.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () => document.querySelector('#chatbox .msg') !== null,
        { timeout: 10000 }
      );
      await page.type('#input', '帮我新增一个活动：读书分享会，2027年11月20日，图书馆');
      await page.click('#sendBtn');
      // 等待出现 notice 气泡（工具执行结果）
      await page.waitForFunction(
        () => document.querySelector('#chatbox .msg.notice') !== null,
        { timeout: 40000 }
      );
      await sleep(2000);
      await shot(page, 'chat-add-activity.png');
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('截图脚本失败：', err);
  process.exit(1);
});
