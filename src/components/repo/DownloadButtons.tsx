"use client";

import { Download } from "lucide-react";

function downloadRaw(filename: string, content: string) {
  // Preserve original UTF-8 bytes — no re-serialization
  const blob = new Blob([content], { type: "text/yaml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DownloadButtons({
  schemaPath,
  schemaRaw,
  dictPath,
  dictRaw,
}: {
  schemaPath: string | null;
  schemaRaw: string | null;
  dictPath: string | null;
  dictRaw: string | null;
}) {
  const schemaName = schemaPath?.split("/").pop() || "schema.yaml";
  const dictName = dictPath?.split("/").pop() || "dict.yaml";

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={!schemaRaw}
        onClick={() => schemaRaw && downloadRaw(schemaName, schemaRaw)}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <Download className="h-3.5 w-3.5" />
        下载 schema.yaml
      </button>
      <button
        type="button"
        disabled={!dictRaw}
        onClick={() => dictRaw && downloadRaw(dictName, dictRaw)}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <Download className="h-3.5 w-3.5" />
        下载 dict.yaml
      </button>
    </div>
  );
}
