/**
 * Smoke test for dict parse / serialize fidelity.
 * Run: npx tsx scripts/smoke-dict.ts
 */
import { parseDict } from "../src/lib/rime/parse-dict";
import { rebuildDictYaml, validateDictYaml } from "../src/lib/rime/serialize-dict";
import { applySchemaEdits, validateSchemaYaml } from "../src/lib/rime/schema";

const SAMPLE = `# comment must survive
---
name: smoke_dict
version: "1.0"
sort: by_weight
columns:
  - text
  - code
  - weight
...
你好\tnihao\t100
世界\tshijie
纯词
emoji😀\temoji\t1
`;

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const parsed = parseDict(SAMPLE);
assert(parsed.name === "smoke_dict", "name meta");
assert(parsed.columns.includes("text"), "columns");
assert(parsed.entries.length === 4, `entries ${parsed.entries.length}`);
assert(parsed.entries[2].text === "纯词" && !parsed.entries[2].code, "pure text");
assert(parsed.entries[3].text === "emoji😀", "mb4 emoji");
assert(parsed.headerRaw.includes("# comment must survive"), "header comment");

const rebuilt = rebuildDictYaml(parsed.headerRaw, parsed.entries, parsed.columns);
assert(rebuilt.startsWith(parsed.headerRaw.trimEnd()) || rebuilt.includes("# comment"), "header preserved");
assert(rebuilt.includes("纯词\n") || rebuilt.includes("纯词\r"), "pure text line");
assert(rebuilt.includes("emoji😀\temoji\t1"), "tab + mb4");

const v = validateDictYaml(rebuilt, 4);
assert(v.ok, v.ok ? "" : v.error);

const schema = `schema:
  schema_id: smoke
  name: 测试
menu:
  page_size: 5
translator:
  enable_completion: false
`;
const edited = applySchemaEdits(schema, {
  "menu/page_size": 9,
  "translator/enable_completion": true,
});
assert(edited.includes("page_size: 9"), "page_size edit");
assert(validateSchemaYaml(edited).ok, "schema validate");

console.log("smoke-dict: OK");
