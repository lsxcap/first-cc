# 刘娟工作台

一个用于员工日报填报、业绩数据收集和领导看板的移动端优先工作台。第一版采用 Netlify 部署前端，Firebase Authentication + Firestore 保存共享数据。

## 功能

- 打开链接直接进入今日填报，员工选择自己的姓名后提交日报。
- 每日数据里可查看填报状态，并点击员工姓名查看当日明细和月度小汇总。
- 员工管理页输入管理员口令后，可维护员工、目标和初始化样例数据。
- 月度看板包含月度完成率、排行榜、考核规则归纳和分组个人明细。
- 今日填报页内置考核机制速览，方便员工边看规则边填报。
- 未配置 Firebase 时会自动使用浏览器本地演示数据，方便先看页面效果。

## 本地运行

```bash
npm install
npm run dev
```

未配置 `.env` 时，页面会以本地演示模式运行。

## Firebase 配置

1. 在 Firebase 控制台创建或打开项目。
2. 启用 Authentication。
3. 启用 Firestore Database。
4. 创建 Web App，把配置填入 `.env` 或 Netlify 环境变量：

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_ADMIN_ACCESS_CODE=
```

5. Authentication 启用 `Anonymous` 登录方式。
6. 发布 `firestore.rules` 到 Firestore Rules。

## Netlify 环境变量

在 Netlify 项目设置的 Environment variables 中添加：

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_ADMIN_ACCESS_CODE=管理员口令
```

管理员口令只是前端轻量防误操作，不适合强安全场景。

## Netlify 部署

1. 把本项目推送到 GitHub 仓库 `lsxcap/first-cc`。
2. 在 Netlify 选择 Import from Git，连接该仓库。
3. Build command 使用 `npm run build`，Publish directory 使用 `dist`。
4. 部署后进入“员工管理”，输入管理员口令，点击“初始化样例”。

## 数据结构

- `employees`：员工名单、组别和指标目标。
- `records`：每日填报记录。
- `settings`：后续可放月度规则和全局配置。
- `auditLogs`：管理员操作日志预留。

## 安全说明

第一版是小团队快速上线方案：不做登录，员工直接选择姓名填报，管理员口令只用于界面层防误操作。它适合先验证流程，不适合强审计场景。后续可以升级为个人口令、手机号登录或微信登录。
