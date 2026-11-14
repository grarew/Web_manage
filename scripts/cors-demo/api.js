/**
 * 演示用最小 API：默认【不带】CORS；加 --cors 参数时才加响应头。
 * 用途：录一次真实的 CORS 报错，再证明加响应头后恢复正常。
 */
const express = require('express');

const withCors = process.argv.includes('--cors');
const app = express();

if (withCors) {
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}

app.get('/api/activities', (req, res) => {
  res.json({ code: 0, data: [{ id: 1, name: '演示活动' }], msg: 'ok' });
});

const port = Number(process.env.DEMO_PORT || 3100);
app.listen(port, () => console.log('demo api on ' + port + ', cors=' + withCors));
