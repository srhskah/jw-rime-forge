import { isMap, isSeq, parseDocument, type YAMLMap, type YAMLSeq } from "yaml";
import { YAML_TO_STRING_OPTIONS } from "@/lib/rime/schema";
import type { AlgebraReadResult } from "./types";

const ALGEBRA_PATH = ["speller", "algebra"] as const;

const PREPROCESSOR = new Set(["__include", "__patch", "__append", "__merge"]);

function nodeLooksLikeInclude(value: unknown): boolean {
  if (typeof value === "string") {
    return value.includes("__include") || value.trim().startsWith("include");
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return Object.keys(o).some((k) => PREPROCESSOR.has(k));
  }
  return false;
}

/**
 * Read speller/algebra as a list of rule strings.
 * Non-array / __include forms are reported as non-editable.
 */
export function readAlgebra(raw: string): AlgebraReadResult {
  try {
    const doc = parseDocument(raw, { keepSourceTokens: true });
    if (doc.errors?.length) {
      return {
        present: false,
        editable: false,
        rules: [],
        reason: doc.errors[0].message,
      };
    }

    const node = doc.getIn([...ALGEBRA_PATH], true);
    if (node === undefined || node === null) {
      return { present: false, editable: false, rules: [] };
    }

    // Scalar / map with preprocessor → do not expand
    if (!isSeq(node)) {
      const js = doc.getIn([...ALGEBRA_PATH]);
      if (nodeLooksLikeInclude(js) || isMap(node)) {
        return {
          present: true,
          editable: false,
          rules: [],
          reason: "speller/algebra 由 __include / 非数组形式引入，暂不展开编辑",
        };
      }
      return {
        present: true,
        editable: false,
        rules: [],
        reason: "speller/algebra 不是序列，无法用规则列表编辑",
      };
    }

    const seq = node as YAMLSeq;
    const rules: string[] = [];
    for (const item of seq.items) {
      const js =
        item && typeof item === "object" && "toJSON" in item
          ? (item as { toJSON: () => unknown }).toJSON()
          : item;
      if (nodeLooksLikeInclude(js)) {
        return {
          present: true,
          editable: false,
          rules: [],
          reason: "algebra 序列中含 __include / __patch 项，暂不改写",
        };
      }
      if (typeof js === "string") {
        rules.push(js);
      } else if (js == null) {
        rules.push("");
      } else {
        rules.push(String(js));
      }
    }

    return { present: true, editable: true, rules };
  } catch (e) {
    return {
      present: false,
      editable: false,
      rules: [],
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Replace only speller/algebra sequence items; preserve the rest of the document.
 */
export function applyAlgebraRules(raw: string, rules: string[]): string {
  const doc = parseDocument(raw, { keepSourceTokens: true });
  if (doc.errors?.length) {
    throw new Error(`schema.yaml 解析失败: ${doc.errors[0].message}`);
  }

  // Ensure speller map exists if we are writing algebra
  let speller = doc.getIn(["speller"], true);
  if (speller === undefined || speller === null) {
    doc.setIn(["speller"], doc.createNode({}));
    speller = doc.getIn(["speller"], true);
  }
  if (speller && isMap(speller)) {
    const map = speller as YAMLMap;
    for (const key of map.items.map((it) =>
      typeof it.key === "object" && it.key && "toString" in it.key
        ? String((it.key as { toString: () => string }).toString())
        : String(it.key)
    )) {
      if (PREPROCESSOR.has(key)) {
        throw new Error("禁止改写含预处理指令的 speller 节点");
      }
    }
  }

  const existing = doc.getIn([...ALGEBRA_PATH], true);
  if (existing !== undefined && existing !== null && !isSeq(existing)) {
    throw new Error("speller/algebra 不是序列，拒绝写入");
  }

  doc.setIn([...ALGEBRA_PATH], rules);
  return doc.toString(YAML_TO_STRING_OPTIONS);
}
