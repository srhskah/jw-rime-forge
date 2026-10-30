"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Star } from "lucide-react";
import Link from "next/link";
import type { GitHubRepoCard } from "@/types";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export function RepoSearch() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"stars" | "updated">("stars");
  const [repos, setRepos] = useState<GitHubRepoCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; rateLimited?: boolean } | null>(null);

  const load = useCallback(async (query: string, sortBy: "stars" | "updated") => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sort: sortBy });
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/github/search?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError({ message: data.error || "搜索失败", rateLimited: data.rateLimited });
        setRepos([]);
        return;
      }
      setRepos(data.repos || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "网络错误" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("", "stars");
  }, [load]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(q, sort);
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            搜索 Rime 方案仓库
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="关键词（名称 / About / README 字面匹配，支持中文）"
              className="w-full rounded-md border border-zinc-300 bg-white py-2.5 pr-3 pl-9 text-sm outline-none ring-teal-600/30 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">排序</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "stars" | "updated")}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="stars">按 Star</option>
            <option value="updated">按更新</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
        >
          搜索
        </button>
      </form>

      {!loading && !error ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          约 {total.toLocaleString()} 个相关仓库
        </p>
      ) : null}

      {loading ? <LoadingState label="正在搜索 GitHub…" /> : null}
      {error ? (
        <ErrorState message={error.message} rateLimited={error.rateLimited} />
      ) : null}
      {!loading && !error && repos.length === 0 ? (
        <EmptyState
          title="未找到相关仓库"
          description="试试更宽泛的关键词，或浏览默认 Rime topic 结果。"
        />
      ) : null}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {repos.map((repo) => (
          <li
            key={repo.id}
            className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {repo.full_name}
              </h2>
              <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                {repo.description || "暂无描述"}
              </p>
            </div>
            <div className="mt-auto flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <Star className="h-3.5 w-3.5" aria-hidden />
                {repo.stargazers_count.toLocaleString()}
              </span>
              <Link
                href={`/repo/${repo.owner}/${repo.name}`}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-teal-600 dark:hover:bg-teal-700"
              >
                查看方案
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
