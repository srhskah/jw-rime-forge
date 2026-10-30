import { WorkspaceApp } from "@/components/workspace/WorkspaceApp";

export default function WorkspacePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          个人工作区
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          登录后筛选你的 Rime 方案仓库：每项目绑定 1 个仓库，可同时管理多个项目。
        </p>
      </div>
      <WorkspaceApp />
    </div>
  );
}
