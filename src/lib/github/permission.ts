import { githubFetch } from "./client";
import type { WritePermission } from "@/types";

const WRITE_LEVELS = new Set<WritePermission>(["admin", "maintain", "write"]);

export type PermissionResult = {
  permission: WritePermission;
  canWrite: boolean;
};

/**
 * ALWAYS call this at every write entrypoint — never trust the frontend.
 * GET /repos/{owner}/{repo}/collaborators/{username}/permission
 */
export async function checkWritePermission(opts: {
  owner: string;
  repo: string;
  username: string;
  token: string;
}): Promise<PermissionResult> {
  const data = await githubFetch<{ permission: WritePermission }>(
    `/repos/${opts.owner}/${opts.repo}/collaborators/${encodeURIComponent(opts.username)}/permission`,
    { token: opts.token }
  );
  const permission = data.permission ?? "none";
  return {
    permission,
    canWrite: WRITE_LEVELS.has(permission),
  };
}

export function isWritePermission(p: WritePermission): boolean {
  return WRITE_LEVELS.has(p);
}
