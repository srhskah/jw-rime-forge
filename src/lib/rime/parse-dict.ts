import { parseDocument } from "yaml";
import type { DictEntry } from "@/types";

const LARGE_FILE_BYTES = 5 * 1024 * 1024;
const LARGE_FILE_LINES = 100_000;

export type ParsedDict = {
  headerRaw: string;
  entriesRaw: string;
  entries: DictEntry[];
  columns: string[];
  name: string | null;
  sort: string | null;
  meta: Record<string, unknown>;
  largeWarning: string | null;
  separator: "\t";
};

/**
 * Split Rime dict.yaml into header (YAML front matter) and entry lines.
 * Compatible with:
 *   --- ... ---
 *   --- ... ...
 *   bare YAML header then blank line then entries
 */
export function splitDictSections(raw: string): { headerRaw: string; entriesRaw: string } {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");

  let headerStart = -1;
  let headerEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "---") {
      if (headerStart === -1) {
        headerStart = i;
      } else {
        headerEnd = i;
        break;
      }
      continue;
    }
    if (headerStart !== -1 && trimmed === "...") {
      headerEnd = i;
      break;
    }
  }

  if (headerStart !== -1 && headerEnd !== -1) {
    const headerRaw = lines.slice(0, headerEnd + 1).join("\n");
    const entriesRaw = lines.slice(headerEnd + 1).join("\n").replace(/^\n+/, "");
    return { headerRaw, entriesRaw };
  }

  // No ---/... markers: treat leading comment + YAML-ish keys as header until first tab line
  let entryStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (line.includes("\t")) {
      entryStart = i;
      break;
    }
    // continue consuming YAML-looking header lines
    entryStart = i + 1;
  }

  const headerRaw = lines.slice(0, entryStart).join("\n");
  const entriesRaw = lines.slice(entryStart).join("\n");
  return { headerRaw, entriesRaw };
}

export function parseDictEntries(entriesRaw: string, columns: string[]): DictEntry[] {
  const lines = entriesRaw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const entries: DictEntry[] = [];

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const parts = line.split("\t");
    const entry: DictEntry = { text: parts[0] ?? "" };
    const codeIdx = columns.indexOf("code");
    const weightIdx = columns.indexOf("weight");
    if (codeIdx >= 0 && parts[codeIdx] !== undefined && parts[codeIdx] !== "") {
      entry.code = parts[codeIdx];
    } else if (codeIdx < 0 && parts[1] !== undefined && parts[1] !== "") {
      entry.code = parts[1];
    }
    if (weightIdx >= 0 && parts[weightIdx] !== undefined && parts[weightIdx] !== "") {
      entry.weight = parts[weightIdx];
    } else if (weightIdx < 0 && parts[2] !== undefined && parts[2] !== "") {
      entry.weight = parts[2];
    }
    // pure text: only one column
    if (parts.length === 1) {
      delete entry.code;
      delete entry.weight;
    }
    entries.push(entry);
  }
  return entries;
}

function extractColumns(meta: Record<string, unknown>): string[] {
  const cols = meta.columns;
  if (Array.isArray(cols) && cols.every((c) => typeof c === "string")) {
    return cols as string[];
  }
  return ["text", "code", "weight"];
}

export function parseDict(raw: string): ParsedDict {
  const byteLength = new TextEncoder().encode(raw).length;
  const lineCount = raw.split(/\r\n|\r|\n/).length;
  let largeWarning: string | null = null;
  if (byteLength > LARGE_FILE_BYTES || lineCount > LARGE_FILE_LINES) {
    largeWarning = `词库较大（约 ${(byteLength / 1024 / 1024).toFixed(1)} MB / ${lineCount.toLocaleString()} 行）。建议只读浏览或分批编辑，MVP 不承诺流畅编辑超大文件。`;
  }

  const { headerRaw, entriesRaw } = splitDictSections(raw);

  // Parse only the YAML header block with eemeli/yaml
  let yamlBlock = headerRaw;
  const dashMatch = headerRaw.match(/^([\s\S]*?)^---\s*$([\s\S]*?)(?:^\.\.\.\s*$|^---\s*$)/m);
  if (dashMatch) {
    yamlBlock = dashMatch[2];
  } else {
    yamlBlock = headerRaw
      .split("\n")
      .filter((l) => !l.trim().startsWith("#") && l.trim() !== "---" && l.trim() !== "...")
      .join("\n");
  }

  let meta: Record<string, unknown> = {};
  try {
    const doc = parseDocument(yamlBlock, { keepSourceTokens: true });
    const js = doc.toJS() as Record<string, unknown> | null;
    if (js && typeof js === "object") meta = js;
  } catch {
    meta = {};
  }

  const columns = extractColumns(meta);
  const entries = parseDictEntries(entriesRaw, columns);

  return {
    headerRaw,
    entriesRaw,
    entries,
    columns,
    name: typeof meta.name === "string" ? meta.name : null,
    sort: typeof meta.sort === "string" ? meta.sort : null,
    meta,
    largeWarning,
    separator: "\t",
  };
}

/** Indices of entries whose text or code matches query (case-insensitive substring). */
export function filterEntryIndices(entries: DictEntry[], query: string): number[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries.map((_, i) => i);
  const out: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.text.toLowerCase().includes(q)) {
      out.push(i);
      continue;
    }
    if ((e.code ?? "").toLowerCase().includes(q)) out.push(i);
  }
  return out;
}

export function filterEntries(entries: DictEntry[], query: string): DictEntry[] {
  return filterEntryIndices(entries, query).map((i) => entries[i]);
}
