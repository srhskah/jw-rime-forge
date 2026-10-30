/**
 * Resolve token for GitHub API calls.
 * Prefer the logged-in user's OAuth token; otherwise fall back to a
 * server-side PAT so anonymous browse/search shares a 5k/hr budget
 * instead of the unauthenticated 60/hr IP limit.
 *
 * Create a classic PAT (public_repo / read-only) or fine-grained token
 * with public repository read, set as GITHUB_TOKEN in .env / Vercel.
 */
export function resolveGitHubToken(userToken?: string | null): string | null {
  if (userToken) return userToken;
  return (
    process.env.GITHUB_TOKEN ||
    process.env.GITHUB_SEARCH_TOKEN ||
    null
  );
}
