/**
 * 三态截图脚本（本地验证用）
 * 依赖：npm i -D puppeteer-core
 * 运行：node scripts/screenshot.js
 *
 * 说明：直接用 msedge 无头浏览器打开页面，
 * 通过请求拦截分别制造「慢请求 / 空数组 / 请求失败」三种场景。
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PAGE_URL = process.env.PAGE_URL || 'http://localhost:3000/';
const OUT_DIR = path.resolve(__dirname, '..', 'screenshots');

fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  return page;
}

// 只拦截 GET /api/activities，其余请求放行
async function interceptApi(page, handler) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const isApi = req.url().includes('/api/activities') && req.method() === 'GET';
    if (isApi) {
      handler(req);
    } else {
      req.continue();
    }
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=1']
  });

  try {
    // ---------- 1. 加载中：把接口延迟 8 秒 ----------
    {
      const page = await newPage(browser);
      await interceptApi(page, (req) => setTimeout(() => req.continue().catch(() => {}), 8000));
      await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
      await sleep(1500);
      await page.screenshot({ path: path.join(OUT_DIR, '01-loading.png') });
      console.log('✓ 01-loading.png');
      await page.close();
    }

    // ---------- 2. 空数据：伪造返回空数组 ----------
    {
      const page = await newPage(browser);
      await interceptApi(page, (req) =>
        req.respond({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ code: 0, data: [], msg: '查询成功' })
        })
      );
      await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () => document.body.innerText.includes('暂无活动数据'),
        { timeout: 10000 }
      );
      await sleep(300);
      await page.screenshot({ path: path.join(OUT_DIR, '02-empty.png') });
      console.log('✓ 02-empty.png');
      await page.close();
    }

    // ---------- 3. 请求失败：直接中断请求 ----------
    {
      const page = await newPage(browser);
      await interceptApi(page, (req) => req.abort('failed'));
      await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () => document.querySelector('.retry-btn') !== null,
        { timeout: 10000 }
      );
      await sleep(300);
      await page.screenshot({ path: path.join(OUT_DIR, '03-error.png') });
      console.log('✓ 03-error.png');
      await page.close();
    }

    // ---------- 4. 正常列表（附加） ----------
    {
      const page = await newPage(browser);
      await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () => !document.getElementById('activityTable').hidden,
        { timeout: 10000 }
      );
      const rowCount = await page.$$eval('#tableBody tr', (trs) => trs.length);
      await page.screenshot({ path: path.join(OUT_DIR, '04-ready.png') });
      console.log('✓ 04-ready.png，行数 =', rowCount);

      // ---------- 5. F5 刷新后数据仍在（功能验证） ----------
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () => !document.getElementById('activityTable').hidden,
        { timeout: 10000 }
      );
      const afterReload = await page.$$eval('#tableBody tr', (trs) => trs.length);
      console.log('✓ F5 刷新后行数 =', afterReload, afterReload === rowCount ? '（数据仍在）' : '（不一致！）');

      // ---------- 6. 新增后自动刷新（功能验证） ----------
      await page.type('#nameInput', '自动化测试活动');
      await page.type('#dateInput', '2027年12月1日');
      await page.type('#locationInput', '自动化测试地点');
      await page.click('#submitBtn');
      await page.waitForFunction(
        (n) => document.querySelectorAll('#tableBody tr').length === n,
        { timeout: 10000 },
        afterReload + 1
      );
      const afterAdd = await page.$$eval('#tableBody tr', (trs) => trs.length);
      console.log('✓ 新增后自动刷新，行数 =', afterAdd);

      // ---------- 7. 删除后自动刷新（功能验证） ----------
      page.on('dialog', (d) => d.accept());
      const lastDeleteBtn = await page.$('#tableBody tr:last-child button.danger');
      await lastDeleteBtn.click();
      await page.waitForFunction(
        (n) => document.querySelectorAll('#tableBody tr').length === n,
        { timeout: 10000 },
        afterReload
      );
      const afterDelete = await page.$$eval('#tableBody tr', (trs) => trs.length);
      console.log('✓ 删除后自动刷新，行数 =', afterDelete);

      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('截图脚本失败：', err);
  process.exit(1);
});
