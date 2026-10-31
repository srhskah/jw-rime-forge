"use client";

import {
  ALGEBRA_OPERATORS,
  previewAlgebraRule,
  softRegexWarning,
  type AlgebraOperator,
  type ParsedAlgebraRule,
} from "@/lib/algebra";

function argLabel(operator: string, ai: number): string {
  if (operator === "xlit") {
    if (ai === 0) return "参数 1（源字符集）";
    if (ai === 1) return "参数 2（目标字符集）";
  } else if (operator === "erase") {
    if (ai === 0) return "参数 1（匹配正则）";
  } else {
    if (ai === 0) return "参数 1（匹配正则）";
    if (ai === 1) return "参数 2（替换字符串）";
  }
  return `参数 ${ai + 1}`;
}

export function RuleEditor({
  parsed,
  readOnly,
  testInput,
  onTestInputChange,
  onOperatorChange,
  onArgsChange,
}: {
  parsed: ParsedAlgebraRule | null;
  readOnly: boolean;
  testInput: string;
  onTestInputChange: (v: string) => void;
  onOperatorChange: (op: AlgebraOperator) => void;
  onArgsChange: (args: string[]) => void;
}) {
  if (!parsed) {
    return (
      <p className="text-xs text-zinc-500">选择左侧一条规则以编辑与预览。</p>
    );
  }

  const preview = previewAlgebraRule(parsed.raw, testInput);
  const regexWarn =
    parsed.operator !== "xlit" && parsed.operator !== "unknown" && parsed.args[0]
      ? softRegexWarning(parsed.args[0])
      : null;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-zinc-500">运算符</span>
        <select
          value={
            parsed.operator === "unknown" ? ALGEBRA_OPERATORS[0] : parsed.operator
          }
          disabled={readOnly}
          onChange={(e) => onOperatorChange(e.target.value as AlgebraOperator)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-sm disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900"
        >
          {ALGEBRA_OPERATORS.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
      </label>

      {parsed.args.map((arg, ai) => (
        <label key={ai} className="flex flex-col gap-1">
          <span className="text-[11px] text-zinc-500">
            {argLabel(parsed.operator, ai)}
          </span>
          <input
            value={arg}
            disabled={readOnly || parsed.operator === "unknown"}
            onChange={(e) => {
              const next = [...parsed.args];
              next[ai] = e.target.value;
              onArgsChange(next);
            }}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-teal-600/30 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>
      ))}

      {!parsed.valid ? (
        <p className="text-xs text-red-600 dark:text-red-400">{parsed.error}</p>
      ) : null}
      {regexWarn ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">{regexWarn}</p>
      ) : null}

      <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <p className="text-[11px] text-zinc-500">
          单规则预览（不反映多条规则的组合效果）
        </p>
        <label className="mt-2 flex flex-col gap-1">
          <span className="text-[11px] text-zinc-500">测试输入</span>
          <input
            value={testInput}
            onChange={(e) => onTestInputChange(e.target.value)}
            placeholder="例如 nihao / ju"
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-sm outline-none focus:ring-2 focus:ring-teal-600/30 dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>
        <div className="mt-2">
          <p className="text-[11px] text-zinc-500">输出</p>
          {preview.error ? (
            <p className="mt-1 text-xs text-red-600">{preview.error}</p>
          ) : null}
          {preview.warning ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {preview.warning}
            </p>
          ) : null}
          <ul className="mt-1 flex flex-col gap-1">
            {(preview.outputs.length
              ? preview.outputs
              : ["（无输出 / 已 erase）"]
            ).map((o, i) => (
              <li
                key={i}
                className="rounded bg-zinc-100 px-2 py-1 font-mono text-sm dark:bg-zinc-900"
              >
                {o}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
