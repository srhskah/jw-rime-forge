export const ALGEBRA_OPERATORS = [
  "xlit",
  "xform",
  "erase",
  "derive",
  "fuzz",
  "abbrev",
] as const;

export type AlgebraOperator = (typeof ALGEBRA_OPERATORS)[number];

export type ParsedAlgebraRule = {
  raw: string;
  operator: AlgebraOperator | "unknown";
  separator: string;
  args: string[];
  valid: boolean;
  error?: string;
};

export type AlgebraReadResult = {
  /** True when speller/algebra key exists */
  present: boolean;
  /** False when algebra is __include / non-array / mixed preprocessor form */
  editable: boolean;
  rules: string[];
  reason?: string;
};
