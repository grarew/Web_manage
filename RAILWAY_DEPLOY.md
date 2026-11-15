# 部署到 Railway（后端 + 对话页）

本项目是 Node.js + Express 单服务，`app.js` 同时提供接口、静态页面（含 `chat.html` 流式对话页）。
Railway 会自动识别根目录的 `Dockerfile` 并构建部署。

---

## 一、准备工作

1. 代码推送到 GitHub 仓库 `grarew/Web_manage`（已连接）。
2. 拿到 DeepSeek API Key（https://platform.deepseek.com → API Keys → 创建）。

---

## 二、部署步骤（推荐：网页版连接 GitHub）

1. 打开 <https://railway.app> → 用 **GitHub 账号**登录。
2. 点 **New Project** → **Deploy from GitHub repo**。
3. 授权 Railway 访问，选择仓库 **`grarew/Web_manage`**。
4. Railway 会自动识别根目录的 `Dockerfile`，用 Node 20 镜像构建并部署。

### 关键：注入环境变量（API Key 不进代码）

部署完成后，进入项目的 **Variables** 页，添加：

| 变量名 | 值 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | `sk-你的Key` | 必填，大模型对话用 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | 可选，默认已内置 |
| `DEEPSEEK_MODEL` | `deepseek-chat` | 可选 |
| `PORT` | `3000` | Railway 会自动注入，一般无需手动设置 |

> ⚠️ 不要把 Key 写进 `.env` 后提交——`.env` 已被 `.gitignore` 忽略，且 `.dockerignore` 排除了它。
> Key 只在 Railway 平台的环境变量里，代码库全程不出现。

5. 保存后 Railway 会自动 **重新部署**，环境变量生效。

---

## 三、Railway 的几个设置

| 设置 | 位置 | 建议 |
|---|---|---|
| 生成公网域名 | Settings → Networking → **Generate Domain** | 生成 `xxx.up.railway.app` 地址 |
| 健康检查 | Settings → Health Check | 可填 `/api/activities` |
| 自动部署 | 默认开启 | 每次 push 到 GitHub 自动重新构建 |

---

## 四、部署后自检

- [ ] 打开 `https://你的域名/`，活动列表正常加载
- [ ] 打开 `https://你的域名/chat.html`，能对话且文字逐字流出
- [ ] 连续问 3 轮，上下文接得上
- [ ] 点「停止生成」能中断
- [ ] 把 `DEEPSEEK_API_KEY` 故意填错，页面出现「API Key 无效（401）」而非白屏

---

## 五、注意事项

1. **磁盘不持久**：Railway 免费版磁盘是临时的，重新部署后 `data.json` 会恢复成仓库里的初始数据。演示/验收够用；要长期保存需挂 Volume 或换数据库。
2. **冷启动**：免费版无流量会休眠，首次访问需等几秒。
3. **前端跨域**：Railway 是单服务同源部署，页面和接口同域名，无跨域问题，`config.js` 的 `API_BASE` 留空即可（当前默认同源）。

---

## 六、CLI 方式（可选，需要本地 Docker 或直接 git 部署）

```bash
# 安装 Railway CLI
npm i -g @railway/cli

# 登录
railway login

# 关联项目（或新建）
railway init

# 部署（会读取 Dockerfile）
railway up

# 设置环境变量
railway variables --set DEEPSEEK_API_KEY=sk-你的Key

# 打开公网地址
railway open
```
