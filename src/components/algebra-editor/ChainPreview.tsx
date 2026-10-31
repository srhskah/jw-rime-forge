"use client";

import { useMemo, useState } from "react";
import {
  groupChainSpells,
  parseAlgebraRule,
  runAlgebraChain,
  splitChainInputs,
} from "@/lib/algebra";
import { OP_COLORS } from "./opStyles";

export function ChainPreview({
  rules,
}: {
  /** Current algebra rule strings (local editor state). */
  rules: string[];
}) {
  const [input, setInput] = useState("bo2");
  const [ran, setRan] = useState(false);
  const [version, setVersion] = useState(0);

  const result = useMemo(() => {
    if (!ran) return null;
    const parsed = rules.map((r) => parseAlgebraRule(r));
    return runAlgebraChain(parsed, splitChainInputs(input));
    // version forces recompute on button click with same input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ran, version, rules, input]);

  const groups = result ? groupChainSpells(result.spells) : null;

  function run() {
    setRan(true);
    setVersion((v) => v + 1);
  }

  return (
    <div className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          整体推导预览
        </h4>
        <p className="text-[11px] text-zinc-500">
          按当前规则列表顺序链式执行（纯前端，不写文件）
        </p>
      </div>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[11px] text-zinc-500">测试拼音</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                run();
              }
            }}
            placeholder="例如 bo2, jv, zhuang"
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-sm outline-none focus:ring-2 focus:ring-teal-600/30 dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>
        <button
          type="button"
          onClick={run}
          className="shrink-0 rounded-md bg-teal-600 px-3 py-2 text-xs font-medium text-white hover:bg-teal-700"
        >
          运行推导
        </button>
      </div>

      {result?.warnings.length ? (
        <ul className="mt-2 flex flex-col gap-1">
          {result.warnings.map((w, i) => (
            <li
              key={i}
              className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            >
              {w}
            </li>
          ))}
        </ul>
      ) : null}

      {groups ? (
        <div className="mt-3 flex flex-col gap-3">
          <Group
            title="原始拼写"
            badgeClass={OP_COLORS.unknown}
            items={groups.origin}
          />
          <Group
            title="衍生 / 简拼"
            badgeClass={OP_COLORS.derive}
            items={groups.derived}
            emptyHint="无"
          />
          <Group
            title="模糊音"
            badgeClass={OP_COLORS.fuzz}
            items={groups.fuzz}
            emptyHint="无"
          />
          <Group
            title="改写 / 映射"
            badgeClass={OP_COLORS.xform}
            items={groups.rewritten}
            emptyHint="无"
          />
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-zinc-500">
          输入测试拼音后点击「运行推导」。
        </p>
      )}
    </div>
  );
}

function Group({
  title,
  badgeClass,
  items,
  emptyHint,
}: {
  title: string;
  badgeClass: string;
  items: string[];
  emptyHint?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-zinc-500">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-[11px] text-zinc-400">{emptyHint ?? "—"}</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {items.map((s) => (
            <li
              key={s}
              className={`rounded px-2 py-0.5 font-mono text-xs ${badgeClass}`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
