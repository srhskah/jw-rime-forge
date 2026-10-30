import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { themeInitScript } from "@/components/layout/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rime 方案工作站",
  description:
    "GitHub 上 Rime 输入方案的轻量级在线编辑器与浏览器。原始 YAML 始终是唯一权威来源。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Header />
        <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4 lg:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
