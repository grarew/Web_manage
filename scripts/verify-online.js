const puppeteer = require('puppeteer-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: true, args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });

  await page.goto('https://grarew.github.io/Web_manage/', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 6000));

  const info = await page.evaluate(() => {
    const table = document.getElementById('activityTable');
    return {
      title: document.title,
      tableVisible: table ? !table.hidden : false,
      rows: document.querySelectorAll('#tableBody tr').length,
      apiInfo: (document.getElementById('apiInfo') || {}).textContent || '',
      text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300)
    };
  });

  console.log(JSON.stringify(info, null, 2));
  console.log('控制台错误:', logs.length ? logs.join(' | ') : '(无)');

  await page.screenshot({ path: 'screenshots/08-online-page.png' });
  console.log('截图: screenshots/08-online-page.png');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
