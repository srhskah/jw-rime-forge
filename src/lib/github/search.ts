import { githubFetch } from "./client";
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

/**
 * Discover Rime-related public repos via Search API.
 * Query: topic:rime OR name/description contains rime.
 */
export async function searchRimeRepos(opts: {
  q?: string;
  sort?: "stars" | "updated" | "best-match";
  page?: number;
  perPage?: number;
  token?: string | null;
}): Promise<{ total: number; repos: GitHubRepoCard[] }> {
  const extra = opts.q?.trim() ? `${opts.q.trim()} ` : "";
  // topic OR name/description containing rime
  const query = `${extra}(topic:rime OR rime in:name,description)`;
  const sort = opts.sort === "best-match" ? "" : `&sort=${opts.sort ?? "stars"}`;
  const page = opts.page ?? 1;
  const perPage = Math.min(opts.perPage ?? 20, 50);

  const data = await githubFetch<SearchReposResponse>(
    `/search/repositories?q=${encodeURIComponent(query)}${sort}&order=desc&page=${page}&per_page=${perPage}`,
    { token: opts.token }
  );

  return {
    total: data.total_count,
    repos: data.items.map((item) => ({
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
    })),
  };
}
