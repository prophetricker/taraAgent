import { signInWithOtp, verifyEmailOtp } from "./actions";

type Props = {
  searchParams: Promise<{
    message?: string;
    email?: string;
  }>;
};

const MESSAGES: Record<string, string> = {
  check_email: "邮件已发送。推荐复制邮件里的 6 位验证码登录；如果没有验证码，再点击邮件链接。",
  missing_email: "请输入邮箱地址。",
  otp_failed: "发送登录邮件失败，请检查 Supabase 配置。",
  otp_invalid: "验证码必须是 6 位或 8 位数字。",
  otp_verify_failed: "验证码无效或已过期，请重新发送一封新邮件。"
};

export default async function LoginPage({ searchParams }: Props) {
  const { message, email } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-[2rem] border border-stone-900/10 bg-[#fff8e8]/85 p-8 shadow-2xl shadow-stone-900/10 backdrop-blur">
        <p className="mb-3 text-sm tracking-[0.3em] text-[#667a4d]">
          INSPIRATION GREENHOUSE
        </p>
        <h1 className="mb-4 text-4xl font-semibold leading-tight text-[#2c241b]">
          进入灵感温室
        </h1>
        <p className="mb-6 text-sm leading-7 text-stone-700">
          用邮箱验证码登录。验证码路径不会被邮箱安全扫描提前消费，比直接点击 Magic Link 更稳定。
        </p>

        <form action={signInWithOtp} className="space-y-4 rounded-[1.5rem] border border-stone-900/10 bg-white/35 p-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-stone-700">
              邮箱
            </span>
            <input
              required
              type="email"
              name="email"
              defaultValue={email ?? ""}
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-stone-900/15 bg-white/80 px-4 py-3 outline-none transition focus:border-[#667a4d] focus:ring-4 focus:ring-[#667a4d]/15"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-2xl bg-[#2c241b] px-4 py-3 text-sm font-semibold text-[#fff8e8] transition hover:bg-[#433728]"
          >
            发送登录邮件
          </button>
        </form>

        <form action={verifyEmailOtp} className="mt-4 space-y-4 rounded-[1.5rem] border border-[#667a4d]/20 bg-[#d7dfca]/40 p-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-stone-700">
              邮箱
            </span>
            <input
              required
              type="email"
              name="email"
              defaultValue={email ?? ""}
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-stone-900/15 bg-white/80 px-4 py-3 outline-none transition focus:border-[#667a4d] focus:ring-4 focus:ring-[#667a4d]/15"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-stone-700">
              邮件验证码
            </span>
            <input
              required
              inputMode="numeric"
              name="token"
              placeholder="12345678"
              className="w-full rounded-2xl border border-stone-900/15 bg-white/80 px-4 py-3 tracking-[0.35em] outline-none transition focus:border-[#667a4d] focus:ring-4 focus:ring-[#667a4d]/15"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-2xl bg-[#667a4d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#53663d]"
          >
            用验证码登录
          </button>
          <p className="text-xs leading-5 text-stone-600">
            需要先在 Supabase 邮件模板中显示 {"{{ .Token }}"}。Supabase 可能发出 6 位或 8 位验证码，两种都支持。
          </p>
        </form>

        {message ? (
          <p className="mt-5 rounded-2xl bg-[#d7dfca]/80 px-4 py-3 text-sm text-[#2c241b]">
            {MESSAGES[message] ?? message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
