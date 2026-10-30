"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DictEntry, DiscoveredRimeFile } from "@/types";
import { SchemaEditor } from "./SchemaEditor";
import { DictEditor } from "./DictEditor";
import { DiffPreview } from "./DiffPreview";
import { rebuildDictYaml } from "@/lib/rime/serialize-dict";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ReadOnlyBanner,
} from "@/components/ui/States";
import { Save } from "lucide-react";

type DictState = {
  path: string;
  sha: string;
  raw: string;
  headerRaw: string;
  entries: DictEntry[];
  columns: string[];
  largeWarning: string | null;
};

export function RepoEditorPanel({
  owner,
  repo,
  branch,
}: {
  owner: string;
  repo: string;
  branch: string;
}) {
  const [canWrite, setCanWrite] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<string>("");
  const [files, setFiles] = useState<DiscoveredRimeFile[]>([]);
  const [schemaPath, setSchemaPath] = useState<string | null>(null);

  const [schemaOriginal, setSchemaOriginal] = useState("");
  const [schemaCurrent, setSchemaCurrent] = useState("");
  const [schemaSha, setSchemaSha] = useState<string | undefined>();
  const [schemaHints, setSchemaHints] = useState<string[]>([]);

  const [dict, setDict] = useState<DictState | null>(null);
  const [dictEntries, setDictEntries] = useState<DictEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; rateLimited?: boolean } | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [initOpen, setInitOpen] = useState(false);
  const [schemaId, setSchemaId] = useState("my_schema");
  const [schemaName, setSchemaName] = useState("我的方案");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    try {
      const permRes = await fetch(
        `/api/github/permission?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
      );
      const permData = await permRes.json();
      if (permRes.ok) {
        setCanWrite(Boolean(permData.canWrite));
        setPermission(permData.permission || "");
      } else {
        setCanWrite(false);
      }

      const filesRes = await fetch(
        `/api/github/repo/${owner}/${repo}/files?branch=${encodeURIComponent(branch)}`
      );
      const filesData = await filesRes.json();
      if (!filesRes.ok) {
        if (filesRes.status === 409 || String(filesData.error || "").includes("empty")) {
          setFiles([]);
          setInitOpen(true);
          return;
        }
        setError({
          message: filesData.error || "加载失败",
          rateLimited: filesData.rateLimited,
        });
        return;
      }

      const discovered: DiscoveredRimeFile[] = filesData.files || [];
      setFiles(discovered);
      if (!discovered.length) {
        setInitOpen(true);
        return;
      }

      const sPath =
        discovered.find((f) => f.type === "schema")?.path ?? null;
      const dPath = discovered.find((f) => f.type === "dict")?.path ?? null;
      setSchemaPath(sPath);

      if (sPath) {
        const res = await fetch(
          `/api/github/repo/${owner}/${repo}/content?path=${encodeURIComponent(sPath)}&ref=${encodeURIComponent(branch)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "读取 schema 失败");
        setSchemaOriginal(data.raw);
        setSchemaCurrent(data.raw);
        setSchemaSha(data.sha);
      }

      if (dPath) {
        const res = await fetch(
          `/api/github/repo/${owner}/${repo}/content?path=${encodeURIComponent(dPath)}&ref=${encodeURIComponent(branch)}&parse=dict`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "读取 dict 失败");
        const state: DictState = {
          path: dPath,
          sha: data.sha,
          raw: data.raw,
          headerRaw: data.headerRaw,
          entries: data.entries,
          columns: data.columns,
          largeWarning: data.largeWarning,
        };
        setDict(state);
        setDictEntries(data.entries);
      }
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "加载失败" });
    } finally {
      setLoading(false);
    }
  }, [owner, repo, branch]);

  useEffect(() => {
    load();
  }, [load]);

  const dictCurrentRaw = useMemo(() => {
    if (!dict) return "";
    return rebuildDictYaml(dict.headerRaw, dictEntries, dict.columns);
  }, [dict, dictEntries]);

  const schemaChanged = schemaCurrent !== schemaOriginal;
  const dictChanged = dict ? dictCurrentRaw !== dict.raw : false;
  const dirty = schemaChanged || dictChanged;
  const readOnly = canWrite === false;

  const dictStats = useMemo(() => {
    if (!dict) return { added: 0, removed: 0, modified: 0 };
    const before = dict.entries;
    const after = dictEntries;
    const removed = Math.max(0, before.length - after.length);
    const added = Math.max(0, after.length - before.length);
    let modified = 0;
    const n = Math.min(before.length, after.length);
    for (let i = 0; i < n; i++) {
      if (
        before[i].text !== after[i].text ||
        before[i].code !== after[i].code ||
        before[i].weight !== after[i].weight
      ) {
        modified += 1;
      }
    }
    return { added, removed, modified };
  }, [dict, dictEntries]);

  async function confirmSave() {
    if (!dirty || readOnly) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const changes: Array<{ path: string; content: string; baseSha?: string }> = [];
      if (schemaChanged && schemaPath) {
        changes.push({
          path: schemaPath,
          content: schemaCurrent,
          baseSha: schemaSha,
        });
      }
      if (dictChanged && dict) {
        changes.push({
          path: dict.path,
          content: dictCurrentRaw,
          baseSha: dict.sha,
        });
      }

      const res = await fetch("/api/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          branch,
          changes,
          meta: {
            schemaChanged,
            schemaHints,
            dictAdded: dictStats.added,
            dictRemoved: dictStats.removed,
            dictModified: dictStats.modified,
            dictExpectedEntries: dictChanged ? dictEntries.length : undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMsg(data.error || "提交失败");
        return;
      }
      setShowDiff(false);
      setSaveMsg(`已提交 ${data.commitSha?.slice(0, 7)} — ${data.message}`);
      await load();
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSaving(false);
    }
  }

  async function doInit() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          branch,
          schemaId,
          name: schemaName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMsg(data.error || "初始化失败");
        return;
      }
      setInitOpen(false);
      setSaveMsg("已从零创建 schema.yaml 与 dict.yaml");
      await load();
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "初始化失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label={`加载 ${owner}/${repo}…`} />;
  if (error) return <ErrorState message={error.message} rateLimited={error.rateLimited} />;

  if (initOpen && !files.length) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <EmptyState
          title="仓库中没有 Rime 文件"
          description="检测到空仓库或尚无方案文件。可从零创建最小 schema.yaml + dict.yaml（空仓库走 Contents API 初始化）。"
        />
        {readOnly ? <ReadOnlyBanner /> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-zinc-500">schema_id</span>
            <input
              value={schemaId}
              disabled={readOnly}
              onChange={(e) => setSchemaId(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-zinc-500">方案名称</span>
            <input
              value={schemaName}
              disabled={readOnly}
              onChange={(e) => setSchemaName(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={readOnly || saving}
          onClick={doInit}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? "创建中…" : "从零创建两个 YAML"}
        </button>
        {saveMsg ? <p className="text-sm text-zinc-600 dark:text-zinc-300">{saveMsg}</p> : null}
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-5 pb-24 md:pb-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {owner}/{repo}
          </h2>
          <p className="text-xs text-zinc-500">
            分支 {branch}
            {permission ? ` · 权限 ${permission}` : ""}
          </p>
        </div>
        {!readOnly ? (
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => setShowDiff(true)}
            className="hidden items-center gap-1.5 rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40 md:inline-flex"
          >
            <Save className="h-4 w-4" />
            保存并提交
          </button>
        ) : null}
      </div>

      {readOnly ? <ReadOnlyBanner /> : null}
      {saveMsg ? (
        <p className="text-sm text-teal-700 dark:text-teal-300">{saveMsg}</p>
      ) : null}

      {schemaPath ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            schema.yaml · {schemaPath}
          </h3>
          <SchemaEditor
            raw={schemaCurrent}
            disabled={readOnly}
            onChange={(next, hints) => {
              setSchemaCurrent(next);
              setSchemaHints(hints);
            }}
          />
        </section>
      ) : null}

      {dict ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            dict.yaml · {dict.path}
          </h3>
          <DictEditor
            entries={dictEntries}
            columns={dict.columns}
            disabled={readOnly}
            largeWarning={dict.largeWarning}
            onChange={setDictEntries}
          />
        </section>
      ) : null}

      {/* Mobile fixed save bar above safe area */}
      {!readOnly ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => setShowDiff(true)}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            <Save className="h-4 w-4" />
            保存并提交
          </button>
        </div>
      ) : null}

      {showDiff ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-4 shadow-xl dark:bg-zinc-900">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              提交前 Diff 预览
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              确认变更后将通过 Git Data API 生成单次原子 commit。
            </p>
            <div className="mt-4">
              <DiffPreview
                files={[
                  ...(schemaChanged && schemaPath
                    ? [
                        {
                          path: schemaPath,
                          before: schemaOriginal,
                          after: schemaCurrent,
                        },
                      ]
                    : []),
                  ...(dictChanged && dict
                    ? [
                        {
                          path: dict.path,
                          before: dict.raw,
                          after: dictCurrentRaw,
                        },
                      ]
                    : []),
                ]}
              />
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDiff(false)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
              >
                取消
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmSave}
                className="rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? "提交中…" : "确认提交"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
