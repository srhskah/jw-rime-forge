"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyAlgebraRules,
  formatAlgebraRule,
  parseAlgebraRule,
  readAlgebra,
  type AlgebraOperator,
  type AlgebraTemplate,
} from "@/lib/algebra";
import { AddRuleForm } from "./AddRuleForm";
import { ChainPreview } from "./ChainPreview";
import { RuleEditor } from "./RuleEditor";
import { RuleList } from "./RuleList";

function adaptArgsForOperator(
  op: AlgebraOperator,
  prev: string[]
): string[] {
  if (op === "erase") return [prev[0] || "^$"];
  if (op === "xlit") return [prev[0] || "abc", prev[1] || "xyz"];
  return [prev[0] || "^(.*)$", prev[1] || "$1"];
}

export function AlgebraEditorPanel({
  raw,
  disabled,
  onChange,
}: {
  raw: string;
  disabled?: boolean;
  onChange: (nextRaw: string, hints: string[]) => void;
}) {
  const snapshot = useMemo(() => readAlgebra(raw), [raw]);
  const [rules, setRules] = useState<string[]>(snapshot.rules);
  const [selected, setSelected] = useState(0);
  const [testInput, setTestInput] = useState("nihao");
  const [addOp, setAddOp] = useState<AlgebraOperator>("derive");
  const [addPattern, setAddPattern] = useState("");
  const [addReplace, setAddReplace] = useState("");
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawRef = useRef(raw);
  rawRef.current = raw;

  const rulesKey = snapshot.rules.join("\n");
  useEffect(() => {
    setRules(snapshot.rules);
    setSelected((i) =>
      snapshot.rules.length ? Math.min(i, snapshot.rules.length - 1) : 0
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rulesKey captures content
  }, [raw, snapshot.present, snapshot.editable, rulesKey]);

  const parsedRules = useMemo(
    () => rules.map((r) => parseAlgebraRule(r)),
    [rules]
  );

  if (!snapshot.present) return null;

  const readOnly = Boolean(disabled) || !snapshot.editable;
  const parsed = parsedRules[selected] ?? null;
  const hasBlockingError = parsedRules.some((p) => !p.valid);

  function flushWrite(next: string[]) {
    if (readOnly) return;
    if (next.some((r) => !parseAlgebraRule(r).valid)) return;
    try {
      const nextRaw = applyAlgebraRules(rawRef.current, next);
      onChange(nextRaw, ["algebra"]);
    } catch (e) {
      console.error(e);
    }
  }

  function commit(next: string[], immediate = false) {
    setRules(next);
    if (readOnly) return;
    if (writeTimer.current) clearTimeout(writeTimer.current);
    if (immediate) {
      flushWrite(next);
      return;
    }
    writeTimer.current = setTimeout(() => flushWrite(next), 280);
  }

  function move(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= rules.length) return;
    const next = [...rules];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    setSelected(to);
    commit(next, true);
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...rules];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setSelected(to);
    commit(next, true);
  }

  function remove(index: number) {
    const next = rules.filter((_, i) => i !== index);
    setSelected(Math.max(0, Math.min(selected, next.length - 1)));
    commit(next, true);
  }

  function updateSelectedArgs(nextArgs: string[]) {
    if (!parsed || parsed.operator === "unknown") return;
    const sep = parsed.separator || "/";
    const nextRule = formatAlgebraRule(
      parsed.operator as AlgebraOperator,
      sep,
      nextArgs
    );
    commit(
      rules.map((r, i) => (i === selected ? nextRule : r))
    );
  }

  function updateSelectedOperator(op: AlgebraOperator) {
    if (!parsed) return;
    const sep = parsed.separator || "/";
    const args = adaptArgsForOperator(op, parsed.args);
    const nextRule = formatAlgebraRule(op, sep, args);
    commit(
      rules.map((r, i) => (i === selected ? nextRule : r)),
      true
    );
  }

  function addRule() {
    const args = adaptArgsForOperator(addOp, [addPattern, addReplace]);
    const rule = formatAlgebraRule(addOp, "/", args);
    const next = [...rules, rule];
    setSelected(next.length - 1);
    setAddPattern("");
    setAddReplace("");
    commit(next, true);
  }

  function applyTemplate(t: AlgebraTemplate) {
    setAddOp(t.operator);
    setAddPattern(t.args[0] ?? "");
    setAddReplace(t.args[1] ?? "");
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          拼写运算（speller/algebra）
        </h3>
        <p className="text-[11px] text-zinc-500">
          改动随工作区「保存并提交」写入；只重写 speller/algebra
        </p>
      </div>

      {!snapshot.editable ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {snapshot.reason || "当前 algebra 不可就地编辑"}
        </p>
      ) : null}

      {hasBlockingError ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          存在语法错误的规则；修复前不会写回 schema.yaml（也无法用无效规则提交）。
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <RuleList
            rules={rules}
            parsedRules={parsedRules}
            selected={selected}
            readOnly={readOnly}
            onSelect={setSelected}
            onMove={move}
            onRemove={remove}
            onReorder={reorder}
          />
          {!readOnly ? (
            <AddRuleForm
              addOp={addOp}
              addPattern={addPattern}
              addReplace={addReplace}
              onOpChange={setAddOp}
              onPatternChange={setAddPattern}
              onReplaceChange={setAddReplace}
              onAdd={addRule}
              onApplyTemplate={applyTemplate}
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <RuleEditor
            parsed={parsed}
            readOnly={readOnly}
            testInput={testInput}
            onTestInputChange={setTestInput}
            onOperatorChange={updateSelectedOperator}
            onArgsChange={updateSelectedArgs}
          />
        </div>
      </div>

      {/* Chain preview is read-only computation — available even without write permission */}
      <ChainPreview rules={rules} />
    </div>
  );
}
