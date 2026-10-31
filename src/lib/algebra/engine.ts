import { parseAlgebraRule } from "./parse";
import { applyParsedRuleToSpelling, applyPatternReplace } from "./preview";
import type { AlgebraOperator, ParsedAlgebraRule } from "./types";

export type ChainSpellKind =
  | "origin"
  | "derive"
  | "fuzz"
  | "abbrev"
  | "xform"
  | "xlit";

/** Higher number wins when the same spelling is produced by multiple rules. */
const KIND_PRIORITY: Record<ChainSpellKind, number> = {
  origin: 1,
  xform: 2,
  xlit: 2,
  derive: 3,
  abbrev: 4,
  fuzz: 5,
};

export type ChainPreviewResult = {
  /** spelling → strongest kind */
  spells: Map<string, ChainSpellKind>;
  warnings: string[];
};

export type ChainPreviewGroups = {
  origin: string[];
  derived: string[]; // derive + abbrev
  fuzz: string[];
  rewritten: string[]; // xform + xlit
};

function kindFromOperator(op: AlgebraOperator | "unknown"): ChainSpellKind | null {
  if (op === "unknown") return null;
  if (op === "erase") return null;
  return op;
}

function mergeKind(
  map: Map<string, ChainSpellKind>,
  spelling: string,
  kind: ChainSpellKind
) {
  const prev = map.get(spelling);
  if (!prev || KIND_PRIORITY[kind] >= KIND_PRIORITY[prev]) {
    map.set(spelling, kind);
  }
}

function applyXlit(input: string, src: string, dst: string): string {
  const s = Array.from(src);
  const d = Array.from(dst);
  const map = new Map<string, string>();
  for (let i = 0; i < s.length; i++) map.set(s[i], d[i] ?? s[i]);
  return Array.from(input)
    .map((ch) => map.get(ch) ?? ch)
    .join("");
}

/**
 * Run the current algebra rule list as a chain over each input spelling.
 * Pure / sync — no I/O. Invalid regex rules are skipped with a warning.
 */
export function runAlgebraChain(
  rules: Array<ParsedAlgebraRule | string>,
  inputs: string[]
): ChainPreviewResult {
  const parsedList: ParsedAlgebraRule[] = rules.map((r) =>
    typeof r === "string" ? parseAlgebraRule(r) : r
  );

  const spells = new Map<string, ChainSpellKind>();
  const warnings: string[] = [];

  for (const input of inputs) {
    const t = input.trim();
    if (t) mergeKind(spells, t, "origin");
  }

  parsedList.forEach((parsed, index) => {
    const n = index + 1;
    if (!parsed.valid || parsed.operator === "unknown") {
      warnings.push(
        `第 ${n} 条规则存在语法错误，推导已跳过该规则${
          parsed.error ? `（${parsed.error}）` : ""
        }`
      );
      return;
    }

    const snapshot = [...spells.keys()];
    const op = parsed.operator;

    if (op === "erase") {
      let re: RegExp;
      try {
        re = new RegExp(parsed.args[0] ?? "");
      } catch (e) {
        warnings.push(
          `第 ${n} 条规则存在语法错误，推导已跳过该规则（${
            e instanceof Error ? e.message : String(e)
          }）`
        );
        return;
      }
      for (const s of snapshot) {
        if (re.test(s)) spells.delete(s);
      }
      return;
    }

    if (op === "xlit") {
      const src = parsed.args[0] ?? "";
      const dst = parsed.args[1] ?? "";
      if (Array.from(src).length !== Array.from(dst).length) {
        warnings.push(`第 ${n} 条规则 xlit 长度不一致，推导已跳过该规则`);
        return;
      }
      for (const s of snapshot) {
        const next = applyXlit(s, src, dst);
        if (next !== s) {
          spells.delete(s);
          mergeKind(spells, next, "xlit");
        }
      }
      return;
    }

    if (op === "xform") {
      for (const s of snapshot) {
        const r = applyPatternReplace(s, parsed.args[0] ?? "", parsed.args[1] ?? "");
        if (!r.ok) {
          warnings.push(
            `第 ${n} 条规则存在语法错误，推导已跳过该规则（${r.error}）`
          );
          return;
        }
        if (r.matched && r.result !== s) {
          spells.delete(s);
          mergeKind(spells, r.result, "xform");
        }
      }
      return;
    }

    // derive / fuzz / abbrev
    const outKind = kindFromOperator(op);
    if (!outKind) return;

    // Validate pattern once before mutating the set
    const probe = applyPatternReplace("a", parsed.args[0] ?? "", parsed.args[1] ?? "$0");
    if (!probe.ok) {
      warnings.push(
        `第 ${n} 条规则存在语法错误，推导已跳过该规则（${probe.error}）`
      );
      return;
    }

    for (const s of snapshot) {
      const single = applyParsedRuleToSpelling(parsed, s);
      for (const out of single.outputs) {
        if (out === s) continue;
        mergeKind(spells, out, outKind);
      }
    }
  });

  return { spells, warnings };
}

/** Split user test string by comma / whitespace. */
export function splitChainInputs(raw: string): string[] {
  return raw
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function groupChainSpells(
  spells: Map<string, ChainSpellKind>
): ChainPreviewGroups {
  const groups: ChainPreviewGroups = {
    origin: [],
    derived: [],
    fuzz: [],
    rewritten: [],
  };
  for (const [spelling, kind] of spells) {
    if (kind === "origin") groups.origin.push(spelling);
    else if (kind === "derive" || kind === "abbrev") groups.derived.push(spelling);
    else if (kind === "fuzz") groups.fuzz.push(spelling);
    else groups.rewritten.push(spelling);
  }
  for (const key of Object.keys(groups) as (keyof ChainPreviewGroups)[]) {
    groups[key].sort((a, b) => a.localeCompare(b, "en"));
  }
  return groups;
}
