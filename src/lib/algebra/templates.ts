import type { AlgebraOperator } from "./types";
import { formatAlgebraRule } from "./parse";

export type AlgebraTemplate = {
  id: string;
  label: string;
  description: string;
  operator: AlgebraOperator;
  args: string[];
};

/** Fill-only templates — never write to file until user clicks 添加. */
export const ALGEBRA_TEMPLATES: AlgebraTemplate[] = [
  {
    id: "abbrev-simple",
    label: "简拼（首字母）",
    description: "abbrev/^([a-z]).+$/$1/",
    operator: "abbrev",
    args: ["^([a-z]).+$", "$1"],
  },
  {
    id: "abbrev-zh-ch-sh",
    label: "声母简拼 zh/ch/sh",
    description: "abbrev/^([zcs]h).+$/$1/",
    operator: "abbrev",
    args: ["^([zcs]h).+$", "$1"],
  },
  {
    id: "derive-u-to-v",
    label: "ü 转 v（jqxy）",
    description: "derive/^([jqxy])u/$1v/",
    operator: "derive",
    args: ["^([jqxy])u", "$1v"],
  },
  {
    id: "derive-n-l",
    label: "模糊音 n→l",
    description: "derive/^n/l/",
    operator: "derive",
    args: ["^n", "l"],
  },
  {
    id: "fuzz-n-l",
    label: "模糊音 n/l（fuzz）",
    description: "fuzz/^n/l/",
    operator: "fuzz",
    args: ["^n", "l"],
  },
  {
    id: "xlit-uv",
    label: "xlit：v↔ü（示意）",
    description: "xlit/v/ü/",
    operator: "xlit",
    args: ["v", "ü"],
  },
];

export function templateToRule(t: AlgebraTemplate): string {
  return formatAlgebraRule(t.operator, "/", t.args);
}
