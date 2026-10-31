"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { DownloadButtons } from "@/components/repo/DownloadButtons";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { Redo2, Save, Undo2 } from "lucide-react";

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
  const {
    present: schemaCurrent,
    set: setSchemaCurrent,
    reset: resetSchema,
    undo: undoSchema,
    redo: redoSchema,
    canUndo: canUndoSchema,
    canRedo: canRedoSchema,
  } = useUndoRedo("");
  const [schemaSha, setSchemaSha] = useState<string | undefined>();
  const [schemaHints, setSchemaHints] = useState<string[]>([]);

  const [dict, setDict] = useState<DictState | null>(null);
  const {
    present: dictEntries,
    set: setDictEntries,
    reset: resetDictEntries,
    undo: undoDict,
    redo: redoDict,
    canUndo: canUndoDict,
    canRedo: canRedoDict,
  } = useUndoRedo<DictEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; rateLimited?: boolean } | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [initOpen, setInitOpen] = useState(false);
  const [schemaId, setSchemaId] = useState("my_schema");
  const [schemaName, setSchemaName] = useState("我的方案");
  const [activeTab, setActiveTab] = useState<"dict" | "schema">("dict");
  const [dictDirty, setDictDirty] = useState(false);
  const [dictCurrentRaw, setDictCurrentRaw] = useState("");
  const dictTypingBurst = useRef(false);
  const dictTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    setDictDirty(false);
    setDictCurrentRaw("");
    try {
      const [permRes, filesRes] = await Promise.all([
        fetch(
          `/api/github/permission?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
        ),
        fetch(
          `/api/github/repo/${owner}/${repo}/files?branch=${encodeURIComponent(branch)}`
        ),
      ]);
      const permData = await permRes.json();
      if (permRes.ok) {
        setCanWrite(Boolean(permData.canWrite));
        setPermission(permData.permission || "");
      } else {
        setCanWrite(false);
      }

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

      const contentFetches: Promise<void>[] = [];

      if (sPath) {
        contentFetches.push(
          (async () => {
            const res = await fetch(
              `/api/github/repo/${owner}/${repo}/content?path=${encodeURIComponent(sPath)}&ref=${encodeURIComponent(branch)}`
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "读取 schema 失败");
            setSchemaOriginal(data.raw);
            resetSchema(data.raw);
            setSchemaHints([]);
            setSchemaSha(data.sha);
          })()
        );
      } else {
        setSchemaOriginal("");
        resetSchema("");
        setSchemaHints([]);
        setSchemaSha(undefined);
      }

      if (dPath) {
        contentFetches.push(
          (async () => {
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
            resetDictEntries(data.entries);
            setDictCurrentRaw(data.raw);
            setDictDirty(false);
          })()
        );
      } else {
        setDict(null);
        resetDictEntries([]);
        setDictCurrentRaw("");
        setDictDirty(false);
      }

      await Promise.all(contentFetches);
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "加载失败" });
    } finally {
      setLoading(false);
    }
  }, [owner, repo, branch, resetSchema, resetDictEntries]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Prefer dict tab; fall back to schema when dict is absent
    if (dict) setActiveTab("dict");
    else if (schemaPath) setActiveTab("schema");
  }, [dict, schemaPath]);

  /** Rebuild YAML only when needed (diff / download / save) — not on every keystroke. */
  const ensureDictRaw = useCallback(
    (entries: DictEntry[] = dictEntries) => {
      if (!dict) return "";
      const raw = rebuildDictYaml(dict.headerRaw, entries, dict.columns);
      setDictCurrentRaw(raw);
      return raw;
    },
    [dict, dictEntries]
  );

  function onDictEntriesChange(next: DictEntry[]) {
    setDictDirty(true);
    // Coalesce undo history while typing so we don't clone 万条数组上百次
    const record = !dictTypingBurst.current;
    dictTypingBurst.current = true;
    setDictEntries(next, record);
    if (dictTypingTimer.current) clearTimeout(dictTypingTimer.current);
    dictTypingTimer.current = setTimeout(() => {
      dictTypingBurst.current = false;
    }, 450);
  }

  const schemaChanged = schemaCurrent !== schemaOriginal;
  const dictChanged = Boolean(dict) && dictDirty;
  const dirty = schemaChanged || dictChanged;
  const readOnly = canWrite === false;

  const canUndo = activeTab === "schema" ? canUndoSchema : canUndoDict;
  const canRedo = activeTab === "schema" ? canRedoSchema : canRedoDict;

  const dictStats = useMemo(() => {
    if (!dict) return { added: 0, removed: 0, modified: 0 };
    const before = dict.entries;
    const after = dictEntries;
    const removed = Math.max(0, before.length - after.length);
    const added = Math.max(0, after.length - before.length);
    // Skip O(n) field scan on large dicts — commit message still gets add/remove
    if (before.length > 3000 || after.length > 3000) {
      return { added, removed, modified: 0 };
    }
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

  function handleUndo() {
    if (readOnly) return;
    if (activeTab === "schema") undoSchema();
    else {
      undoDict();
      setDictDirty(true);
    }
  }

  function handleRedo() {
    if (readOnly) return;
    if (activeTab === "schema") redoSchema();
    else {
      redoDict();
      setDictDirty(true);
    }
  }

  function openDiff() {
    if (dictChanged && dict) ensureDictRaw();
    setShowDiff(true);
  }

  const undoRedoRef = useRef({ handleUndo, handleRedo, readOnly, showDiff });
  undoRedoRef.current = { handleUndo, handleRedo, readOnly, showDiff };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const ctx = undoRedoRef.current;
      if (ctx.readOnly || ctx.showDiff) return;
      if (!(e.ctrlKey || e.metaKey) || e.isComposing) return;
      // Leave native undo to schema free-edit textarea (local draft until blur)
      if ((e.target as HTMLElement | null)?.tagName === "TEXTAREA") return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        ctx.handleUndo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        ctx.handleRedo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
        const raw = ensureDictRaw();
        changes.push({
          path: dict.path,
          content: raw,
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
    <div className="relative flex flex-col gap-5 pb-36 md:pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {owner}/{repo}
          </h2>
          <p className="text-xs text-zinc-500">
            分支 {branch}
            {permission ? ` · 权限 ${permission}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DownloadButtons
            schemaPath={schemaPath}
            schemaRaw={schemaPath ? schemaCurrent : null}
            dictPath={dict?.path ?? null}
            dictRaw={dict ? dictCurrentRaw : null}
            getDictRaw={
              dict
                ? () => ensureDictRaw()
                : undefined
            }
          />
          {!readOnly ? (
            <>
              <button
                type="button"
                disabled={!canUndo}
                onClick={handleUndo}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                title="撤销（Ctrl/⌘+Z）"
              >
                <Undo2 className="h-3.5 w-3.5" />
                撤销
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={handleRedo}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                title="重做（Ctrl/⌘+Y 或 Ctrl/⌘+Shift+Z）"
              >
                <Redo2 className="h-3.5 w-3.5" />
                重做
              </button>
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={openDiff}
                className="hidden items-center gap-1.5 rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40 md:inline-flex"
              >
                <Save className="h-4 w-4" />
                保存并提交
              </button>
            </>
          ) : null}
        </div>
      </div>

      {readOnly ? <ReadOnlyBanner /> : null}
      {saveMsg ? (
        <p className="text-sm text-teal-700 dark:text-teal-300">{saveMsg}</p>
      ) : null}

      {schemaPath || dict ? (
        <div className="flex flex-col gap-3">
          <div
            role="tablist"
            aria-label="方案文件"
            className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800"
          >
            {dict ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "dict"}
                onClick={() => setActiveTab("dict")}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                  activeTab === "dict"
                    ? "border-teal-600 text-teal-700 dark:text-teal-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                dict.yaml
                {dictChanged ? (
                  <span className="ml-1 text-amber-600" aria-hidden>
                    ·
                  </span>
                ) : null}
              </button>
            ) : null}
            {schemaPath ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "schema"}
                onClick={() => setActiveTab("schema")}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                  activeTab === "schema"
                    ? "border-teal-600 text-teal-700 dark:text-teal-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                schema.yaml
                {schemaChanged ? (
                  <span className="ml-1 text-amber-600" aria-hidden>
                    ·
                  </span>
                ) : null}
              </button>
            ) : null}
          </div>

          {activeTab === "dict" && dict ? (
            <section className="flex flex-col gap-3" role="tabpanel">
              <p className="text-xs text-zinc-500">{dict.path}</p>
              <DictEditor
                entries={dictEntries}
                columns={dict.columns}
                disabled={readOnly}
                largeWarning={dict.largeWarning}
                onChange={onDictEntriesChange}
              />
            </section>
          ) : null}

          {activeTab === "schema" && schemaPath ? (
            <section className="flex flex-col gap-3" role="tabpanel">
              <p className="text-xs text-zinc-500">{schemaPath}</p>
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
        </div>
      ) : null}

      {/* Mobile fixed save bar above safe area */}
      {!readOnly ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden">
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              disabled={!canUndo}
              onClick={handleUndo}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-300 py-2.5 text-sm disabled:opacity-40 dark:border-zinc-600"
            >
              <Undo2 className="h-4 w-4" />
              撤销
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={handleRedo}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-300 py-2.5 text-sm disabled:opacity-40 dark:border-zinc-600"
            >
              <Redo2 className="h-4 w-4" />
              重做
            </button>
          </div>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={openDiff}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            <Save className="h-4 w-4" />
            保存并提交
          </button>
        </div>
      ) : null}

      {showDiff ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
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
