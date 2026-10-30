"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderPlus, Trash2 } from "lucide-react";
import type { GitHubRepoCard, Project, SessionUser } from "@/types";
import {
  createProjectId,
  deleteProject,
  loadProjects,
  upsertProject,
} from "@/lib/projects/storage";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export function WorkspaceApp() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [repos, setRepos] = useState<GitHubRepoCard[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; rateLimited?: boolean } | null>(null);

  useEffect(() => {
    setProjects(loadProjects());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetch("/api/auth/me").then((r) => r.json());
        if (cancelled) return;
        if (!me.user) {
          setUser(null);
          setLoading(false);
          return;
        }
        setUser(me.user);
        const res = await fetch("/api/github/user-repos");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError({ message: data.error || "拉取仓库失败", rateLimited: data.rateLimited });
        } else {
          setRepos(data.repos || []);
        }
      } catch (e) {
        if (!cancelled) {
          setError({ message: e instanceof Error ? e.message : "加载失败" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function selectRepo(fullName: string) {
    setSelected(new Set([fullName]));
  }

  function createProject() {
    if (selected.size !== 1) return;
    const fullName = Array.from(selected)[0];
    const chosen = repos.find((r) => r.full_name === fullName);
    if (!chosen) return;
    const name = projectName.trim() || chosen.full_name;
    const project: Project = {
      id: createProjectId(),
      name,
      repos: [
        {
          owner: chosen.owner,
          repo: chosen.name,
          branch: chosen.default_branch || "main",
        },
      ],
    };
    const all = upsertProject(project);
    setProjects(all);
    setSelected(new Set());
    setProjectName("");
  }

  function removeProject(id: string) {
    setProjects(deleteProject(id));
  }

  if (user === undefined || loading) {
    return <LoadingState label="加载个人工作区…" />;
  }

  if (user === null) {
    return (
      <EmptyState
        title="需要登录"
        description="个人工作区需要 GitHub 登录后才能拉取你的仓库并创建项目。"
        action={
          <a
            href="/api/auth/login"
            className="mt-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            使用 GitHub 登录
          </a>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          我的项目
        </h2>
        <p className="text-xs text-zinc-500">
          项目仅保存在浏览器 localStorage。每个项目对应 1 个仓库；可同时创建多个项目。
        </p>
        {projects.length === 0 ? (
          <EmptyState
            title="还没有项目"
            description="在下方选中一个疑似 Rime 方案仓库，即可创建一个项目。"
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-50">{p.name}</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {p.repos.map((r) => `${r.owner}/${r.repo}`).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProject(p.id)}
                    className="rounded p-1.5 text-zinc-400 hover:text-red-600"
                    aria-label="删除项目"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <Link
                  href={`/workspace/project/${p.id}`}
                  className="mt-1 inline-flex w-fit rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-teal-600"
                >
                  打开编辑
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          疑似 Rime 方案仓库
        </h2>
        {error ? (
          <ErrorState message={error.message} rateLimited={error.rateLimited} />
        ) : null}
        {!error && repos.length === 0 ? (
          <EmptyState
            title="未筛到 Rime 仓库"
            description="筛选条件：仓库名/描述含 rime，或根目录存在 *.schema.yaml / *.dict.yaml。你也可以先新建空仓库再在项目中从零创建。"
          />
        ) : null}

        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((r) => {
            const checked = selected.has(r.full_name);
            return (
              <li key={r.id}>
                <label
                  className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
                    checked
                      ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/30"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="workspace-repo"
                    checked={checked}
                    onChange={() => selectRepo(r.full_name)}
                    className="mt-1"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{r.full_name}</span>
                    <span className="mt-0.5 block line-clamp-2 text-xs text-zinc-500">
                      {r.description || "无描述"}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-zinc-200 bg-white/95 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs text-zinc-500">项目名称</span>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="留空则用仓库全名"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <button
            type="button"
            disabled={selected.size !== 1}
            onClick={createProject}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40"
          >
            <FolderPlus className="h-4 w-4" />
            创建项目
          </button>
        </div>
      </section>
    </div>
  );
}
