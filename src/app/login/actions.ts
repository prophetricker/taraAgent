"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthRedirectOrigin } from "@/lib/auth-url";
import { normalizeEmailOtpToken } from "@/lib/otp-token";
import { createClient } from "@/lib/supabase/server";

export async function signInWithOtp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/login?message=missing_email");
  }

  const origin = getAuthRedirectOrigin({
    requestOrigin: (await headers()).get("origin"),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL
  });
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`
    }
  });

  if (error) {
    redirect("/login?message=otp_failed");
  }

  redirect(`/login?message=check_email&email=${encodeURIComponent(email)}`);
}

export async function verifyEmailOtp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const token = normalizeEmailOtpToken(String(formData.get("token") ?? ""));

  if (!email) {
    redirect("/login?message=missing_email");
  }

  if (!token) {
    redirect(`/login?message=otp_invalid&email=${encodeURIComponent(email)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email"
  });

  if (error) {
    redirect(
      `/login?message=otp_verify_failed&email=${encodeURIComponent(email)}`
    );
  }

  redirect("/workspace");
}
