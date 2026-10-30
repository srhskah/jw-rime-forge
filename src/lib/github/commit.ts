import { githubFetch } from "./client";
import type { FileChange } from "@/types";

type RefResponse = {
  ref: string;
  object: { sha: string; type: string; url: string };
};

type CommitResponse = {
  sha: string;
  tree: { sha: string };
  message: string;
  html_url?: string;
};

type BlobResponse = { sha: string; url: string };
type TreeResponse = { sha: string; url: string };

/**
 * Atomic multi-file commit via Git Data API:
 * blobs → tree → commit → update ref
 *
 * Forbidden: Contents API per-file commits to simulate multi-file save.
 * Empty repos return 409 from Git Data API — use initEmptyRepoContents instead.
 */
export async function atomicCommit(opts: {
  owner: string;
  repo: string;
  branch: string;
  message: string;
  changes: FileChange[];
  token: string;
}): Promise<{ commitSha: string; htmlUrl?: string }> {
  const { owner, repo, branch, message, changes, token } = opts;
  if (!changes.length) {
    throw new Error("没有需要提交的变更");
  }

  // 1. Resolve current tip (optimistic lock base)
  let refData: RefResponse;
  try {
    refData = await githubFetch<RefResponse>(
      `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
      { token }
    );
  } catch (e) {
    const status = e && typeof e === "object" && "status" in e ? Number(e.status) : 0;
    if (status === 409 || status === 404) {
      throw new Error(
        "空仓库或分支不存在：请先使用 Contents API 初始化文件，再使用 Git Data API 提交"
      );
    }
    throw e;
  }

  const parentSha = refData.object.sha;
  const parentCommit = await githubFetch<CommitResponse>(
    `/repos/${owner}/${repo}/git/commits/${parentSha}`,
    { token }
  );
  const baseTreeSha = parentCommit.tree.sha;

  // Optional optimistic lock: verify each changed file's blob still matches baseSha
  for (const change of changes) {
    if (!change.baseSha) continue;
    try {
      const contentMeta = await githubFetch<{ sha: string }>(
        `/repos/${owner}/${repo}/contents/${change.path
          .split("/")
          .map(encodeURIComponent)
          .join("/")}?ref=${encodeURIComponent(branch)}`,
        { token }
      );
      if (contentMeta.sha !== change.baseSha) {
        throw new Error(
          `文件 ${change.path} 已被他人修改（乐观锁冲突），请刷新后重试`
        );
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("乐观锁")) throw e;
      // New file path may 404 — OK if no baseSha expected; if baseSha set, surface error
      if (change.baseSha) {
        const status = e && typeof e === "object" && "status" in e ? Number(e.status) : 0;
        if (status !== 404) throw e;
        throw new Error(`文件 ${change.path} 不存在或已被删除，请刷新后重试`);
      }
    }
  }

  // 2. Create blobs (UTF-8 — full MB4 support, no 3-byte truncation)
  const treeItems: Array<{
    path: string;
    mode: "100644";
    type: "blob";
    sha: string;
  }> = [];

  for (const change of changes) {
    const blob = await githubFetch<BlobResponse>(
      `/repos/${owner}/${repo}/git/blobs`,
      {
        token,
        method: "POST",
        body: {
          content: change.content,
          encoding: "utf-8",
        },
      }
    );
    treeItems.push({
      path: change.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  // 3. Create tree from base
  const newTree = await githubFetch<TreeResponse>(
    `/repos/${owner}/${repo}/git/trees`,
    {
      token,
      method: "POST",
      body: {
        base_tree: baseTreeSha,
        tree: treeItems,
      },
    }
  );

  // 4. Create commit
  const commit = await githubFetch<CommitResponse>(
    `/repos/${owner}/${repo}/git/commits`,
    {
      token,
      method: "POST",
      body: {
        message,
        tree: newTree.sha,
        parents: [parentSha],
      },
    }
  );

  // 5. Update ref (fast-forward; fails if race)
  await githubFetch(
    `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
    {
      token,
      method: "PATCH",
      body: {
        sha: commit.sha,
        force: false,
      },
    }
  );

  return {
    commitSha: commit.sha,
    htmlUrl: `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
  };
}

export function buildCommitMessage(opts: {
  schemaChanged?: boolean;
  schemaHints?: string[];
  dictAdded?: number;
  dictRemoved?: number;
  dictModified?: number;
  init?: boolean;
}): string {
  if (opts.init) {
    return "web: initialize schema.yaml and dict.yaml";
  }
  const parts: string[] = [];
  if (opts.schemaChanged) {
    const hint = opts.schemaHints?.filter(Boolean).slice(0, 2).join(", ");
    parts.push(hint ? `update schema.yaml ${hint}` : "update schema.yaml");
  }
  if (opts.dictAdded || opts.dictRemoved || opts.dictModified) {
    const bits: string[] = [];
    if (opts.dictAdded) bits.push(`add ${opts.dictAdded} entries`);
    if (opts.dictRemoved) bits.push(`remove ${opts.dictRemoved} entries`);
    if (opts.dictModified) bits.push(`edit ${opts.dictModified} entries`);
    parts.push(`${bits.join(", ")} to dict.yaml`);
  }
  if (!parts.length) return "web: update rime files";
  return `web: ${parts.join("; ")}`;
}
