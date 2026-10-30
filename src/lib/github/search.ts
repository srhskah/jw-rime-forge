import { githubFetch } from "./client";
import { cacheGet, cacheSet } from "./cache";
import type { GitHubRepoCard } from "@/types";

type SearchReposResponse = {
  total_count: number;
  incomplete_results: boolean;
  items: Array<{
    id: number;
    full_name: string;
    name: string;
    description: string | null;
    stargazers_count: number;
    html_url: string;
    default_branch: string;
    owner: { login: string };
    private?: boolean;
    updated_at?: string;
  }>;
};

function mapRepos(items: SearchReposResponse["items"]): GitHubRepoCard[] {
  return items.map((item) => ({
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
  }));
}

async function runSearch(
  query: string,
  opts: {
    sort?: "stars" | "updated" | "best-match";
    page?: number;
    perPage?: number;
    token?: string | null;
  }
): Promise<{ total: number; repos: GitHubRepoCard[] }> {
  const sort = opts.sort === "best-match" ? "" : `&sort=${opts.sort ?? "stars"}`;
  const page = opts.page ?? 1;
  const perPage = Math.min(opts.perPage ?? 20, 50);
  const data = await githubFetch<SearchReposResponse>(
    `/search/repositories?q=${encodeURIComponent(query)}${sort}&order=desc&page=${page}&per_page=${perPage}`,
    { token: opts.token }
  );
  return { total: data.total_count, repos: mapRepos(data.items) };
}

/**
 * Discover Rime-related public repos via Search API.
 *
 * - 无关键词：topic:rime，按 star 降序取前 20（未登录也可）
 * - 有关键词：单次请求，在 name / About / README 字面匹配（支持中文）
 * - 短缓存，降低匿名 60/hr 限额压力
 */
export async function searchRimeRepos(opts: {
  q?: string;
  sort?: "stars" | "updated" | "best-match";
  page?: number;
  perPage?: number;
  token?: string | null;
}): Promise<{ total: number; repos: GitHubRepoCard[] }> {
  const phrase = (opts.q ?? "").trim().replace(/"/g, "");
  const perPage = Math.min(opts.perPage ?? 20, 50);
  const sort = opts.sort ?? "stars";
  const page = opts.page ?? 1;

  const cacheKey = `search:${phrase}|${sort}|${page}|${perPage}`;
  const cached = cacheGet<{ total: number; repos: GitHubRepoCard[] }>(cacheKey);
  if (cached) return cached;

  // 单次请求：有关键词时字面匹配 name/About/README，并限定 topic:rime
  // （不做双查询，避免未登录瞬间耗尽 60 次/小时配额）
  const query = phrase
    ? `"${phrase}" in:name,description,readme topic:rime`
    : "topic:rime";

  const result = await runSearch(query, {
    ...opts,
    sort,
    page,
    perPage,
  });

  // 默认列表缓存更久；关键词短缓存
  cacheSet(cacheKey, result, phrase ? 45_000 : 120_000);
  return result;
}
