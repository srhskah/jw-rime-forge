import { parseAlgebraRule } from "./parse";
import type { ParsedAlgebraRule } from "./types";

export type AlgebraPreviewResult = {
  outputs: string[];
  warning?: string;
  error?: string;
};

/**
 * Approximate Boost.Regex-style replacement: $n, \L$n, \U$n.
 * Applied via String.replace so unmatched parts of the input are preserved.
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
    // Non-global: one substitution per spelling, like typical Rime algebra steps
    return new RegExp(pattern);
  } catch (e) {
    return {
      error: `正则可能无效：${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Replace on the full input string (preserves non-matching suffix/prefix).
 * e.g. derive/([bpmf])o/$1uo/ on "bo2" → "buo2"
 */
export function applyPatternReplace(
  input: string,
  pattern: string,
  replacement: string
): { ok: true; result: string; matched: boolean } | { ok: false; error: string } {
  const re = tryRegExp(pattern);
  if ("error" in re) return { ok: false, error: re.error };

  const m = re.exec(input);
  if (!m || m.index === undefined) {
    return { ok: true, result: input, matched: false };
  }

  const mid = applyReplacement(replacement, m);
  const result =
    input.slice(0, m.index) + mid + input.slice(m.index + m[0].length);
  return { ok: true, result, matched: true };
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

  const replaced = applyPatternReplace(input, args[0] ?? "", args[1] ?? "");
  if (!replaced.ok) {
    return { outputs: [input], warning: replaced.error };
  }

  if (operator === "xform") {
    return { outputs: [replaced.result] };
  }

  // derive / fuzz / abbrev — keep prototype + derived (full-string replace)
  if (operator === "derive" || operator === "fuzz" || operator === "abbrev") {
    if (!replaced.matched || replaced.result === input) {
      return { outputs: [input] };
    }
    return { outputs: [input, replaced.result] };
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

/** Apply one parsed rule to a single spelling (shared by chain engine). */
export function applyParsedRuleToSpelling(
  parsed: ParsedAlgebraRule,
  input: string
): AlgebraPreviewResult {
  return previewParsed(parsed, input);
}
