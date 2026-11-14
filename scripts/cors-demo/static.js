/**
 * 演示用静态服务器：在 3200 端口托管 index.html，
 * 并把 config.js 覆盖成指向 3100 的后端地址（故意制造跨域）。
 */
const express = require('express');
const path = require('path');

const app = express();
const root = path.join(__dirname, '..', '..');

app.get('/', (req, res) => res.sendFile(path.join(root, 'index.html')));
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send("window.APP_CONFIG = { API_BASE: 'http://localhost:3100' };");
});

app.listen(3200, () => console.log('demo static on 3200'));
