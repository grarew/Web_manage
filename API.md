# 活动通知管理接口文档

- **服务地址**：`http://localhost:3000`
- **接口前缀**：`/api`
- **数据格式**：请求体 `Content-Type: application/json`，响应体 `application/json; charset=utf-8`
- **已开启跨域**：`app.use(cors())`，网页可从 GitHub Pages 直接访问
- **数据持久化**：所有写操作落盘到 [data.json](data.json)，重启服务后数据不丢失

---

## 一、统一返回格式

**所有接口**（成功、失败、404、500）都返回同一个结构，不会出现"一个返回数组、一个返回对象"：

```json
{
  "code": 0,
  "data": null,
  "msg": "success"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | `number` | `0` = 成功；`400` / `404` / `500` = 失败，与 HTTP 状态码一致 |
| `data` | `any` | 成功时为返回数据；失败时恒为 `null` |
| `msg` | `string` | 提示信息，失败时说明具体原因 |

## 二、数据结构（Activity 对象）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `number` | 服务端生成 | 正整数主键，新增时自动分配为"当前最大 id + 1" |
| `name` | `string` | ✅ | 活动名称，不能为空字符串 |
| `date` | `string` | ✅ | 日期，如 `"2027年5月1日"`，不能为空 |
| `location` | `string` | ✅ | 地点，不能为空 |
| `link` | `string` | ❌ | 活动详情页地址（用于跳转），如 `"content/chunjieyundonghui.html"`；不填则存为 `""` |

## 三、接口文档表

| # | 方法 | 路径 | 参数 | 返回示例 |
|:-:|---|---|---|---|
| 1 | `GET` | `/api/activities` | **无** | `{"code":0,"data":[{"id":1,"name":"春季运动会","date":"2027年5月1日","location":"学校操场","link":"content/chunjieyundonghui.html"},{"id":2,"name":"夏季音乐节","date":"2027年6月15日","location":"学校操场","link":"content/xiajiyinyuejie.html"}],"msg":"查询成功"}` |
| 2 | `POST` | `/api/activities` | **Body（JSON）**：`name` 必填 string、`date` 必填 string、`location` 必填 string、`link` 可选 string | `{"code":0,"data":{"id":3,"name":"文档演示活动","date":"2027年9月1日","location":"报告厅","link":"content/chunjieyundonghui.html"},"msg":"新增成功"}` |
| 3 | `PUT` | `/api/activities/:id` | **Path**：`id` 正整数<br>**Body（JSON）**：`name` 必填 string、`date` 必填 string、`location` 必填 string、`link` 可选 string | `{"code":0,"data":{"id":3,"name":"文档演示活动(改)","date":"2027年9月2日","location":"大礼堂","link":"content/chunjieyundonghui.html"},"msg":"修改成功"}` |
| 4 | `DELETE` | `/api/activities/:id` | **Path**：`id` 正整数 | `{"code":0,"data":{"id":3,"name":"文档演示活动(改)","date":"2027年9月2日","location":"大礼堂","link":"content/chunjieyundonghui.html"},"msg":"删除成功"}`<br>（返回被删除的那条记录） |

> 上表 `返回示例` 均为**实测真实响应**。其中 POST / PUT / DELETE 的示例使用同一条测试数据，测试结束后已删除，`data.json` 恢复为 2 条原始数据。

---

## 四、错误返回

### 4.1 参数校验失败 → `400`

| 场景 | 请求示例 | 返回示例 |
|---|---|---|
| 缺少必填字段 | `POST /api/activities`<br>`{"name":"缺字段"}` | `{"code":400,"data":null,"msg":"date 必填且必须是字符串；location 必填且必须是字符串"}` |
| 类型不对 | `POST /api/activities`<br>`{"name":123,"date":"2027年1月1日","location":"操场"}` | `{"code":400,"data":null,"msg":"name 必填且必须是字符串"}` |
| 值为空字符串 | `POST /api/activities`<br>`{"name":"  ","date":"2027年1月1日","location":"操场"}` | `{"code":400,"data":null,"msg":"name 必填且必须是字符串"}` |
| 请求体不是合法 JSON | `POST /api/activities`<br>`{bad json` | `{"code":400,"data":null,"msg":"请求体不是合法的 JSON"}` |
| 路径 id 非法 | `DELETE /api/activities/abc` | `{"code":400,"data":null,"msg":"id 必须是正整数"}` |

### 4.2 资源不存在 → `404`

| 场景 | 请求示例 | 返回示例 |
|---|---|---|
| 修改不存在的 id | `PUT /api/activities/999` | `{"code":404,"data":null,"msg":"活动不存在"}` |
| 删除不存在的 id | `DELETE /api/activities/999` | `{"code":404,"data":null,"msg":"活动不存在"}` |
| 访问不存在的接口 | `GET /api/nothing` | `{"code":404,"data":null,"msg":"接口不存在"}` |

### 4.3 服务器异常 → `500`

由全局错误处理兜底，**永远不会把 HTML 报错栈返回给前端**：

```json
{"code":500,"data":null,"msg":"服务器内部错误"}
```

---

## 五、调用示例

### 5.1 浏览器 fetch（前端写法）

```js
const API_BASE = 'http://localhost:3000';

// GET 列表
const listRes = await fetch(API_BASE + '/api/activities');
const list = await listRes.json();
if (list.code === 0) console.log(list.data);

// POST 新增
const addRes = await fetch(API_BASE + '/api/activities', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '秋季运动会', date: '2027年10月1日', location: '学校体育馆' })
});
const added = await addRes.json();
console.log(added.code, added.msg, added.data);

// PUT 修改
await fetch(API_BASE + '/api/activities/1', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '春季运动会', date: '2027年5月1日', location: '学校主操场' })
});

// DELETE 删除
await fetch(API_BASE + '/api/activities/1', { method: 'DELETE' });
```

### 5.2 cURL

```bash
# GET 列表
curl http://localhost:3000/api/activities

# POST 新增
curl -X POST http://localhost:3000/api/activities \
  -H "Content-Type: application/json" \
  -d '{"name":"秋季运动会","date":"2027年10月1日","location":"学校体育馆"}'

# PUT 修改
curl -X PUT http://localhost:3000/api/activities/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"春季运动会","date":"2027年5月1日","location":"学校主操场"}'

# DELETE 删除
curl -X DELETE http://localhost:3000/api/activities/1
```

> Windows PowerShell 下 `-d` 里的中文可能乱码，建议改用 Node.js 的 `fetch` 或 Postman 测试。

---

## 六、自测结果

| # | 用例 | 期望 | 实测 |
|:-:|---|:-:|:-:|
| 1 | GET 列表 | 200 / code 0 | ✅ |
| 2 | POST 新增（含中文、link） | 200 / code 0，id 自动分配 | ✅ |
| 3 | POST 缺字段 | 400，msg 指明缺失字段 | ✅ |
| 4 | POST 类型错误 | 400，msg 指明字段 | ✅ |
| 5 | POST 非法 JSON | 400 | ✅ |
| 6 | PUT 修改成功 | 200 / code 0 | ✅ |
| 7 | PUT 不存在的 id | 404 | ✅ |
| 8 | PUT 非法 id | 400 | ✅ |
| 9 | DELETE 成功 | 200 / code 0，返回被删记录 | ✅ |
| 10 | DELETE 重复删除 | 404 | ✅ |
| 11 | DELETE 非法 id | 400 | ✅ |
| 12 | 未知路由 | 404 JSON | ✅ |
| 13 | 重启服务后数据仍在 | 数据落盘 | ✅ |

---

## 七、启动方式

```bash
cd Web_manage
npm install     # 首次运行
node app.js     # 启动，默认端口 3000
```

> 换端口：`PORT=8080 node app.js`（PowerShell：`$env:PORT=8080; node app.js`）
