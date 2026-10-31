"use client";

import { Plus } from "lucide-react";
import {
  ALGEBRA_OPERATORS,
  ALGEBRA_TEMPLATES,
  type AlgebraOperator,
  type AlgebraTemplate,
} from "@/lib/algebra";

export function AddRuleForm({
  addOp,
  addPattern,
  addReplace,
  onOpChange,
  onPatternChange,
  onReplaceChange,
  onAdd,
  onApplyTemplate,
}: {
  addOp: AlgebraOperator;
  addPattern: string;
  addReplace: string;
  onOpChange: (op: AlgebraOperator) => void;
  onPatternChange: (v: string) => void;
  onReplaceChange: (v: string) => void;
  onAdd: () => void;
  onApplyTemplate: (t: AlgebraTemplate) => void;
}) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 p-2 dark:border-zinc-700">
      <p className="text-[11px] font-medium text-zinc-500">添加规则</p>
      <div className="mt-1.5 flex flex-col gap-1.5">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-zinc-500">从模板填充（不直接写入）</span>
          <select
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              e.target.value = "";
              const t = ALGEBRA_TEMPLATES.find((x) => x.id === id);
              if (t) onApplyTemplate(t);
            }}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-900"
          >
            <option value="">选择模板…</option>
            {ALGEBRA_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <select
          value={addOp}
          onChange={(e) => onOpChange(e.target.value as AlgebraOperator)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-900"
        >
          {ALGEBRA_OPERATORS.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
        <input
          value={addPattern}
          onChange={(e) => onPatternChange(e.target.value)}
          placeholder={addOp === "xlit" ? "源字符集" : "匹配正则"}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
        />
        {addOp !== "erase" ? (
          <input
            value={addReplace}
            onChange={(e) => onReplaceChange(e.target.value)}
            placeholder={addOp === "xlit" ? "目标字符集" : "替换字符串"}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
          />
        ) : null}
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center justify-center gap-1 rounded-md bg-teal-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-700"
        >
          <Plus className="h-3.5 w-3.5" />
          添加
        </button>
      </div>
    </div>
  );
}
