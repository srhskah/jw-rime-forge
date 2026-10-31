import { parseAlgebraRule } from "./parse";
import type { ParsedAlgebraRule } from "./types";

export type AlgebraPreviewResult = {
  outputs: string[];
  warning?: string;
  error?: string;
};

/**
 * Approximate Boost.Regex-style replacement: $n, \L$n, \U$n.
 * Not a full librime / Boost port — for single-rule debug only.
 */
function applyReplacement(template: string, match: RegExpExecArray): string {
  return template
    .replace(/\\([LU])\$(\d+)/g, (_whole, flag: string, n: string) => {
      const g = match[Number(n)] ?? "";
      return flag === "L" ? g.toLowerCase() : g.toUpperCase();
    })
    .replace(/\$(\d+)/g, (_whole, n: string) => match[Number(n)] ?? "")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
}

function tryRegExp(pattern: string): RegExp | { error: string } {
  try {
    return new RegExp(pattern);
  } catch (e) {
    return {
      error: `正则可能无效：${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

function previewParsed(
  parsed: ParsedAlgebraRule,
  input: string
): AlgebraPreviewResult {
  if (!parsed.valid) {
    return { outputs: [], error: parsed.error || "规则无效" };
  }

  const { operator, args } = parsed;

  if (operator === "xlit") {
    const src = Array.from(args[0]);
    const dst = Array.from(args[1]);
    const map = new Map<string, string>();
    for (let i = 0; i < src.length; i++) map.set(src[i], dst[i]);
    const out = Array.from(input)
      .map((ch) => map.get(ch) ?? ch)
      .join("");
    return { outputs: [out] };
  }

  if (operator === "erase") {
    const re = tryRegExp(args[0]);
    if ("error" in re) return { outputs: [input], warning: re.error };
    if (re.test(input)) return { outputs: [] };
    return { outputs: [input] };
  }

  const re = tryRegExp(args[0]);
  if ("error" in re) {
    return {
      outputs: operator === "xform" ? [input] : [input],
      warning: re.error,
    };
  }

  const m = re.exec(input);
  if (!m) {
    return { outputs: [input] };
  }

  const replaced = applyReplacement(args[1] ?? "", m);

  if (operator === "xform") {
    return { outputs: [replaced] };
  }

  // derive / fuzz / abbrev — keep prototype + derived
  if (operator === "derive" || operator === "fuzz" || operator === "abbrev") {
    if (replaced === input) return { outputs: [input] };
    return { outputs: [input, replaced] };
  }

  return { outputs: [input], error: "unknown operator" };
}

/** Single-rule preview (does not chain multiple algebra rules). */
export function previewAlgebraRule(
  rawRule: string,
  input: string
): AlgebraPreviewResult {
  const parsed = parseAlgebraRule(rawRule);
  return previewParsed(parsed, input);
}
