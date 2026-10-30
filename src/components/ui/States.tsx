import { AlertCircle, FolderOpen, Loader2, ShieldOff } from "lucide-react";
import type { ReactNode } from "react";

export function LoadingState({ label = "加载中…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-500 dark:text-zinc-400">
      <Loader2 className="h-8 w-8 animate-spin text-teal-600" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-300 px-4 py-14 text-center dark:border-zinc-700">
      <FolderOpen className="h-10 w-10 text-zinc-400" aria-hidden />
      <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">{title}</h3>
      {description ? (
        <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

export function ErrorState({
  title = "出错了",
  message,
  rateLimited,
}: {
  title?: string;
  message: string;
  rateLimited?: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-5 dark:border-red-900/50 dark:bg-red-950/40"
    >
      <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
        <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-red-700/90 dark:text-red-300/90">{message}</p>
      {rateLimited ? (
        <p className="text-xs text-red-600/80 dark:text-red-400/80">
          GitHub API 限流：未登录约 60 次/小时；登录后约 5000 次/小时。请稍后重试或登录。
        </p>
      ) : null}
    </div>
  );
}

export function ReadOnlyBanner() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
      <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>你对该仓库只有只读权限，无法保存提交。请确认自己是协作者且具备 write 及以上权限。</span>
    </div>
  );
}
