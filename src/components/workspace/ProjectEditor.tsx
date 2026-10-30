"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Project } from "@/types";
import { getProject } from "@/lib/projects/storage";
import { RepoEditorPanel } from "@/components/editor/RepoEditorPanel";
import { EmptyState, LoadingState } from "@/components/ui/States";

export function ProjectEditor({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    setProject(getProject(projectId));
  }, [projectId]);

  if (project === undefined) return <LoadingState />;
  if (!project) {
    return (
      <EmptyState
        title="项目不存在"
        description="该项目可能已被删除，或不在当前浏览器的 localStorage 中。"
        action={
          <Link href="/workspace" className="text-sm text-teal-700 underline">
            返回工作区
          </Link>
        }
      />
    );
  }

  const active = project.repos[activeIdx] ?? project.repos[0];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/workspace"
          className="text-xs text-teal-700 hover:underline dark:text-teal-400"
        >
          ← 工作区
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {project.name}
        </h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {project.repos.map((r, i) => (
          <button
            key={`${r.owner}/${r.repo}`}
            type="button"
            onClick={() => setActiveIdx(i)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
              i === activeIdx
                ? "bg-teal-600 text-white"
                : "border border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
            }`}
          >
            {r.owner}/{r.repo}
          </button>
        ))}
      </div>

      {active ? (
        <RepoEditorPanel
          key={`${active.owner}/${active.repo}/${active.branch}`}
          owner={active.owner}
          repo={active.repo}
          branch={active.branch}
        />
      ) : null}
    </div>
  );
}
