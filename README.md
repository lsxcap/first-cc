# Juanwork1.0

刘娟工作台的独立重构版本，使用 Vite + React 构建。

## 启动

```bash
npm install
npm run dev
```

## 功能

- 今日填报
- 每日数据
- 月度看板
- 员工管理
- 腾讯云 CloudBase / 本地存储降级支持

## 说明

- 生产数据优先使用腾讯云 CloudBase。
- 本地存储仅作为离线降级与临时备份。
- 管理员模式支持跨页面保持与自动超时退出。

## 腾讯云配置

复制 `.env.example` 为 `.env`，并填写腾讯云 CloudBase 环境 ID：

```bash
VITE_CLOUDBASE_ENV_ID=your-cloudbase-env-id
VITE_CLOUDBASE_REGION=ap-shanghai
```
