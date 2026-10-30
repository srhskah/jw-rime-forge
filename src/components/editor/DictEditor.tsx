"use client";

import { Plus, Trash2 } from "lucide-react";
import type { DictEntry } from "@/types";

export function DictEditor({
  entries,
  columns,
  disabled,
  onChange,
  largeWarning,
}: {
  entries: DictEntry[];
  columns: string[];
  disabled?: boolean;
  onChange: (next: DictEntry[]) => void;
  largeWarning?: string | null;
}) {
  const showCode = columns.includes("code") || columns.length === 0;
  const showWeight = columns.includes("weight") || columns.length === 0;

  function updateRow(index: number, patch: Partial<DictEntry>) {
    const next = entries.map((e, i) => (i === index ? { ...e, ...patch } : e));
    onChange(next);
  }

  function removeRow(index: number) {
    onChange(entries.filter((_, i) => i !== index));
  }

  function addRow() {
    // New row may only fill text; empty code/weight → pure-text on write-back
    onChange([...entries, { text: "" }]);
  }

  return (
    <div className="flex flex-col gap-3">
      {largeWarning ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {largeWarning}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          {entries.length.toLocaleString()} 条词条 · 保存时只重写词条区，头部原文保留
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={addRow}
          className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          新增
        </button>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-700">
            <tr>
              <th className="px-2 py-2 font-medium">text</th>
              {showCode ? <th className="px-2 py-2 font-medium">code</th> : null}
              {showWeight ? <th className="px-2 py-2 font-medium">weight</th> : null}
              <th className="w-12 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="px-1 py-1">
                  <input
                    disabled={disabled}
                    value={entry.text}
                    onChange={(e) => updateRow(i, { text: e.target.value })}
                    className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 font-mono text-[13px] outline-none focus:border-teal-500 dark:focus:border-teal-400"
                  />
                </td>
                {showCode ? (
                  <td className="px-1 py-1">
                    <input
                      disabled={disabled}
                      value={entry.code ?? ""}
                      onChange={(e) => updateRow(i, { code: e.target.value })}
                      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 font-mono text-[13px] outline-none focus:border-teal-500"
                    />
                  </td>
                ) : null}
                {showWeight ? (
                  <td className="px-1 py-1">
                    <input
                      disabled={disabled}
                      value={entry.weight ?? ""}
                      onChange={(e) => updateRow(i, { weight: e.target.value })}
                      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 font-mono text-[13px] outline-none focus:border-teal-500"
                    />
                  </td>
                ) : null}
                <td className="px-1 py-1">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => removeRow(i)}
                    className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40"
                    aria-label="删除词条"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards <768px */}
      <ul className="flex flex-col gap-2 md:hidden">
        {entries.map((entry, i) => (
          <li
            key={i}
            className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="flex items-start justify-between gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[11px] text-zinc-500">text</span>
                <input
                  disabled={disabled}
                  value={entry.text}
                  onChange={(e) => updateRow(i, { text: e.target.value })}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-teal-600/30 dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeRow(i)}
                className="rounded p-1.5 text-zinc-400 hover:text-red-600"
                aria-label="删除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {showCode ? (
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-500">code</span>
                  <input
                    disabled={disabled}
                    value={entry.code ?? ""}
                    onChange={(e) => updateRow(i, { code: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs outline-none dark:border-zinc-600 dark:bg-zinc-900"
                  />
                </label>
              ) : null}
              {showWeight ? (
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-500">weight</span>
                  <input
                    disabled={disabled}
                    value={entry.weight ?? ""}
                    onChange={(e) => updateRow(i, { weight: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs outline-none dark:border-zinc-600 dark:bg-zinc-900"
                  />
                </label>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
