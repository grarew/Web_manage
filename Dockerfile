# 活动通知管理 · 单服务镜像（后端接口 + 前端页面）
FROM node:20-alpine

WORKDIR /app

# 先装依赖，利用 Docker 缓存
COPY package*.json ./
RUN npm ci --omit=dev

# 再拷源码（data.json 会一起进去，作为初始数据）
COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "app.js"]
