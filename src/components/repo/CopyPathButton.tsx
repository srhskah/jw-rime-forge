"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies strictly `用户名/仓库名称`. */
export function CopyPathButton({ owner, repo }: { owner: string; repo: string }) {
  const [ok, setOk] = useState(false);
  const path = `${owner}/${repo}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(path);
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = path;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      title={`复制 ${path}`}
    >
      {ok ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <Copy className="h-3.5 w-3.5" />}
      {ok ? "已复制" : "一键复制路径"}
    </button>
  );
}
