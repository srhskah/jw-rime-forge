import {
  ALGEBRA_OPERATORS,
  ALGEBRA_TEMPLATES,
  applyAlgebraRules,
  formatAlgebraRule,
  parseAlgebraRule,
  previewAlgebraRule,
  readAlgebra,
  softRegexWarning,
  templateToRule,
} from "../src/lib/algebra";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// --- six operators ---
for (const op of ALGEBRA_OPERATORS) {
  const rule =
    op === "erase"
      ? formatAlgebraRule(op, "/", ["^x$"])
      : op === "xlit"
        ? formatAlgebraRule(op, "/", ["ab", "xy"])
        : formatAlgebraRule(op, "/", ["^a$", "b"]);
  const p = parseAlgebraRule(rule);
  assert(p.valid && p.operator === op, `${op} parse`);
}

assert(!parseAlgebraRule("xlit/ab/xyz/").valid, "xlit length mismatch");
assert(!parseAlgebraRule("erase/").valid, "erase needs pattern");
assert(!parseAlgebraRule("nope/a/b/").valid, "unknown op");
assert(parseAlgebraRule("derive|^n|l|").valid, "alt separator |");

// separator consistency / soft regex
assert(softRegexWarning("(") !== null, "soft regex warn");
assert(softRegexWarning("^n") === null, "soft regex ok");

const prev = previewAlgebraRule("abbrev/^([a-z]).+$/$1/", "nihao");
assert(
  prev.outputs.includes("nihao") && prev.outputs.includes("n"),
  "abbrev preview"
);
assert(
  previewAlgebraRule("xlit/abc/xyz/", "cab").outputs[0] === "zxy",
  "xlit preview"
);
assert(
  previewAlgebraRule("erase/^foo$/", "foo").outputs.length === 0,
  "erase preview"
);

const schema = `# keep comment
schema:
  schema_id: demo
speller:
  alphabet: abc
  algebra:
    - xform/abc/xyz/
    - derive/^n/l/
`;

const read = readAlgebra(schema);
assert(read.present && read.editable && read.rules.length === 2, "read algebra");

const next = applyAlgebraRules(schema, [
  ...read.rules,
  formatAlgebraRule("fuzz", "/", ["^n", "l"]),
]);
assert(readAlgebra(next).rules.length === 3, "apply algebra append");
assert(next.includes("schema_id: demo"), "preserve other fields");
assert(next.includes("# keep comment"), "preserve comment");

const includeSchema = `speller:
  algebra:
    __include: luna_pinyin.schema:/speller/algebra
`;
const inc = readAlgebra(includeSchema);
assert(inc.present && !inc.editable, "include not editable");

for (const t of ALGEBRA_TEMPLATES) {
  const r = parseAlgebraRule(templateToRule(t));
  assert(r.valid, `template ${t.id}`);
}

console.log("smoke-algebra: OK");
