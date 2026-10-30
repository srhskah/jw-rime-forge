import { githubFetch, encodeUtf8Base64 } from "./client";

/**
 * Empty repos must use Contents API — Git Data API returns 409.
 * After initialization, subsequent multi-file commits use Git Data API.
 */
export async function initFilesViaContentsApi(opts: {
  owner: string;
  repo: string;
  branch: string;
  files: Array<{ path: string; content: string; message?: string }>;
  token: string;
  message?: string;
}): Promise<{ results: Array<{ path: string; sha: string; commitSha: string }> }> {
  const results: Array<{ path: string; sha: string; commitSha: string }> = [];

  // Contents API is per-file; for empty-repo bootstrap we accept sequential
  // creates as the one-time exception documented in the product spec.
  for (let i = 0; i < opts.files.length; i++) {
    const file = opts.files[i];
    const msg =
      file.message ??
      opts.message ??
      (i === 0
        ? "web: initialize schema.yaml and dict.yaml"
        : `web: initialize ${file.path}`);

    const data = await githubFetch<{
      content: { path: string; sha: string };
      commit: { sha: string };
    }>(
      `/repos/${opts.owner}/${opts.repo}/contents/${file.path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      {
        token: opts.token,
        method: "PUT",
        body: {
          message: msg,
          content: encodeUtf8Base64(file.content),
          branch: opts.branch,
        },
      }
    );
    results.push({
      path: data.content.path,
      sha: data.content.sha,
      commitSha: data.commit.sha,
    });
  }

  return { results };
}

export async function isEmptyOrNearEmptyRepo(opts: {
  owner: string;
  repo: string;
  token: string;
}): Promise<{ empty: boolean; reason: string }> {
  try {
    await githubFetch(
      `/repos/${opts.owner}/${opts.repo}/git/refs/heads`,
      { token: opts.token }
    );
  } catch (e) {
    const status = e && typeof e === "object" && "status" in e ? Number(e.status) : 0;
    // 409 Conflict = Git Repository is empty
    if (status === 409) {
      return { empty: true, reason: "repository_empty" };
    }
    if (status === 404) {
      return { empty: true, reason: "no_refs" };
    }
  }

  try {
    const commits = await githubFetch<unknown[]>(
      `/repos/${opts.owner}/${opts.repo}/commits?per_page=2`,
      { token: opts.token }
    );
    if (!Array.isArray(commits) || commits.length === 0) {
      return { empty: true, reason: "no_commits" };
    }
    // "only initial commit" — still allow bootstrap if no rime files
    return { empty: false, reason: "has_commits" };
  } catch (e) {
    const status = e && typeof e === "object" && "status" in e ? Number(e.status) : 0;
    if (status === 409) {
      return { empty: true, reason: "repository_empty" };
    }
    throw e;
  }
}
