/**
 * 打开演示页面，收集浏览器控制台里的真实错误。
 * 用法：node scripts/cors-demo/capture.js [截图输出路径]
 */
const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const out = process.argv[2];
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const logs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') logs.push('[console.error] ' + m.text());
  });
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('requestfailed', (r) => {
    const f = r.failure();
    logs.push('[requestfailed] ' + r.url() + ' :: ' + (f ? f.errorText : 'unknown'));
  });

  await page.goto('http://localhost:3200/', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 4000));

  const state = await page.evaluate(() =>
    document.body.innerText.replace(/\s+/g, ' ').slice(0, 500)
  );

  if (out) {
    await page.screenshot({ path: out });
    console.log('截图已保存:', out);
  }

  console.log('=== 页面可见文字 ===');
  console.log(state);
  console.log('=== 控制台错误（原文）===');
  console.log(logs.length ? logs.join('\n') : '(无错误)');

  await browser.close();
})().catch((e) => {
  console.error('capture 失败:', e);
  process.exit(1);
});
