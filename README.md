# 活动通知接口 · 快速上手

## 一、启动命令

在本项目目录（`Web_manage`）打开终端，执行：

```bash
npm install     # 第一次运行才需要
node app.js     # 启动服务，默认端口 3000
```

看到 `活动通知接口已启动: http://localhost:3000` 即成功。**此窗口不要关**，另开一个终端测试。

换端口：`set PORT=8080 && node app.js`

---

## 二、接口文档表

| 方法 | 路径 | 参数 | 返回示例 |
|---|---|---|---|
| `GET` | `/api/activities` | 无 | `{"code":0,"data":[{"id":1,"name":"春季运动会","date":"2027年5月1日","location":"学校操场","link":"content/chunjieyundonghui.html"}],"msg":"查询成功"}` |
| `POST` | `/api/activities` | Body(JSON)：`name`、`date`、`location` 必填（string）；`link` 可选 | `{"code":0,"data":{"id":3,"name":"秋季运动会","date":"2027年10月1日","location":"学校体育馆","link":""},"msg":"新增成功"}` |
| `PUT` | `/api/activities/:id` | Path：`id`（正整数）<br>Body：同 POST | `{"code":0,"data":{"id":3,"name":"秋季运动会(改)","date":"2027年10月2日","location":"大礼堂","link":""},"msg":"修改成功"}` |
| `DELETE` | `/api/activities/:id` | Path：`id`（正整数） | `{"code":0,"data":{"id":3,...},"msg":"删除成功"}` |

---

## 三、返回格式

所有接口统一返回：

```json
{ "code": 0, "data": null, "msg": "success" }
```

| 字段 | 说明 |
|---|---|
| `code` | `0` 成功；`400` / `404` / `500` 失败 |
| `data` | 成功时为数据，失败时为 `null` |
| `msg` | 提示信息 |

**错误示例（少传字段 → 400）：**

```json
{"code":400,"data":null,"msg":"date 必填且必须是字符串；location 必填且必须是字符串"}
```

---

## 四、测试命令（curl）

```bash
# 查列表
curl http://localhost:3000/api/activities

# 新增
curl -X POST http://localhost:3000/api/activities -H "Content-Type: application/json" -d "{\"name\":\"秋季运动会\",\"date\":\"2027年10月1日\",\"location\":\"学校体育馆\"}"

# 删除
curl -X DELETE http://localhost:3000/api/activities/3

# 少传字段，应返回 400
curl -i -X POST http://localhost:3000/api/activities -H "Content-Type: application/json" -d "{\"name\":\"缺字段\"}"
```

> PowerShell 下中文可能乱码，先执行：`$OutputEncoding=[Text.Encoding]::UTF8; [Console]::OutputEncoding=[Text.Encoding]::UTF8`
> 更完整的说明见 [API.md](API.md)

---

## 五、前端页面

启动后直接访问 <http://localhost:3000/> 即可打开管理页面（Express 已托管静态文件）。

| 特性 | 说明 |
|---|---|
| 数据来源 | 全部由 `fetch` 调用接口渲染，**没有写死在 JS 数组里** |
| 三种状态 | 加载中（转圈）/ 空数据（📭）/ 请求失败（⚠️ + 重试按钮） |
| 自动刷新 | 新增、删除成功后自动重新拉取列表 |
| 数据持久化 | 数据在 `data.json`，按 F5 或重启服务都不丢 |
| 后端地址配置 | 抽在 [config.js](config.js)：同源部署留空，GitHub Pages 用 `PAGES_API_BASE` |

三态截图见 [screenshots/](screenshots/)；CORS 复现记录见 [docs/CORS问题记录.md](docs/CORS问题记录.md)；部署踩坑记录见 [docs/部署问题记录.md](docs/部署问题记录.md)；部署步骤见 [DEPLOY.md](DEPLOY.md)。

> **在线页面**：<https://grarew.github.io/Web_manage/>（GitHub Pages，会自动请求 `config.js` 里的 `PAGES_API_BASE`）
> **单服务线上地址**：把后端部署到 Render 后，直接访问 Render 域名即可，页面和接口同源，不用改配置。
> 一键部署入口：<https://render.com/deploy?repo=https://github.com/grarew/Web_manage>

重新生成截图（需要 `npm i -D puppeteer-core`）：

```bash
node scripts/screenshot.js
```
