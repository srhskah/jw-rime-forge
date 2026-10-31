"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useEffect } from "react";
import { parseDocument } from "yaml";
import { getRegisteredFields } from "@/lib/widgets/registry";
import {
  applySchemaEdits,
  getSchemaValue,
  listUnrecognizedTopLevelKeys,
  type SchemaEditValue,
} from "@/lib/rime/schema";

const AlgebraEditorPanel = dynamic(
  () =>
    import("@/components/algebra-editor/AlgebraEditorPanel").then(
      (m) => m.AlgebraEditorPanel
    ),
  {
    ssr: false,
    loading: () => (
      <p className="text-xs text-zinc-500">拼写运算面板加载中…</p>
    ),
  }
);

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
  const [draft, setDraft] = useState(raw);
  const unrecognized = useMemo(() => listUnrecognizedTopLevelKeys(raw), [raw]);
  const hasAlgebra = useMemo(() => /(?:^|\n)\s*algebra\s*:/.test(raw), [raw]);

  useEffect(() => {
    // Single parseDocument for all registered fields (avoid N× parse)
    try {
      const doc = parseDocument(raw, { keepSourceTokens: true });
      const next: Record<string, SchemaEditValue | undefined> = {};
      for (const f of fields) {
        const segs = f.path.split("/").filter(Boolean);
        const node = doc.getIn(segs, true);
        if (node === undefined || node === null) {
          next[f.path] = undefined;
        } else if (typeof node === "object" && node !== null && "toJSON" in node) {
          next[f.path] = (node as { toJSON: () => unknown }).toJSON() as SchemaEditValue;
        } else {
          next[f.path] = node as SchemaEditValue;
        }
      }
      setValues(next);
    } catch {
      const next: Record<string, SchemaEditValue | undefined> = {};
      for (const f of fields) next[f.path] = getSchemaValue(raw, f.path);
      setValues(next);
    }
  }, [raw, fields]);

  useEffect(() => {
    setDraft(raw);
  }, [raw]);

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
        .filter((k) => next[k] !== undefined)
        .map((k) => k.split("/").pop() || k);
      onChange(serialized, hints);
    } catch (e) {
      console.error(e);
    }
  }

  function commitDraft() {
    if (disabled || draft === raw) return;
    onChange(draft, ["free-edit"]);
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

      {hasAlgebra ? (
        <AlgebraEditorPanel raw={raw} disabled={disabled} onChange={onChange} />
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
        <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          自由编辑 YAML
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          可直接改全文；失焦或 Ctrl/⌘+Enter 写回。未在控件注册表中的字段不会自动生成表单。
          {unrecognized.length
            ? ` 检测到未开放 GUI 的顶层键：${unrecognized.slice(0, 8).join(", ")}${unrecognized.length > 8 ? "…" : ""}。`
            : ""}
        </p>
        <textarea
          value={draft}
          disabled={disabled}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              commitDraft();
            }
          }}
          className="mt-2 max-h-[28rem] min-h-[16rem] w-full resize-y rounded-md border border-zinc-300 bg-white p-3 font-mono text-xs leading-relaxed text-zinc-800 outline-none focus:ring-2 focus:ring-teal-600/30 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200"
        />
      </div>
    </div>
  );
}
