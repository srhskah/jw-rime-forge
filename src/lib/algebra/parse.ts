import {
  ALGEBRA_OPERATORS,
  type AlgebraOperator,
  type ParsedAlgebraRule,
} from "./types";

const OP_RE = /^(xlit|xform|erase|derive|fuzz|abbrev)/;

function isLetter(ch: string): boolean {
  return /^[A-Za-z]$/.test(ch);
}

/** Count Unicode code points (MB4-safe). */
export function codePointLength(s: string): number {
  return Array.from(s).length;
}

/**
 * Parse one Rime spelling-algebra rule.
 * Format: `<op><sep><arg1><sep><arg2>...` (trailing sep optional).
 */
export function parseAlgebraRule(raw: string): ParsedAlgebraRule {
  const text = raw.trim();
  if (!text) {
    return {
      raw,
      operator: "unknown",
      separator: "",
      args: [],
      valid: false,
      error: "空规则",
    };
  }

  const m = OP_RE.exec(text);
  if (!m) {
    return {
      raw,
      operator: "unknown",
      separator: "",
      args: [],
      valid: false,
      error: "unknown operator",
    };
  }

  const operator = m[1] as AlgebraOperator;
  const rest = text.slice(m[0].length);
  if (!rest.length) {
    return {
      raw,
      operator,
      separator: "",
      args: [],
      valid: false,
      error: "缺少分隔符与参数",
    };
  }

  const separator = rest[0];
  if (isLetter(separator)) {
    return {
      raw,
      operator,
      separator: "",
      args: [],
      valid: false,
      error: "分隔符必须是非字母字符",
    };
  }

  // Split by separator; allow trailing empty from final sep
  const parts = rest.slice(1).split(separator);
  if (parts.length && parts[parts.length - 1] === "") {
    parts.pop();
  }
  const args = parts;

  // Separator consistency: already using single split char; reject if op reused oddly
  if (args.some((a) => a.includes("\0"))) {
    return {
      raw,
      operator,
      separator,
      args,
      valid: false,
      error: "参数非法",
    };
  }

  if (!ALGEBRA_OPERATORS.includes(operator)) {
    return {
      raw,
      operator: "unknown",
      separator,
      args,
      valid: false,
      error: "unknown operator",
    };
  }

  if (operator === "xlit") {
    if (args.length < 2) {
      return {
        raw,
        operator,
        separator,
        args,
        valid: false,
        error: "xlit 需要源字符集与目标字符集",
      };
    }
    const srcLen = codePointLength(args[0]);
    const dstLen = codePointLength(args[1]);
    if (srcLen !== dstLen) {
      return {
        raw,
        operator,
        separator,
        args,
        valid: false,
        error: `xlit 源/目标长度不一致（${srcLen} vs ${dstLen}）`,
      };
    }
  } else if (operator === "erase") {
    if (args.length < 1 || args[0] === "") {
      return {
        raw,
        operator,
        separator,
        args,
        valid: false,
        error: "erase 至少需要匹配正则",
      };
    }
  } else {
    // xform / derive / fuzz / abbrev
    if (args.length < 2) {
      return {
        raw,
        operator,
        separator,
        args,
        valid: false,
        error: `${operator} 至少需要匹配模式与替换模式`,
      };
    }
  }

  return {
    raw,
    operator,
    separator,
    args,
    valid: true,
  };
}

/** Rebuild rule string from parts (always ends with separator, Rime style). */
export function formatAlgebraRule(
  operator: AlgebraOperator,
  separator: string,
  args: string[]
): string {
  const sep = separator || "/";
  return `${operator}${sep}${args.join(sep)}${sep}`;
}

/**
 * Best-effort JS RegExp check — not Boost.Regex.
 * Returns a soft warning string when pattern throws in the browser.
 */
export function softRegexWarning(pattern: string): string | null {
  if (!pattern) return null;
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern);
    return null;
  } catch (e) {
    return `规则可能包含无效正则，请确认（${e instanceof Error ? e.message : String(e)}）`;
  }
}
