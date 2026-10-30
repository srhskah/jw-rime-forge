import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkWritePermission } from "@/lib/github/permission";
import { initFilesViaContentsApi, isEmptyOrNearEmptyRepo } from "@/lib/github/init";
import { GitHubApiError } from "@/lib/github/client";
import { createSchemaTemplate, createDictTemplate } from "@/lib/rime/templates";
import { validateSchemaYaml } from "@/lib/rime/schema";
import { validateDictYaml } from "@/lib/rime/serialize-dict";

export const runtime = "nodejs";

type Body = {
  owner: string;
  repo: string;
  branch: string;
  schemaId: string;
  name: string;
  schemaPath?: string;
  dictPath?: string;
};

/**
 * Bootstrap empty repos via Contents API (Git Data API returns 409).
 * Permission is re-checked server-side on every write.
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

  const { owner, repo, branch, schemaId, name } = body;
  if (!owner || !repo || !branch || !schemaId || !name) {
    return NextResponse.json({ error: "缺少必要字段" }, { status: 400 });
  }

  try {
    const perm = await checkWritePermission({
      owner,
      repo,
      username: session.login,
      token: session.accessToken,
    });
    if (!perm.canWrite) {
      return NextResponse.json(
        { error: "你对该仓库只有只读权限", permission: perm.permission },
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

  const emptiness = await isEmptyOrNearEmptyRepo({
    owner,
    repo,
    token: session.accessToken,
  });

  const schemaPath = body.schemaPath || `${schemaId}.schema.yaml`;
  const dictPath = body.dictPath || `${schemaId}.dict.yaml`;
  const schemaContent = createSchemaTemplate({ schemaId, name, dictName: schemaId });
  const dictContent = createDictTemplate({ name: schemaId });

  const sv = validateSchemaYaml(schemaContent);
  if (!sv.ok) return NextResponse.json({ error: sv.error }, { status: 400 });
  const dv = validateDictYaml(dictContent, 0);
  if (!dv.ok) return NextResponse.json({ error: dv.error }, { status: 400 });

  try {
    // Prefer Contents API when empty; also allow bootstrap when user explicitly inits
    if (!emptiness.empty) {
      // Still allow Contents API create for missing files on near-empty repos
    }

    const result = await initFilesViaContentsApi({
      owner,
      repo,
      branch,
      token: session.accessToken,
      message: "web: initialize schema.yaml and dict.yaml",
      files: [
        { path: schemaPath, content: schemaContent },
        { path: dictPath, content: dictContent },
      ],
    });

    return NextResponse.json({
      ok: true,
      empty: emptiness.empty,
      schemaPath,
      dictPath,
      results: result.results,
    });
  } catch (e) {
    if (e instanceof GitHubApiError) {
      return NextResponse.json(
        { error: e.message, rateLimited: e.rateLimited },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "初始化失败" },
      { status: 500 }
    );
  }
}
