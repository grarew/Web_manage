/**
 * 活动通知管理 —— 后端服务（整个网站的大脑）
 *
 * 负责两件事：
 *   1. 提供「活动」的增删改查接口（index.html 调用）
 *   2. 提供「AI 对话」接口（chat.html 调用，转发给 DeepSeek）
 *
 * 数据存在 data.json 里，重启不丢。
 *
 * 本文件结构（从上到下按顺序读）：
 *   1. 加载 .env 环境变量（API Key 只放 .env）
 *   2. AI 配置、系统提示词、工具定义
 *   3. 读写 data.json 的辅助函数
 *   4. 接口：/api/chat（AI 对话）+ /api/activities（增删改查）
 *   5. 托管前端页面 + 错误处理 + 启动服务
 *
 * 接口：GET/POST /api/activities、PUT/DELETE /api/activities/:id、POST /api/chat
 * 统一返回 { code, data, msg }，code=0 成功，400/404/500 失败
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// 加载 .env（API Key 只放这里，绝不进代码）
(function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(function (line) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) return;
      const key = m[1];
      let val = m[2];
      // 去掉首尾引号
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    });
  } catch (e) {
    console.warn('[env] 读取 .env 失败，将只使用系统环境变量：', e.message);
  }
})();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// AI 对话配置（全部来自环境变量，代码里不含任何 Key）
const CHAT = {
  baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com', // 接口地址
  apiKey: process.env.DEEPSEEK_API_KEY || '',                          // API Key（放 .env）
  model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',                // 模型
  maxContextChars: Number(process.env.CHAT_MAX_CONTEXT_CHARS) || 12000, // 上下文上限（字符）
  maxHistoryTurns: Number(process.env.CHAT_MAX_HISTORY_TURNS) || 20,    // 历史条数上限
  timeoutMs: Number(process.env.CHAT_TIMEOUT_MS) || 60000               // 超时（毫秒）
};

// ---------- 系统提示词：把角色和边界说清楚 ----------
const SYSTEM_PROMPT =
  '你是「活动通知助手」，一名帮助用户了解和管理活动信息的智能助理。\n' +
  '你的职责：\n' +
  '1. 友好、简洁地回答用户关于活动安排、场地、日期等各类问题；\n' +
  '2. 协助用户组织活动信息，给出清晰、有条理的建议；\n' +
  '3. 使用中文回复。\n' +
  '你能执行的操作：\n' +
  '- 你可以调用工具来「新增」「修改」「删除」活动；\n' +
  '- 当用户明确要求增删改活动时，直接调用对应工具即可，不要用文字代替。\n' +
  '重要约束：\n' +
  '- 删除活动前，如果用户没有明确指定目标，先向用户确认要删除哪一条；\n' +
  '- 新增或修改活动时，日期、地点等信息如果用户没说全，先询问补齐，不要瞎猜。\n' +
  '你的边界：\n' +
  '- 只处理与活动、通知、日程相关的话题；\n' +
  '- 不提供医疗、法律、投资等专业建议；\n' +
  '- 不编造不确定的信息，不确定时如实说明。';

// 工具定义（Function Calling）：告诉 AI 它能调哪些工具，AI 决定后由后端真实执行
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_activity',
      description: '新增一条活动。当用户明确要求添加、创建、登记一个新的活动时调用。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '活动名称，例如"秋季运动会"' },
          date: { type: 'string', description: '活动日期，例如"2027年10月1日"' },
          location: { type: 'string', description: '活动地点，例如"学校体育馆"' }
        },
        required: ['name', 'date', 'location']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_activity',
      description: '修改一条已有活动。当用户要求更改某个活动的名称、日期或地点时调用。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: '要修改的活动 ID' },
          name: { type: 'string', description: '新的活动名称' },
          date: { type: 'string', description: '新的活动日期' },
          location: { type: 'string', description: '新的活动地点' }
        },
        required: ['id', 'name', 'date', 'location']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_activity',
      description: '删除一条活动。当用户明确要求删除、移除某个活动时调用。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: '要删除的活动 ID' }
        },
        required: ['id']
      }
    }
  }
];

// 按 id 找到活动在数组里的下标；找不到返回 -1，id 非法返回 -2
function findActivityIndex(data, rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return -2;
  return data.findIndex((a) => a.id === id);
}

function executeTool(name, args) {
  // 新增活动
  if (name === 'add_activity') {
    const errors = validateActivity(args);
    if (errors.length > 0) return { ok: false, message: errors.join('；') };
    const data = readData();
    const nextId = data.length ? Math.max(...data.map((a) => a.id)) + 1 : 1;
    const item = {
      id: nextId,
      name: args.name.trim(),
      date: args.date.trim(),
      location: args.location.trim(),
      link: ''
    };
    data.push(item);
    writeData(data);
    return { ok: true, message: '已新增活动「' + item.name + '」（ID ' + item.id + '）', data: item };
  }

  // 修改活动
  if (name === 'update_activity') {
    const errors = validateActivity(args);
    if (errors.length > 0) return { ok: false, message: errors.join('；') };
    const data = readData();
    const idx = findActivityIndex(data, args.id);
    if (idx === -2) return { ok: false, message: 'id 必须是正整数' };
    if (idx === -1) return { ok: false, message: '活动不存在（ID ' + args.id + '）' };
    data[idx] = {
      id: data[idx].id,
      name: args.name.trim(),
      date: args.date.trim(),
      location: args.location.trim(),
      link: data[idx].link || ''
    };
    writeData(data);
    return { ok: true, message: '已修改活动 ID ' + data[idx].id + ' 为「' + args.name.trim() + '」', data: data[idx] };
  }

  // 删除活动
  if (name === 'delete_activity') {
    const data = readData();
    const idx = findActivityIndex(data, args.id);
    if (idx === -2) return { ok: false, message: 'id 必须是正整数' };
    if (idx === -1) return { ok: false, message: '活动不存在（ID ' + args.id + '）' };
    const removed = data.splice(idx, 1)[0];
    writeData(data);
    return { ok: true, message: '已删除活动「' + removed.name + '」（ID ' + removed.id + '）', data: removed };
  }

  return { ok: false, message: '未知工具：' + name };
}

// 种子数据：首次没有 data.json 时用于初始化
const SEED = [
  { id: 1, name: '春季运动会', date: '2027年5月1日', location: '学校操场' },
  { id: 2, name: '夏季音乐节', date: '2027年6月15日', location: '学校操场' }
];

// 跨域：允许别的网页调用我们的接口（自动加响应头 + 处理预检请求）
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400
}));

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

// ---------- 把活动数据转成给 AI 看的上下文文本 ----------
// 让大模型能"看到"网页里的活动信息，从而准确回答"有哪些活动、在哪办"等问题
function buildActivityContext(activities) {
  if (!Array.isArray(activities) || activities.length === 0) {
    return '【当前活动数据】\n暂无任何活动。';
  }
  const lines = activities.map(function (a) {
    return '- ID ' + a.id + '：' + a.name +
      '（日期：' + a.date + '，地点：' + a.location + '）' +
      (a.link ? '，详情页：' + a.link : '');
  });
  return '【当前活动数据】（共 ' + activities.length + ' 条，回答用户问题时请以这里的真实数据为准，不要凭空编造）\n' +
    lines.join('\n');
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
  // link 可选：用于页面跳转（活动详情页地址）
  if (body.link !== undefined && (typeof body.link !== 'string' || body.link.trim() === '')) {
    errors.push('link 可选，如果填写必须是字符串');
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

// ======================================================================
// 流式对话接口（SSE）：后端转发调用 DeepSeek，Key 只在服务端环境变量
// ======================================================================
// 请求体：{ messages: [{ role: 'user'|'assistant', content: string }, ...] }
// 前端只传最近的对话历史，服务端负责拼接系统提示词 + 截断超长上下文
// 响应：text/event-stream，逐字向前端推送大模型输出
app.post('/api/chat', async (req, res) => {
  // 1) 未配置 Key 时给出友好提示，而不是甩 500
  if (!CHAT.apiKey) {
    return fail(res, 500, '服务端尚未配置 DEEPSEEK_API_KEY，请在 .env 中填写后再试');
  }

  // 2) 校验请求体
  const body = req.body;
  if (!body || !Array.isArray(body.messages)) {
    return fail(res, 400, 'messages 必须是数组');
  }

  const history = body.messages
    .filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'; })
    .map(function (m) { return { role: m.role, content: m.content }; });

  if (history.length === 0) {
    return fail(res, 400, 'messages 不能为空');
  }

  // 3) 读取当前活动数据，注入到系统提示词，让 AI 能"看到"网页里的活动信息
  let activitiesSnapshot = [];
  try {
    activitiesSnapshot = readData();
    if (!Array.isArray(activitiesSnapshot)) activitiesSnapshot = [];
  } catch (e) {
    activitiesSnapshot = [];
  }

  const activityInfo = buildActivityContext(activitiesSnapshot);

  // 4) 拼接系统提示词 + 数据上下文 + 截断上下文（超长就从最早的开始丢）
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + '\n\n' + activityInfo }
  ].concat(history);
  let truncated = false;
  while (messages.length > 1) {
    const total = messages.reduce(function (n, m) { return n + m.content.length; }, 0);
    if (total <= CHAT.maxContextChars) break;
    // 系统提示词（下标 0）不动，从最早的历史消息开始丢弃
    const removed = messages.splice(1, 1)[0];
    if (removed && removed.role === 'user') truncated = true;
  }
  // 条数上限保险
  while (messages.length - 1 > CHAT.maxHistoryTurns) {
    messages.splice(1, 1);
    truncated = true;
  }

  // 4) 设置 SSE 响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders && res.flushHeaders();

  // SSE 发送工具
  const send = (event, data) => {
    if (res.writableEnded) return;
    res.write('event: ' + event + '\n');
    res.write('data: ' + JSON.stringify(data) + '\n\n');
  };

  // 提示前端上下文已被截断
  if (truncated) {
    send('notice', { text: '（对话较长，已自动丢弃最早的部分上下文）' });
  }

  // 5) 客户端断开（停止生成）时，中断上游请求
  // 注意：必须监听 res 的 close（响应连接关闭），而非 req 的 close。
  // 在 Node 新版中，req 的 close 会在请求体读完时就触发，导致误中断。
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHAT.timeoutMs);
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  // 把 DeepSeek 的 HTTP 错误码翻译成能看懂的中文
  function mapUpstreamError(status, detail) {
    if (status === 401) return 'API Key 无效或已失效，请检查 .env 里的 DEEPSEEK_API_KEY 是否正确（401 未授权）';
    if (status === 402) return '账户余额不足，请前往 DeepSeek 开放平台充值（402 余额不足）';
    if (status === 429) return '请求过于频繁，触发了限流，请稍后再试（429 限流）';
    if (status >= 500) return '大模型服务暂时不可用，请稍后重试（' + status + '）';
    return '大模型请求失败（HTTP ' + status + '）' + (detail ? '：' + detail : '');
  }

  // 调用 DeepSeek 的公共部分（发请求 + 错误处理），stream 决定是否流式
  async function callDeepSeek(reqMessages, stream, withTools) {
    const bodyObj = {
      model: CHAT.model,
      messages: reqMessages,
      stream: stream,
      temperature: 0.7
    };
    if (withTools) bodyObj.tools = TOOLS;
    const r = await fetch(CHAT.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CHAT.apiKey
      },
      body: JSON.stringify(bodyObj),
      signal: controller.signal
    });
    if (!r.ok) {
      let detail = '';
      try { const eb = await r.json(); detail = (eb && eb.error && eb.error.message) || JSON.stringify(eb); } catch (e) {}
      throw new Error(mapUpstreamError(r.status, detail));
    }
    return r;
  }

  // 非流式调用，返回解析好的完整 JSON（用于判断 AI 是否要调工具）
  async function callNonStream(reqMessages, withTools) {
    const r = await callDeepSeek(reqMessages, false, withTools);
    return await r.json();
  }

  // 流式调用，把 AI 一个字一个字通过 send('delta') 推给前端
  async function callStream(reqMessages) {
    const r = await callDeepSeek(reqMessages, true, false);
    const reader = r.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices && json.choices[0] && json.choices[0].delta;
          const text = delta && delta.content;
          if (text) send('delta', { text: text });
        } catch (e) { /* 忽略无法解析的行 */ }
      }
    }
  }

  try {
    // ========== 第一阶段：工具决策（非流式，带 tools） ==========
    const firstResp = await callNonStream(messages, true);
    const choice = firstResp.choices && firstResp.choices[0];
    const toolCalls = choice && choice.message && choice.message.tool_calls;

    // AI 决定调用工具 → 执行 → 结果回传 → 第二阶段流式生成最终回复
    if (toolCalls && toolCalls.length > 0) {
      // 把 AI 的 assistant 消息（含 tool_calls）追加进上下文
      messages.push(choice.message);

      // 依次执行每个工具，把结果作为 role=tool 消息追加
      for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i];
        const fnName = tc.function && tc.function.name;
        let fnArgs = {};
        try { fnArgs = JSON.parse(tc.function && tc.function.arguments || '{}'); } catch (e) { fnArgs = {}; }

        const result = executeTool(fnName, fnArgs);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result.message
        });

        // 工具执行后，前端提示一下操作结果（便于用户感知发生了什么）
        send('notice', { text: result.message });
      }

      // ========== 第二阶段：流式生成最终回复 ==========
      await callStream(messages);
      send('done', {});
      clearTimeout(timeout);
      res.end();
      return;
    }

    // AI 不需要调工具 → 直接流式生成回复
    await callStream(messages);
    send('done', {});
    clearTimeout(timeout);
    res.end();
  } catch (e) {
    clearTimeout(timeout);
    let friendly;
    if (e && e.name === 'AbortError') {
      // 区分「用户主动停止」和「超时」
      if (res.writableEnded) return; // 客户端已断开，无需再发
      friendly = '请求超时，请重试（已等待 ' + (CHAT.timeoutMs / 1000) + ' 秒）';
    } else {
      friendly = '网络或服务异常：' + (e.message || String(e));
    }
    if (!res.writableEnded) {
      send('error', { message: friendly });
      res.end();
    }
  }
});

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
    location: req.body.location.trim(),
    link: typeof req.body.link === 'string' ? req.body.link.trim() : ''
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
    location: req.body.location.trim(),
    link: typeof req.body.link === 'string' ? req.body.link.trim() : (data[idx].link || '')
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

// ---------- 静态托管前端（单服务部署时可直接打开页面） ----------
// 只放行前端需要的文件，避免把数据文件和源码暴露出去。
const SENSITIVE = /^\/(app\.js|data\.json|package\.json|package-lock\.json)$/i;
app.use((req, res, next) => {
  if (SENSITIVE.test(req.path) || req.path.indexOf('/node_modules/') === 0 || req.path.indexOf('/.git/') === 0) {
    return fail(res, 404, '接口不存在');
  }
  next();
});
app.use(express.static(__dirname, { index: 'index.html' }));

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
