"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ArrowDownAZ,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { DictEntry } from "@/types";
import { filterEntryIndices } from "@/lib/rime/parse-dict";

/** Rows per page — keep DOM light; browse all via pagination. */
const PAGE_SIZE = 100;

function compareByCode(a: DictEntry, b: DictEntry): number {
  const ca = (a.code ?? "").trim().toLowerCase();
  const cb = (b.code ?? "").trim().toLowerCase();
  const aEmpty = !ca;
  const bEmpty = !cb;
  if (aEmpty && !bEmpty) return 1;
  if (!aEmpty && bEmpty) return -1;
  if (!aEmpty && !bEmpty) {
    const c = ca.localeCompare(cb, "en");
    if (c !== 0) return c;
  }
  return a.text.localeCompare(b.text, "zh-Hans");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

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
  const idsRef = useRef<(string | undefined)[]>([]);
  const dragFromRef = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageInput, setPageInput] = useState("1");

  if (idsRef.current.length > entries.length) {
    idsRef.current.length = entries.length;
  }

  function rowId(index: number): string {
    const existing = idsRef.current[index];
    if (existing) return existing;
    const id = crypto.randomUUID();
    idsRef.current[index] = id;
    return id;
  }

  // Debounce search on large lists so typing doesn't scan 万条每键
  useEffect(() => {
    if (entries.length < 2000) {
      setDebouncedQuery(query);
      return;
    }
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query, entries.length]);

  const filtering = debouncedQuery.trim().length > 0;

  // Cache: only build full index list when searching; otherwise page by arithmetic
  const filteredIndices = useMemo(() => {
    if (!filtering) return null;
    return filterEntryIndices(entries, debouncedQuery);
  }, [entries, debouncedQuery, filtering]);

  const totalMatch = filtering ? (filteredIndices?.length ?? 0) : entries.length;
  const pageCount = Math.max(1, Math.ceil(totalMatch / PAGE_SIZE) || 1);
  const safePage = clamp(page, 0, pageCount - 1);

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  useEffect(() => {
    setPageInput(String(safePage + 1));
  }, [safePage]);

  function goToPageInput() {
    const n = Number.parseInt(pageInput, 10);
    if (!Number.isFinite(n)) {
      setPageInput(String(safePage + 1));
      return;
    }
    setPage(clamp(n, 1, pageCount) - 1);
  }

  const visibleIndices = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    if (!filtering) {
      const out: number[] = [];
      const last = Math.min(end, entries.length);
      for (let i = start; i < last; i++) out.push(i);
      return out;
    }
    return (filteredIndices ?? []).slice(start, end);
  }, [safePage, filtering, entries.length, filteredIndices]);

  const canDrag = !disabled && !filtering && pageCount === 1;

  function updateRow(index: number, patch: Partial<DictEntry>) {
    const next = entries.map((e, i) => (i === index ? { ...e, ...patch } : e));
    onChange(next);
  }

  function removeRow(index: number) {
    idsRef.current = idsRef.current.filter((_, i) => i !== index);
    onChange(entries.filter((_, i) => i !== index));
  }

  function addRow() {
    idsRef.current = [crypto.randomUUID(), ...idsRef.current];
    onChange([{ text: "" }, ...entries]);
    setQuery("");
    setDebouncedQuery("");
    setPage(0);
  }

  function sortByCode() {
    const indexed = entries.map((entry, i) => ({
      entry,
      id: idsRef.current[i] ?? crypto.randomUUID(),
      i,
    }));
    indexed.sort((a, b) => compareByCode(a.entry, b.entry) || a.i - b.i);
    idsRef.current = indexed.map((x) => x.id);
    onChange(indexed.map((x) => x.entry));
    setPage(0);
  }

  function moveRow(from: number, to: number) {
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= entries.length ||
      to >= entries.length
    ) {
      return;
    }
    const next = [...entries];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    const nextIds = idsRef.current.slice();
    const [id] = nextIds.splice(from, 1);
    nextIds.splice(to, 0, id);
    idsRef.current = nextIds;
    onChange(next);
  }

  function onRowDragOver(e: DragEvent, index: number) {
    if (!canDrag || dragFromRef.current === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== index) setDragOver(index);
  }

  function onRowDrop(e: DragEvent, index: number) {
    e.preventDefault();
    const from = dragFromRef.current;
    dragFromRef.current = null;
    setDragOver(null);
    if (from === null || !canDrag) return;
    moveRow(from, index);
  }

  function onRowDragEnd() {
    dragFromRef.current = null;
    setDragOver(null);
  }

  const dragHandle = (index: number) => (
    <button
      type="button"
      data-drag-handle
      disabled={!canDrag}
      draggable={canDrag}
      onDragStart={(e) => {
        e.stopPropagation();
        if (!canDrag) {
          e.preventDefault();
          return;
        }
        dragFromRef.current = index;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
      }}
      className="cursor-grab touch-none rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800"
      aria-label="拖拽调整次序"
      title={
        !canDrag
          ? filtering
            ? "搜索过滤时不可拖拽"
            : "多页时请用搜索定位后编辑；单页可拖拽"
          : "拖拽调整次序"
      }
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );

  const rangeStart = totalMatch === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const rangeEnd = Math.min((safePage + 1) * PAGE_SIZE, totalMatch);

  const pager = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
      <p className="text-[11px] text-zinc-500">
        {totalMatch === 0
          ? "无匹配词条"
          : `第 ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} 条 · 共 ${totalMatch.toLocaleString()} 条`}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={safePage <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="inline-flex items-center gap-0.5 rounded-md border border-zinc-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-zinc-600"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          上一页
        </button>
        <label className="flex items-center gap-1 text-xs text-zinc-500">
          <span>第</span>
          <input
            type="number"
            min={1}
            max={pageCount}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={goToPageInput}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                goToPageInput();
              }
            }}
            className="w-14 rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-center font-mono text-xs outline-none focus:ring-2 focus:ring-teal-600/30 dark:border-zinc-600 dark:bg-zinc-900"
            aria-label="页码"
          />
          <span>/ {pageCount} 页</span>
        </label>
        <button
          type="button"
          disabled={safePage >= pageCount - 1}
          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          className="inline-flex items-center gap-0.5 rounded-md border border-zinc-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-zinc-600"
        >
          下一页
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {largeWarning ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {largeWarning}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-500">
          {entries.length.toLocaleString()} 条词条 · 每页 {PAGE_SIZE} 条可翻页查看全部
          {filtering ? ` · 搜索命中 ${totalMatch.toLocaleString()} 条` : ""}
          {query !== debouncedQuery ? " · 搜索中…" : ""}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="relative block min-w-[12rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索词条…"
              className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pr-2.5 pl-8 text-xs outline-none ring-teal-600/30 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <button
            type="button"
            disabled={disabled || entries.length < 2 || entries.length > 8000}
            onClick={sortByCode}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            title={
              entries.length > 8000
                ? "词条过多，浏览器内全量排序易卡死"
                : "按 code 升序（a→z），无 code 的排在末尾"
            }
          >
            <ArrowDownAZ className="h-3.5 w-3.5" />
            按 code 排序
          </button>
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
      </div>

      {pager}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-700">
            <tr>
              <th className="w-8 px-1 py-2" />
              <th className="px-2 py-2 font-medium">text</th>
              {showCode ? <th className="px-2 py-2 font-medium">code</th> : null}
              {showWeight ? <th className="px-2 py-2 font-medium">weight</th> : null}
              <th className="w-12 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {visibleIndices.map((i) => {
              const entry = entries[i];
              return (
                <tr
                  key={rowId(i)}
                  onDragOver={(e) => onRowDragOver(e, i)}
                  onDrop={(e) => onRowDrop(e, i)}
                  onDragEnd={onRowDragEnd}
                  className={`border-b border-zinc-100 dark:border-zinc-800 ${
                    dragOver === i ? "bg-teal-50/80 dark:bg-teal-950/40" : ""
                  }`}
                >
                  <td className="px-0.5 py-1 align-middle">{dragHandle(i)}</td>
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
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards <768px */}
      <ul className="flex flex-col gap-2 md:hidden">
        {visibleIndices.map((i) => {
          const entry = entries[i];
          return (
            <li
              key={rowId(i)}
              onDragOver={(e) => onRowDragOver(e, i)}
              onDrop={(e) => onRowDrop(e, i)}
              onDragEnd={onRowDragEnd}
              className={`rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 ${
                dragOver === i ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/30" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="pt-1">{dragHandle(i)}</div>
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
          );
        })}
      </ul>
    </div>
  );
}
