import { RepoSearch } from "@/components/search/RepoSearch";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Rime 方案工作站
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          轻量浏览与编辑 GitHub 上的 Rime 输入方案（schema.yaml + dict.yaml）。
          不替代本地 CLI，不持有第二真相源——所有编辑以 commit 写回你的仓库，原始 YAML 始终权威。
        </p>
      </section>
      <RepoSearch />
    </div>
  );
}
