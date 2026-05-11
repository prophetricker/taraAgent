# 灵感温室 MVP

灵感温室是一个“左脑对话 + 右脑蒲公英图”的灵感保护 Agent 原型。左侧通过对话承接想法，右侧把当前想法整理成蒲公英中心、延伸、碎片和关系线。

当前版本重点是第一阶段真实闭环：登录、对话、节点落库、画布展示、手动碎片捕捉、关系编辑、基础布局聚类和保存反馈。

## 当前能力

- Supabase Auth 邮箱验证码登录，支持 Magic Link 和手动 OTP Code。
- Next.js App Router 工作台，左侧对话，右侧 React Flow 画布。
- 蒲公英中心会随对话更新，延伸节点会从结构整理结果中生成。
- 右脑画布支持拖动画布中心、关系线编辑、标签悬停/锁定高亮。
- 碎片支持手动圈选捕捉，并在右侧碎片池展示。
- 延伸布局会优先让相关节点靠近，避免少量延伸默认均匀铺满中心四周。
- 工作区提供本地生成的低音量纯音乐开关，不依赖外部音频文件。
- API 写入路径增加用户所有权校验和保存失败反馈。

## Setup

1. 安装依赖：

```powershell
npm.cmd install
```

2. 复制环境变量：

```powershell
Copy-Item .env.example .env.local
```

3. 填写 `.env.local`：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=
AI_API_KEY=
AI_BASE_URL=
AI_CHAT_MODEL=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`DATABASE_URL` 应使用 Supabase Supavisor 连接池地址。`AI_BASE_URL` 使用 OpenAI-compatible 服务地址，仓库不内置具体供应商 URL。

4. 在 Supabase SQL Editor 按顺序执行迁移：

```text
supabase/migrations/0001_initial_schema.sql
supabase/migrations/0002_idea_relations.sql
```

5. 启动开发服务器：

```powershell
npm.cmd run dev
```

## Supabase Auth 配置

在 Supabase Dashboard 的 `Authentication` -> `URL Configuration` 中配置：

```text
Site URL: http://localhost:3000
Redirect URLs:
http://localhost:3000/**
http://localhost:3000/auth/callback
http://localhost:3000/auth/confirm
```

如果点击邮件按钮出现 `otp_expired`，通常是邮箱客户端或安全系统预读了 Magic Link。推荐在 `Authentication` -> `Email Templates` -> `Magic Link` 中加入验证码：

```html
<p>Your login code is: {{ .Token }}</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>
```

登录页支持复制邮件中的 6 位或 8 位验证码登录；这条路径调用 Supabase `verifyOtp`，不会被邮件预读取消耗。

## 开发说明

- `inspiration_nodes` 保存蒲公英中心和延伸节点。
- `dandelion_fragments` 保存游离碎片。
- `idea_relations` 保存蒲公英中心、延伸之间的关系类型。
- `/api/chat` 负责流式对话、消息保存、中心更新和延伸生成。
- `/api/relations` 负责关系线类型编辑。
- 右脑画布布局主要在 `src/lib/graph.ts` 中计算。

## Verification

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```
