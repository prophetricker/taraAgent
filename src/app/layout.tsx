import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "灵感温室",
  description: "保护早期灵感的 AI 认知外脑"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
