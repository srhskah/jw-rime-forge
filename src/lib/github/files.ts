import { githubFetch, decodeBase64Utf8 } from "./client";
import type { DiscoveredRimeFile } from "@/types";

type TreeEntry = {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
  url: string;
};

type TreeResponse = {
  sha: string;
  truncated: boolean;
  tree: TreeEntry[];
};

type ContentFile = {
  name: string;
  path: string;
  sha: string;
  size: number;
  content?: string;
  encoding?: string;
  type: string;
  download_url: string | null;
};

const MAX_DEPTH = 6;
const MAX_FILES = 200;

function depthOf(path: string): number {
  return path.split("/").filter(Boolean).length;
}

/**
 * Recursively discover *.schema.yaml / *.dict.yaml via git tree.
 * Caps depth and file count to protect against huge repos.
 */
export async function discoverRimeFiles(opts: {
  owner: string;
  repo: string;
  branch?: string;
  token?: string | null;
}): Promise<{ files: DiscoveredRimeFile[]; truncated: boolean; branch: string }> {
  const branch = opts.branch ?? (await getDefaultBranch(opts));
  const tree = await githubFetch<TreeResponse>(
    `/repos/${opts.owner}/${opts.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { token: opts.token }
  );

  const files: DiscoveredRimeFile[] = [];
  for (const entry of tree.tree) {
    if (entry.type !== "blob") continue;
    if (depthOf(entry.path) > MAX_DEPTH) continue;
    const lower = entry.path.toLowerCase();
    let type: "schema" | "dict" | null = null;
    if (lower.endsWith(".schema.yaml") || lower.endsWith(".schema.yml")) {
      type = "schema";
    } else if (lower.endsWith(".dict.yaml") || lower.endsWith(".dict.yml")) {
      type = "dict";
    }
    if (!type) continue;
    files.push({
      path: entry.path,
      type,
      size: entry.size ?? 0,
      sha: entry.sha,
    });
    if (files.length >= MAX_FILES) break;
  }

  return {
    files,
    truncated: tree.truncated || files.length >= MAX_FILES,
    branch,
  };
}

export async function getDefaultBranch(opts: {
  owner: string;
  repo: string;
  token?: string | null;
}): Promise<string> {
  const data = await githubFetch<{ default_branch: string }>(
    `/repos/${opts.owner}/${opts.repo}`,
    { token: opts.token }
  );
  return data.default_branch;
}

/**
 * Fetch raw file content as UTF-8 string (preserves MB4 / original bytes as text).
 * Prefer Contents API for small files; falls back to blob API.
 */
export async function getFileContent(opts: {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
  token?: string | null;
}): Promise<{ content: string; sha: string; size: number }> {
  const refQ = opts.ref ? `?ref=${encodeURIComponent(opts.ref)}` : "";
  const data = await githubFetch<ContentFile>(
    `/repos/${opts.owner}/${opts.repo}/contents/${opts.path.split("/").map(encodeURIComponent).join("/")}${refQ}`,
    { token: opts.token }
  );

  if (data.encoding === "base64" && data.content) {
    return {
      content: decodeBase64Utf8(data.content),
      sha: data.sha,
      size: data.size,
    };
  }

  // Large files: Contents API may omit content — use git blob
  const blob = await githubFetch<{ content: string; encoding: string; size: number; sha: string }>(
    `/repos/${opts.owner}/${opts.repo}/git/blobs/${data.sha}`,
    { token: opts.token }
  );
  const content =
    blob.encoding === "base64"
      ? decodeBase64Utf8(blob.content)
      : blob.content;
  return { content, sha: blob.sha, size: blob.size };
}

/** Top-level only check for *.schema.yaml / *.dict.yaml (user repo filtering). */
export async function hasTopLevelRimeFiles(opts: {
  owner: string;
  repo: string;
  token?: string | null;
}): Promise<boolean> {
  try {
    const items = await githubFetch<Array<{ name: string; type: string }>>(
      `/repos/${opts.owner}/${opts.repo}/contents/`,
      { token: opts.token }
    );
    if (!Array.isArray(items)) return false;
    return items.some((f) => {
      const n = f.name.toLowerCase();
      return (
        n.endsWith(".schema.yaml") ||
        n.endsWith(".schema.yml") ||
        n.endsWith(".dict.yaml") ||
        n.endsWith(".dict.yml")
      );
    });
  } catch {
    return false;
  }
}
