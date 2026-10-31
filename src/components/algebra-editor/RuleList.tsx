"use client";

import { useRef, useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react";
import type { ParsedAlgebraRule } from "@/lib/algebra";
import { OP_COLORS } from "./opStyles";

export function RuleList({
  rules,
  parsedRules,
  selected,
  readOnly,
  onSelect,
  onMove,
  onRemove,
  onReorder,
}: {
  rules: string[];
  parsedRules: ParsedAlgebraRule[];
  selected: number;
  readOnly: boolean;
  onSelect: (index: number) => void;
  onMove: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  function onDragStart(e: DragEvent, index: number) {
    e.stopPropagation();
    if (readOnly) {
      e.preventDefault();
      return;
    }
    dragFrom.current = index;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function onDragOver(e: DragEvent, index: number) {
    if (readOnly || dragFrom.current === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== index) setDragOver(index);
  }

  function onDrop(e: DragEvent, index: number) {
    e.preventDefault();
    const from = dragFrom.current;
    dragFrom.current = null;
    setDragOver(null);
    if (from === null || from === index) return;
    onReorder(from, index);
  }

  function onDragEnd() {
    dragFrom.current = null;
    setDragOver(null);
  }

  return (
    <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
      {rules.map((rule, i) => {
        const p = parsedRules[i];
        return (
          <li
            key={`${i}-${rule.slice(0, 64)}`}
            onDragOver={(e) => onDragOver(e, i)}
            onDrop={(e) => onDrop(e, i)}
            onDragEnd={onDragEnd}
            className={
              dragOver === i ? "rounded-md ring-2 ring-teal-500/60" : undefined
            }
          >
            <div
              className={`flex gap-1 rounded-md border ${
                selected === i
                  ? "border-teal-500 bg-teal-50/60 dark:bg-teal-950/30"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              {!readOnly ? (
                <button
                  type="button"
                  data-drag-handle
                  draggable
                  onDragStart={(e) => onDragStart(e, i)}
                  className="mt-2 shrink-0 cursor-grab self-start rounded p-1 text-zinc-400 hover:bg-zinc-100 active:cursor-grabbing dark:hover:bg-zinc-800"
                  aria-label="拖拽排序"
                  title="拖拽排序"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onSelect(i)}
                className="flex min-w-0 flex-1 flex-col gap-1 px-2 py-2 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      OP_COLORS[p?.operator || "unknown"] || OP_COLORS.unknown
                    }`}
                  >
                    {p?.operator || "?"}
                  </span>
                  {p && !p.valid ? (
                    <span className="text-[10px] text-red-600">{p.error}</span>
                  ) : null}
                </div>
                <code className="mt-1 block break-all font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                  {rule}
                </code>
              </button>
            </div>
            {!readOnly ? (
              <div className="mt-0.5 flex gap-1 px-1">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => onMove(i, -1)}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                  aria-label="上移"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={i === rules.length - 1}
                  onClick={() => onMove(i, 1)}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                  aria-label="下移"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                  aria-label="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
