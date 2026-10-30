import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { githubFetch, GitHubApiError } from "@/lib/github/client";
import { hasTopLevelRimeFiles } from "@/lib/github/files";
import type { GitHubRepoCard } from "@/types";

export const runtime = "nodejs";

type GhRepo = {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  stargazers_count: number;
  html_url: string;
  default_branch: string;
  private: boolean;
  updated_at: string;
  owner: { login: string };
};

function looksLikeRimeByMeta(repo: GhRepo): boolean {
  const hay = `${repo.name} ${repo.description ?? ""}`.toLowerCase();
  return hay.includes("rime");
}

/**
 * GET /user/repos?per_page=100&sort=updated — paginate all,
 * then filter suspected Rime schema repos (name/desc contains rime,
 * or top-level *.schema.yaml / *.dict.yaml).
 */
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.accessToken) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const all: GhRepo[] = [];
    let page = 1;
    while (page <= 10) {
      const batch = await githubFetch<GhRepo[]>(
        `/user/repos?per_page=100&sort=updated&page=${page}&affiliation=owner,collaborator,organization_member`,
        { token: session.accessToken }
      );
      if (!Array.isArray(batch) || batch.length === 0) break;
      all.push(...batch);
      if (batch.length < 100) break;
      page += 1;
    }

    const metaHits = all.filter(looksLikeRimeByMeta);
    const others = all.filter((r) => !looksLikeRimeByMeta(r));

    // Probe a limited number of remaining repos for top-level rime files
    const probed: GhRepo[] = [];
    const probeLimit = 30;
    for (const repo of others.slice(0, probeLimit)) {
      const hit = await hasTopLevelRimeFiles({
        owner: repo.owner.login,
        repo: repo.name,
        token: session.accessToken,
      });
      if (hit) probed.push(repo);
    }

    const combined = [...metaHits, ...probed];
    const seen = new Set<number>();
    const repos: GitHubRepoCard[] = [];
    for (const item of combined) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      repos.push({
        id: item.id,
        full_name: item.full_name,
        owner: item.owner.login,
        name: item.name,
        description: item.description,
        stargazers_count: item.stargazers_count,
        html_url: item.html_url,
        default_branch: item.default_branch,
        private: item.private,
        updated_at: item.updated_at,
      });
    }

    return NextResponse.json({ repos, scanned: all.length });
  } catch (e) {
    if (e instanceof GitHubApiError) {
      return NextResponse.json(
        { error: e.message, rateLimited: e.rateLimited },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "拉取仓库失败" },
      { status: 500 }
    );
  }
}
