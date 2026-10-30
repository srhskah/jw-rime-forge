"use client";

import { useMemo, useState, useEffect } from "react";
import { getRegisteredFields } from "@/lib/widgets/registry";
import {
  applySchemaEdits,
  getSchemaValue,
  listUnrecognizedTopLevelKeys,
  type SchemaEditValue,
} from "@/lib/rime/schema";

export function SchemaEditor({
  raw,
  disabled,
  onChange,
}: {
  raw: string;
  disabled?: boolean;
  onChange: (nextRaw: string, hints: string[]) => void;
}) {
  const fields = useMemo(() => getRegisteredFields(), []);
  const [values, setValues] = useState<Record<string, SchemaEditValue | undefined>>({});
  const unrecognized = useMemo(() => listUnrecognizedTopLevelKeys(raw), [raw]);

  useEffect(() => {
    const next: Record<string, SchemaEditValue | undefined> = {};
    for (const f of fields) {
      next[f.path] = getSchemaValue(raw, f.path);
    }
    setValues(next);
  }, [raw, fields]);

  function update(path: string, value: SchemaEditValue) {
    const next = { ...values, [path]: value };
    setValues(next);
    const edits: Record<string, SchemaEditValue> = {};
    for (const [k, v] of Object.entries(next)) {
      if (v !== undefined) edits[k] = v;
    }
    try {
      const serialized = applySchemaEdits(raw, edits);
      const hints = Object.keys(edits)
        .filter((k) => getSchemaValue(raw, k) !== edits[k])
        .map((k) => k.split("/").pop() || k);
      onChange(serialized, hints);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <f.Component
            key={f.path}
            id={`schema-${f.path.replace(/\//g, "-")}`}
            label={f.label}
            description={f.description}
            value={values[f.path]}
            disabled={disabled}
            onChange={(v) => update(f.path, v)}
          />
        ))}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
        <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          原始 YAML 预览（只读）
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          未在控件注册表中的字段不会自动生成表单。
          {unrecognized.length
            ? ` 检测到未开放 GUI 的顶层键：${unrecognized.slice(0, 8).join(", ")}${unrecognized.length > 8 ? "…" : ""}。该字段暂未开放 GUI 编辑，请使用文本模式或提交 PR。`
            : " 该字段暂未开放 GUI 编辑时，请使用文本模式或提交 PR。"}
        </p>
        <pre className="mt-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap font-mono text-zinc-700 dark:text-zinc-300">
          {raw}
        </pre>
      </div>
    </div>
  );
}
