/**
 * 针对任意公网/本地地址做一次端到端验收：
 *  - 调接口：列表 → 新增 → 列表 → 删除 → 列表
 *  - 用无头浏览器打开页面并截图
 *
 * 用法：node scripts/verify-url.js <BASE_URL> [截图路径]
 */
const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
const OUT = process.argv[3] || 'screenshots/09-online-tunnel.png';

const j = (r) => r.json();

(async () => {
  console.log('目标:', BASE);

  const list0 = await fetch(BASE + '/api/activities').then(j);
  console.log('1) 初始列表:', list0.code, '条数 =', list0.data.length);

  const add = await fetch(BASE + '/api/activities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '线上验收活动', date: '2027年12月1日', location: '线上测试地点' })
  }).then(j);
  console.log('2) 新增:', add.code, add.msg, '| id =', add.data && add.data.id, '| name =', add.data && add.data.name);

  const list1 = await fetch(BASE + '/api/activities').then(j);
  console.log('3) 新增后列表条数 =', list1.data.length);

  const del = await fetch(BASE + '/api/activities/' + add.data.id, { method: 'DELETE' }).then(j);
  console.log('4) 删除:', del.code, del.msg);

  const list2 = await fetch(BASE + '/api/activities').then(j);
  console.log('5) 删除后列表条数 =', list2.data.length);

  const bad = await fetch(BASE + '/api/activities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '缺日期' })
  });
  const badJson = await bad.json();
  console.log('6) 少传字段:', bad.status, badJson.code, badJson.msg);

  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: true, args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const t = document.getElementById('activityTable');
    return t && !t.hidden;
  }, { timeout: 25000 });
  const rows = await page.$$eval('#tableBody tr', (t) => t.length);
  await page.screenshot({ path: OUT });
  console.log('7) 页面渲染行数 =', rows, '| 截图:', OUT);

  await browser.close();
  console.log('完成');
})().catch((e) => {
  console.error('验收失败:', e);
  process.exit(1);
});
