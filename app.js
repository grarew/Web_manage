/**
 * 活动通知管理接口
 * Node.js + Express，数据落盘到 data.json（重启后数据仍在）
 *
 * 接口：
 *   GET    /api/activities        获取活动列表
 *   POST   /api/activities        新增活动
 *   PUT    /api/activities/:id    修改活动（可选加分项）
 *   DELETE /api/activities/:id    删除活动
 *
 * 统一返回格式：{ code, data, msg }
 *   code = 0    表示成功
 *   code = 400/404/500 与 HTTP 状态码一致，表示失败
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// 种子数据：首次没有 data.json 时用于初始化
const SEED = [
  { id: 1, name: '春季运动会', date: '2027年5月1日', location: '学校操场' },
  { id: 2, name: '夏季音乐节', date: '2027年6月15日', location: '学校操场' }
];

// ---------- 跨域：两行代码允许网页（如 GitHub Pages）访问 ----------
app.use(cors());

// 解析 JSON 请求体
app.use(express.json());

// ---------- 统一响应封装 ----------
function ok(res, data, msg = 'success') {
  res.json({ code: 0, data, msg });
}

function fail(res, httpCode, msg) {
  res.status(httpCode).json({ code: httpCode, data: null, msg });
}

// ---------- 数据落盘（同步读写，简单可靠） ----------
function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(SEED, null, 2), 'utf8');
    return JSON.parse(JSON.stringify(SEED));
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  if (!raw.trim()) return [];
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ---------- 参数校验 ----------
function validateActivity(body) {
  const errors = [];
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return ['请求体必须是 JSON 对象'];
  }
  if (typeof body.name !== 'string' || body.name.trim() === '') {
    errors.push('name 必填且必须是字符串');
  }
  if (typeof body.date !== 'string' || body.date.trim() === '') {
    errors.push('date 必填且必须是字符串');
  }
  if (typeof body.location !== 'string' || body.location.trim() === '') {
    errors.push('location 必填且必须是字符串');
  }
  return errors;
}

function parseId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return { error: 'id 必须是正整数' };
  }
  return { id };
}

// ---------- 接口 ----------

// GET 列表
app.get('/api/activities', (req, res) => {
  const data = readData();
  ok(res, data, '查询成功');
});

// POST 新增
app.post('/api/activities', (req, res) => {
  const errors = validateActivity(req.body);
  if (errors.length > 0) {
    return fail(res, 400, errors.join('；'));
  }

  const data = readData();
  const nextId = data.length ? Math.max(...data.map((a) => a.id)) + 1 : 1;
  const item = {
    id: nextId,
    name: req.body.name.trim(),
    date: req.body.date.trim(),
    location: req.body.location.trim()
  };
  data.push(item);
  writeData(data);
  ok(res, item, '新增成功');
});

// PUT 修改（加分项）
app.put('/api/activities/:id', (req, res) => {
  const parsed = parseId(req);
  if (parsed.error) return fail(res, 400, parsed.error);

  const errors = validateActivity(req.body);
  if (errors.length > 0) {
    return fail(res, 400, errors.join('；'));
  }

  const data = readData();
  const idx = data.findIndex((a) => a.id === parsed.id);
  if (idx === -1) {
    return fail(res, 404, '活动不存在');
  }

  data[idx] = {
    id: parsed.id,
    name: req.body.name.trim(),
    date: req.body.date.trim(),
    location: req.body.location.trim()
  };
  writeData(data);
  ok(res, data[idx], '修改成功');
});

// DELETE 删除
app.delete('/api/activities/:id', (req, res) => {
  const parsed = parseId(req);
  if (parsed.error) return fail(res, 400, parsed.error);

  const data = readData();
  const idx = data.findIndex((a) => a.id === parsed.id);
  if (idx === -1) {
    return fail(res, 404, '活动不存在');
  }

  const removed = data.splice(idx, 1)[0];
  writeData(data);
  ok(res, removed, '删除成功');
});

// ---------- 404：未匹配到的接口也返回统一 JSON ----------
app.use((req, res) => {
  fail(res, 404, '接口不存在');
});

// ---------- 全局错误处理：任何异常都返回 JSON，不甩 HTML 报错栈 ----------
app.use((err, req, res, next) => {
  // 请求体不是合法 JSON（express.json() 抛出的 SyntaxError）
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return fail(res, 400, '请求体不是合法的 JSON');
  }
  console.error('[服务器错误]', err);
  fail(res, 500, '服务器内部错误');
});

app.listen(PORT, () => {
  console.log(`活动通知接口已启动: http://localhost:${PORT}`);
  console.log(`  GET    http://localhost:${PORT}/api/activities`);
  console.log(`  POST   http://localhost:${PORT}/api/activities`);
  console.log(`  PUT    http://localhost:${PORT}/api/activities/:id`);
  console.log(`  DELETE http://localhost:${PORT}/api/activities/:id`);
});
