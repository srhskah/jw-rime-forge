"use client";

import { createTwoFilesPatch, diffLines } from "diff";

export function DiffPreview({
  files,
}: {
  files: Array<{ path: string; before: string; after: string }>;
}) {
  const changed = files.filter((f) => f.before !== f.after);

  if (!changed.length) {
    return (
      <p className="text-sm text-zinc-500">没有检测到变更。</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {changed.map((f) => {
        const parts = diffLines(f.before, f.after);
        const lines: Array<{ type: "add" | "remove" | "context"; text: string }> = [];
        for (const part of parts) {
          const type = part.added ? "add" : part.removed ? "remove" : "context";
          const split = part.value.replace(/\n$/, "").split("\n");
          // Only show changed lines + tiny context for MVP
          if (type === "context") {
            const ctx = split.slice(-2);
            for (const t of ctx) {
              if (t !== undefined) lines.push({ type: "context", text: t });
            }
          } else {
            for (const t of split) lines.push({ type, text: t });
          }
        }

        return (
          <div key={f.path} className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              {f.path}
              <span className="ml-2 font-normal text-zinc-400">
                （仅变更行）
              </span>
            </div>
            <pre className="max-h-72 overflow-auto p-2 text-[12px] leading-5 font-mono">
              {lines.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.type === "add"
                      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                      : l.type === "remove"
                        ? "bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200"
                        : "text-zinc-400"
                  }
                >
                  <span className="inline-block w-4 select-none opacity-60">
                    {l.type === "add" ? "+" : l.type === "remove" ? "-" : " "}
                  </span>
                  {l.text}
                </div>
              ))}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

/** Unused helper kept for potential unified patch export */
export function buildUnifiedPatch(
  path: string,
  before: string,
  after: string
): string {
  return createTwoFilesPatch(path, path, before, after);
}
