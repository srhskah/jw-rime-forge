import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkWritePermission } from "@/lib/github/permission";
import { atomicCommit, buildCommitMessage } from "@/lib/github/commit";
import { GitHubApiError } from "@/lib/github/client";
import { validateSchemaYaml } from "@/lib/rime/schema";
import { validateDictYaml } from "@/lib/rime/serialize-dict";
import type { FileChange } from "@/types";

export const runtime = "nodejs";

type Body = {
  owner: string;
  repo: string;
  branch: string;
  changes: FileChange[];
  message?: string;
  meta?: {
    schemaChanged?: boolean;
    schemaHints?: string[];
    dictAdded?: number;
    dictRemoved?: number;
    dictModified?: number;
    dictExpectedEntries?: number;
  };
};

/**
 * Write entrypoint — ALWAYS re-checks collaborator permission server-side.
 * Uses Git Data API for a single atomic commit (never Contents API multi-file).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.accessToken || !session.login) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const { owner, repo, branch, changes, meta } = body;
  if (!owner || !repo || !branch || !Array.isArray(changes) || !changes.length) {
    return NextResponse.json({ error: "缺少必要字段" }, { status: 400 });
  }

  // Independent auth — never trust frontend canWrite flag
  try {
    const perm = await checkWritePermission({
      owner,
      repo,
      username: session.login,
      token: session.accessToken,
    });
    if (!perm.canWrite) {
      return NextResponse.json(
        {
          error: "你对该仓库只有只读权限",
          permission: perm.permission,
        },
        { status: 403 }
      );
    }
  } catch (e) {
    if (e instanceof GitHubApiError) {
      return NextResponse.json(
        { error: e.message, rateLimited: e.rateLimited },
        { status: e.status === 404 ? 403 : e.status }
      );
    }
    throw e;
  }

  // Round-trip validation before commit
  for (const change of changes) {
    const lower = change.path.toLowerCase();
    if (lower.endsWith(".schema.yaml") || lower.endsWith(".schema.yml")) {
      const v = validateSchemaYaml(change.content);
      if (!v.ok) {
        return NextResponse.json({ error: v.error }, { status: 400 });
      }
    }
    if (lower.endsWith(".dict.yaml") || lower.endsWith(".dict.yml")) {
      const expected =
        typeof meta?.dictExpectedEntries === "number"
          ? meta.dictExpectedEntries
          : -1;
      const v = validateDictYaml(change.content, expected);
      if (!v.ok) {
        return NextResponse.json({ error: v.error }, { status: 400 });
      }
    }
  }

  const message =
    body.message ||
    buildCommitMessage({
      schemaChanged: meta?.schemaChanged,
      schemaHints: meta?.schemaHints,
      dictAdded: meta?.dictAdded,
      dictRemoved: meta?.dictRemoved,
      dictModified: meta?.dictModified,
    });

  try {
    const result = await atomicCommit({
      owner,
      repo,
      branch,
      message,
      changes,
      token: session.accessToken,
    });
    return NextResponse.json({ ok: true, ...result, message });
  } catch (e) {
    if (e instanceof GitHubApiError) {
      return NextResponse.json(
        { error: e.message, rateLimited: e.rateLimited },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "提交失败" },
      { status: 500 }
    );
  }
}
