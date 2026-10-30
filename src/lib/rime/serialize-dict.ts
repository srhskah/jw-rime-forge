import { parseDocument } from "yaml";
import type { DictEntry } from "@/types";
import { splitDictSections, parseDictEntries } from "./parse-dict";

/**
 * Rebuild dict.yaml: keep header (comments + YAML block) verbatim,
 * rewrite only the entry region with tab-separated columns.
 * Empty code/weight → output only filled columns (pure-text compatible).
 */
export function serializeDictEntries(
  entries: DictEntry[],
  columns: string[] = ["text", "code", "weight"]
): string {
  const lines: string[] = [];
  for (const entry of entries) {
    const hasCode = entry.code !== undefined && entry.code !== "";
    const hasWeight = entry.weight !== undefined && entry.weight !== "";

    if (!hasCode && !hasWeight) {
      lines.push(entry.text);
      continue;
    }

    const parts: string[] = [];
    for (const col of columns) {
      if (col === "text") parts.push(entry.text ?? "");
      else if (col === "code") parts.push(entry.code ?? "");
      else if (col === "weight") parts.push(entry.weight ?? "");
      else parts.push("");
    }

    // Trim trailing empty columns so pure-text / text+code stay compact
    while (parts.length > 1 && parts[parts.length - 1] === "") {
      parts.pop();
    }
    lines.push(parts.join("\t"));
  }
  return lines.join("\n") + (lines.length ? "\n" : "");
}

export function rebuildDictYaml(
  headerRaw: string,
  entries: DictEntry[],
  columns: string[] = ["text", "code", "weight"]
): string {
  const header = headerRaw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const body = serializeDictEntries(entries, columns);
  if (!header) return body;
  const needsNewline = !header.endsWith("\n");
  return header + (needsNewline ? "\n" : "") + body;
}

/**
 * Round-trip validation before commit:
 * - header must parse as YAML
 * - entry count must match expected
 */
export function validateDictYaml(
  content: string,
  /** Pass a negative number to skip entry-count check */
  expectedEntryCount: number
): { ok: true } | { ok: false; error: string } {
  const { headerRaw, entriesRaw } = splitDictSections(content);

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

  try {
    const doc = parseDocument(yamlBlock, { keepSourceTokens: true });
    if (doc.errors?.length) {
      return { ok: false, error: `dict.yaml 头部 YAML 解析失败: ${doc.errors[0].message}` };
    }
  } catch (e) {
    return {
      ok: false,
      error: `dict.yaml 头部 YAML 解析失败: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  let columns = ["text", "code", "weight"];
  try {
    const doc = parseDocument(yamlBlock);
    const js = doc.toJS() as Record<string, unknown> | null;
    if (js && Array.isArray(js.columns)) {
      columns = js.columns as string[];
    }
  } catch {
    /* keep default */
  }

  const entries = parseDictEntries(entriesRaw, columns);
  if (expectedEntryCount >= 0 && entries.length !== expectedEntryCount) {
    return {
      ok: false,
      error: `dict.yaml 词条行数不一致：期望 ${expectedEntryCount}，实际 ${entries.length}`,
    };
  }
  return { ok: true };
}
