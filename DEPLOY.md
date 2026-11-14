# 部署说明

前端是纯静态文件，后端是 Node.js + Express。有两种部署方式：

| 方式 | 结构 | 地址 | 优点 |
|---|---|---|---|
| **A. 单服务**（推荐新手） | Express 同时提供接口和页面 | 一个域名 | 没有跨域问题，最简单 |
| **B. 前后端分离** | 前端放 GitHub Pages，后端放 Render | 两个域名 | 前端可独立更新，但需要 CORS |

> 本项目 `app.js` 已内置静态托管：访问 `https://你的域名/` 就能直接打开页面。

---

## 方式 A：单服务部署到 Render（免费）

### 一键部署入口

登录 GitHub 的前提下，直接点这个链接（会把仓库和 `render.yaml` 自动带进去）：

**<https://render.com/deploy?repo=https://github.com/grarew/Web_manage>**

> 需要先注册/登录 Render（用 GitHub 账号登录最快），然后点 **Apply** 即可。

### 或者手动操作

1. 把代码推到 GitHub（已有仓库 `grarew/Web_manage`）。
2. 打开 <https://render.com> → 注册并连接 GitHub。
3. 点 **New +** → **Blueprint** → 选择本仓库（仓库里有 `render.yaml`，会自动识别）。
   或者用 **New +** → **Web Service**，手动填：
   - **Build Command**：`npm install --omit=dev`
   - **Start Command**：`node app.js`
   - **Health Check Path**：`/api/activities`
4. 部署完成后，Render 会给你一个地址，例如：
   ```
   https://web-manage-api.onrender.com
   ```
5. 打开这个地址，页面和接口都能用，不需要改任何配置（同源）。

### ⚠️ 免费版的两个限制

| 限制 | 影响 | 应对 |
|---|---|---|
| **磁盘不是持久的** | 重新部署 / 服务重启后 `data.json` 会恢复成仓库里的初始数据 | 验收演示够用；要长期保存需挂持久磁盘或换数据库 |
| **15 分钟无访问会休眠** | 第一次打开要等 30~60 秒唤醒 | 打开页面前先访问一次，或接受等待 |

**要真正持久化数据**，二选一：
- Render 付费计划挂 **Persistent Disk**（挂载到 `/data`，把 `DATA_FILE` 指过去）；
- 把 `data.json` 换成数据库（SQLite/PostgreSQL），改 `readData/writeData` 两个函数即可。

---

## 方式 B：前端 GitHub Pages + 后端 Render（分离部署）

### 1. 后端部署

同方式 A，拿到后端地址，例如 `https://web-manage-api.onrender.com`。

### 2. 前端改配置

打开 [config.js](config.js)，把地址改成线上后端：

```js
window.APP_CONFIG = {
  API_BASE: 'https://web-manage-api.onrender.com'
};
```

> **这一步是「本地好好的、线上白屏」的头号原因**：忘记把 `localhost:3000` 换成线上地址。

### 3. 前端部署

`index.html`、`config.js`、`content/`、`images/` 推到 GitHub，开启 Pages：

- 仓库 **Settings → Pages → Source** 选 `main` 分支 / root 目录；
- 访问地址形如 `https://grarew.github.io/Web_manage/`。

### 4. 确认 CORS 已开启

后端 `app.js` 里已有：

```js
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type'] }));
```

如果没有，线上前端会报：

```
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

记录见 [docs/CORS问题记录.md](docs/CORS问题记录.md)。

---

## 方式 C：自己的云服务器（阿里云 / 腾讯云 / 华为云）

```bash
# 1. 装 Node 18+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. 拉代码
git clone https://github.com/grarew/Web_manage.git
cd Web_manage
npm install

# 3. 用 pm2 常驻（推荐，进程挂了自动拉起）
npm i -g pm2
pm2 start app.js --name web-manage
pm2 save
pm2 startup

# 4. 放行安全组端口（如 3000）
```

访问 `http://服务器公网IP:3000/`。

> 云服务器磁盘是持久的，`data.json` 能真正长期保存。
> 想用 80 端口 + 域名，加 Nginx 反向代理即可。

---

## 方式 D：阿里云函数计算（FC）

1. 新建「Web 函数」，运行环境选 Node.js 18+，上传代码包（排除 `node_modules`）。
2. 启动命令填 `node app.js`，监听端口填 `3000`。
3. 函数计算的磁盘同样**不持久**，数据落盘会失效——需要改用 OSS/表格存储/数据库。

---

## 部署后自检清单

- [ ] 打开线上地址，列表能加载出数据
- [ ] 新增一条，列表自动刷新出现新数据
- [ ] 刷新浏览器（F5），数据仍在
- [ ] 删除一条，列表自动刷新
- [ ] 故意少传字段，接口返回 400 且页面有提示
- [ ] `config.js` 里的 `API_BASE` 不是 `localhost`
- [ ] 后端有 `Access-Control-Allow-Origin` 响应头（分离部署时）
