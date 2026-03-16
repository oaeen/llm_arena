import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM Arena 综合性能看板",
  description:
    "对比 LMArena 文本榜单、OpenRouter 价格与性能指标的综合性能看板。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
