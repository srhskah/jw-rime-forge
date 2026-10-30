const GITHUB_API = "https://api.github.com";

export class GitHubApiError extends Error {
  status: number;
  rateLimited: boolean;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.rateLimited = status === 403 || status === 429;
    this.body = body;
  }
}

export type GitHubFetchOptions = {
  token?: string | null;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Accept header override */
  accept?: string;
};

export async function githubFetch<T = unknown>(
  path: string,
  opts: GitHubFetchOptions = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  const headers: Record<string, string> = {
    Accept: opts.accept ?? "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "jw-rime-forge",
    ...opts.headers,
  };
  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      data && typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: string }).message)
        : `GitHub API ${res.status}`;
    const remaining = res.headers.get("x-ratelimit-remaining");
    const suffix =
      (res.status === 403 || res.status === 429) && remaining === "0"
        ? "（GitHub API 速率限制已用尽，请稍后重试或登录以提高限额）"
        : "";
    throw new GitHubApiError(res.status, msg + suffix, data);
  }

  return data as T;
}

/** Decode GitHub content API base64 → UTF-8 string (full MB4). */
export function decodeBase64Utf8(b64: string): string {
  const cleaned = b64.replace(/\n/g, "");
  const binary = Buffer.from(cleaned, "base64");
  return binary.toString("utf8");
}

export function encodeUtf8Base64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}
