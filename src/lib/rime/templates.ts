/** Minimal schema.yaml skeleton — Rime public structure only. */
export function createSchemaTemplate(opts: {
  schemaId: string;
  name: string;
  dictName?: string;
}): string {
  const dict = opts.dictName ?? opts.schemaId;
  return `# Rime schema — created by Rime 方案工作站
# https://github.com/rime/home

schema:
  schema_id: ${opts.schemaId}
  name: ${opts.name}
  version: "0.1"
  author:
    - "Rime 方案工作站"
  description: |
    由 Web 工作站从零创建的最小骨架

engine:
  processors:
    - ascii_composer
    - recognizer
    - key_binder
    - speller
    - punctuator
    - selector
    - navigator
    - express_editor
  segmentors:
    - ascii_segmentor
    - matcher
    - abc_segmentor
    - punct_segmentor
    - fallback_segmentor
  translators:
    - punct_translator
    - table_translator
  filters:
    - uniquifier

speller:
  alphabet: zyxwvutsrqponmlkjihgfedcba
  delimiter: " '"

translator:
  dictionary: ${dict}
  enable_completion: true
  enable_sentence: false
  enable_user_dict: true

menu:
  page_size: 5
`;
}

/** Minimal dict.yaml — header metadata + empty entry region. */
export function createDictTemplate(opts: {
  name: string;
  columns?: string[];
}): string {
  const cols = opts.columns ?? ["text", "code", "weight"];
  const colYaml = cols.map((c) => `  - ${c}`).join("\n");
  return `# Rime dictionary — created by Rime 方案工作站
---
name: ${opts.name}
version: "0.1"
sort: by_weight
columns:
${colYaml}
...
`;
}
