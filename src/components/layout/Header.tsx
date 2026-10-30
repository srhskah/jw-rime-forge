"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Keyboard, LogIn, LogOut, User } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import type { SessionUser } from "@/types";

export function Header() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (!cancelled) setUser(data.user ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 text-zinc-900 dark:text-zinc-50"
        >
          <Keyboard className="h-5 w-5 shrink-0 text-teal-600" aria-hidden />
          <span className="truncate text-sm font-semibold tracking-tight sm:text-base">
            Rime 方案工作站
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className="hidden rounded-md px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:inline"
          >
            浏览
          </Link>
          <Link
            href="/workspace"
            className="rounded-md px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            工作区
          </Link>
          <ThemeToggle />
          {loading ? (
            <span className="h-8 w-8 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
          ) : user ? (
            <div className="flex items-center gap-1.5">
              <span className="hidden max-w-[8rem] truncate text-xs text-zinc-500 dark:text-zinc-400 sm:inline">
                {user.login}
              </span>
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-7 w-7 rounded-full"
                />
              ) : (
                <User className="h-4 w-4 text-zinc-500" />
              )}
              <a
                href="/api/auth/logout"
                className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                aria-label="退出登录"
                title="退出登录"
              >
                <LogOut className="h-4 w-4" />
              </a>
            </div>
          ) : (
            <a
              href="/api/auth/login"
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">GitHub 登录</span>
              <span className="sm:hidden">登录</span>
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
