# 灵感温室 MVP

Next.js + Supabase + Vercel AI SDK 的第一阶段真实闭环实现。

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

`DATABASE_URL` 应使用 Supabase Supavisor 连接池地址。

4. 在 Supabase SQL Editor 执行：

```text
supabase/migrations/0001_initial_schema.sql
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

## Verification

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```
