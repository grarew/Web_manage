# CORS 问题记录（真实复现）

> 记录时间：2026-11-14
> 环境：Windows + Edge（无头模式）+ Node 26 + Express 4
> 复现脚本：[scripts/cors-demo/](../scripts/cors-demo/)

## 一、场景

前后端**分开部署**：前端页面跑在 `http://localhost:3200`，后端接口跑在 `http://localhost:3100`。
两个端口属于**不同源**（同协议、同 IP，但端口不同），浏览器会执行 CORS 同源策略检查。

为了复现问题，后端故意**不加**任何 CORS 响应头：

```js
// scripts/cors-demo/api.js（问题版本：没有 CORS 中间件）
app.get('/api/activities', (req, res) => {
  res.json({ code: 0, data: [{ id: 1, name: '演示活动' }], msg: 'ok' });
});
```

## 二、报错原文

打开页面后，列表区显示「请求失败」，浏览器控制台（F12 → Console）输出：

```
Access to fetch at 'http://localhost:3100/api/activities' from origin 'http://localhost:3200'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
on the requested resource.
```

网络面板（F12 → Network）里该请求显示：

```
[requestfailed] http://localhost:3100/api/activities :: net::ERR_FAILED
[console.error] Failed to load resource: net::ERR_FAILED
```

页面上的表现（截图：[05-cors-error.png](../screenshots/05-cors-error.png)）：

```
⚠️ 请求失败
无法连接后端服务。请确认已运行 node app.js，并检查 config.js 里的 API_BASE
地址是否正确（也可能是 CORS 被拦截）。
原始错误：Failed to fetch
[ 重试 ]
```

## 三、定位过程

| 步骤 | 操作 | 结果 | 结论 |
|---|---|---|---|
| 1 | `curl http://localhost:3100/api/activities` 直接请求 | 正常返回 JSON | **后端服务本身没问题** |
| 2 | 浏览器打开页面，fetch 同一地址 | 失败，控制台报 CORS | 问题出在**浏览器跨域拦截** |
| 3 | 浏览器 Network 面板看请求 | `net::ERR_FAILED`，无响应体 | 请求被浏览器在发出/返回阶段拦下 |

关键判断依据：**curl 能通、浏览器不能通**，且报错里出现 `blocked by CORS policy`，就不是后端挂了，而是响应头缺失。

## 四、解决方案（在服务端加响应头）

在 `app.js` 里加 CORS 中间件，由**服务端**返回跨域响应头：

```js
const cors = require('cors');

app.use(cors({
  origin: '*',                                        // 允许任意来源（生产可改成具体域名）
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400
}));
```

等价的手写版本（不依赖 cors 包）：

```js
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);   // 处理预检
  next();
});
```

> ⚠️ **必须处理 OPTIONS 预检**：`DELETE` 请求和带 `Content-Type: application/json` 的 `POST/PUT` 会先发一个 OPTIONS 预检请求，不处理的话浏览器仍然会拦。`cors` 包会自动处理。

## 五、验证

1. 用 curl 看响应头：

```bash
curl -i http://localhost:3100/api/activities -H "Origin: http://localhost:3200"
```

返回：

```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
```

2. 重新打开页面，列表正常渲染（截图：[06-cors-fixed.png](../screenshots/06-cors-fixed.png)），控制台不再有 CORS 报错。

3. 预检请求验证：

```bash
curl -i -X OPTIONS http://localhost:3000/api/activities \
  -H "Origin: https://grarew.github.io" \
  -H "Access-Control-Request-Method: DELETE" \
  -H "Access-Control-Request-Headers: Content-Type"
```

返回 `HTTP/1.1 204 No Content`，并带 `Access-Control-Allow-Methods`、`Access-Control-Allow-Headers`。

## 六、错误做法（不要这么干）

- ❌ 用 `chrome.exe --disable-web-security` 或装浏览器插件绕过 CORS
- ❌ 把 fetch 的 `mode` 改成 `no-cors`（拿不到响应体，等于没数据）
- ❌ 用 JSONP 或代理服务器兜圈子（本项目不需要）

CORS 是**服务端的责任**，正确做法就是在服务端加响应头。

## 七、同类问题：本地好好的，线上白屏

部署到线上后，如果页面能打开但列表一直是「请求失败」，先查这一条：

```
config.js 里的 API_BASE 还是 http://localhost:3000
```

线上页面访问的是用户自己的电脑，`localhost` 指向用户本机，根本没有你的后端。
**改成线上后端地址**（如 `https://xxx.onrender.com`）即可。
