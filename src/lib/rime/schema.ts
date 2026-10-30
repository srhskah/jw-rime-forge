import { parseDocument, type ToStringOptions } from "yaml";

/**
 * eemeli/yaml toString options — prefer plain scalars, preserve source style cues.
 * NEVER use js-yaml load/dump for write-back.
 */
export const YAML_TO_STRING_OPTIONS: ToStringOptions = {
  defaultStringType: "PLAIN",
  lineWidth: 0,
};

export type SchemaEditValue = string | number | boolean | null;

/** Known-safe field paths for GUI editing (Rime public structure only). */
export const SAFE_SCHEMA_FIELDS: Array<{
  path: string;
  label: string;
  widget: "text" | "number" | "boolean";
  description?: string;
}> = [
  {
    path: "menu/page_size",
    label: "候选页大小 (menu.page_size)",
    widget: "number",
    description: "每页候选词数量",
  },
  {
    path: "translator/enable_completion",
    label: "启用补全 (translator.enable_completion)",
    widget: "boolean",
  },
  {
    path: "translator/enable_sentence",
    label: "启用造句 (translator.enable_sentence)",
    widget: "boolean",
  },
  {
    path: "translator/enable_user_dict",
    label: "启用用户词典 (translator.enable_user_dict)",
    widget: "boolean",
  },
  {
    path: "speller/max_code_length",
    label: "最大码长 (speller.max_code_length)",
    widget: "number",
  },
  {
    path: "speller/auto_select",
    label: "自动上屏 (speller.auto_select)",
    widget: "boolean",
  },
  {
    path: "schema/name",
    label: "方案名称 (schema.name)",
    widget: "text",
  },
  {
    path: "schema/schema_id",
    label: "方案 ID (schema.schema_id)",
    widget: "text",
  },
  {
    path: "schema/version",
    label: "版本 (schema.version)",
    widget: "text",
  },
];

/** Paths that must never be created/deleted via GUI (Rime preprocessor keys). */
const FORBIDDEN_KEYS = new Set(["__include", "__patch", "__append", "__merge"]);

function pathSegments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

export function getSchemaValue(
  raw: string,
  path: string
): SchemaEditValue | undefined {
  try {
    const doc = parseDocument(raw, { keepSourceTokens: true });
    const node = doc.getIn(pathSegments(path), true);
    if (node === undefined || node === null) return undefined;
    if (typeof node === "object" && node !== null && "toJSON" in node) {
      return (node as { toJSON: () => unknown }).toJSON() as SchemaEditValue;
    }
    return node as SchemaEditValue;
  } catch {
    return undefined;
  }
}

/**
 * Apply a map of path → value onto schema.yaml Document and serialize.
 * Does not touch unknown fields, comments, or __include / __patch keys.
 */
export function applySchemaEdits(
  raw: string,
  edits: Record<string, SchemaEditValue>
): string {
  const doc = parseDocument(raw, { keepSourceTokens: true });
  if (doc.errors?.length) {
    throw new Error(`schema.yaml 解析失败: ${doc.errors[0].message}`);
  }

  for (const [path, value] of Object.entries(edits)) {
    const segs = pathSegments(path);
    if (segs.some((s) => FORBIDDEN_KEYS.has(s))) {
      throw new Error(`禁止通过 GUI 修改预处理指令键: ${path}`);
    }
    if (value === null) {
      doc.deleteIn(segs);
    } else {
      // setIn creates intermediate maps for registered safe paths only
      doc.setIn(segs, value);
    }
  }

  return doc.toString(YAML_TO_STRING_OPTIONS);
}

export function validateSchemaYaml(
  content: string
): { ok: true } | { ok: false; error: string } {
  try {
    const doc = parseDocument(content, { keepSourceTokens: true });
    if (doc.errors?.length) {
      return { ok: false, error: `schema.yaml 解析失败: ${doc.errors[0].message}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: `schema.yaml 解析失败: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/** Collect top-level keys present in schema that are not in the widget registry. */
export function listUnrecognizedTopLevelKeys(raw: string): string[] {
  try {
    const doc = parseDocument(raw, { keepSourceTokens: true });
    const js = doc.toJS() as Record<string, unknown> | null;
    if (!js || typeof js !== "object") return [];
    const registeredRoots = new Set(
      SAFE_SCHEMA_FIELDS.map((f) => f.path.split("/")[0])
    );
    return Object.keys(js).filter(
      (k) => !registeredRoots.has(k) && !FORBIDDEN_KEYS.has(k)
    );
  } catch {
    return [];
  }
}
