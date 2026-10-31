"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { DictEntry, DiscoveredRimeFile } from "@/types";
import { filterEntries } from "@/lib/rime/parse-dict";
import { CopyPathButton } from "./CopyPathButton";
import { DownloadButtons } from "./DownloadButtons";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

type DictPayload = {
  path: string;
  sha: string;
  raw: string;
  headerRaw: string;
  entries: DictEntry[];
  columns: string[];
  name: string | null;
  sort: string | null;
  largeWarning: string | null;
};

export function SchemaBrowser({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const [files, setFiles] = useState<DiscoveredRimeFile[]>([]);
  const [branch, setBranch] = useState("main");
  const [truncated, setTruncated] = useState(false);
  const [schemaPath, setSchemaPath] = useState<string | null>(null);
  const [dictPath, setDictPath] = useState<string | null>(null);
  const [schemaRaw, setSchemaRaw] = useState<string | null>(null);
  const [dict, setDict] = useState<DictPayload | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [error, setError] = useState<{ message: string; rateLimited?: boolean } | null>(null);

  const schemas = useMemo(
    () => files.filter((f) => f.type === "schema"),
    [files]
  );
  const dicts = useMemo(() => files.filter((f) => f.type === "dict"), [files]);

  const filtered = useMemo(
    () => filterEntries(dict?.entries ?? [], query),
    [dict, query]
  );

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/github/repo/${owner}/${repo}/files`);
      const data = await res.json();
      if (!res.ok) {
        setError({ message: data.error || "发现文件失败", rateLimited: data.rateLimited });
        return;
      }
      setFiles(data.files || []);
      setBranch(data.branch || "main");
      setTruncated(Boolean(data.truncated));
      const firstSchema =
        (data.files as DiscoveredRimeFile[]).find((f) => f.type === "schema")?.path ?? null;
      const firstDict =
        (data.files as DiscoveredRimeFile[]).find((f) => f.type === "dict")?.path ?? null;
      setSchemaPath(firstSchema);
      setDictPath(firstDict);
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "网络错误" });
    } finally {
      setLoading(false);
    }
  }, [owner, repo]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!schemaPath && !dictPath) {
        setSchemaRaw(null);
        setDict(null);
        return;
      }
      setLoadingFile(true);
      try {
        if (schemaPath) {
          const res = await fetch(
            `/api/github/repo/${owner}/${repo}/content?path=${encodeURIComponent(schemaPath)}&ref=${encodeURIComponent(branch)}`
          );
          const data = await res.json();
          if (!cancelled) {
            if (!res.ok) throw new Error(data.error || "读取 schema 失败");
            setSchemaRaw(data.raw);
          }
        } else if (!cancelled) {
          setSchemaRaw(null);
        }

        if (dictPath) {
          const res = await fetch(
            `/api/github/repo/${owner}/${repo}/content?path=${encodeURIComponent(dictPath)}&ref=${encodeURIComponent(branch)}&parse=dict`
          );
          const data = await res.json();
          if (!cancelled) {
            if (!res.ok) throw new Error(data.error || "读取 dict 失败");
            setDict(data as DictPayload);
          }
        } else if (!cancelled) {
          setDict(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError({ message: e instanceof Error ? e.message : "读取失败" });
        }
      } finally {
        if (!cancelled) setLoadingFile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, repo, schemaPath, dictPath, branch]);

  if (loading) return <LoadingState label="正在发现方案文件…" />;
  if (error) return <ErrorState message={error.message} rateLimited={error.rateLimited} />;

  if (!files.length) {
    return (
      <EmptyState
        title="未发现 Rime 方案文件"
        description="此仓库中没有找到 *.schema.yaml 或 *.dict.yaml。登录后可在工作区从零创建，或换一个方案仓库浏览。"
      />
    );
  }

  const columns = dict?.columns?.length ? dict.columns : ["text", "code", "weight"];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {owner}/{repo}
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            分支 {branch}
            {truncated ? " · 文件列表已截断（深度/数量上限）" : ""}
            {" · 匿名只读"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyPathButton owner={owner} repo={repo} />
          <DownloadButtons
            schemaPath={schemaPath}
            schemaRaw={schemaRaw}
            dictPath={dictPath}
            dictRaw={dict?.raw ?? null}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500">schema.yaml</span>
          <select
            value={schemaPath ?? ""}
            onChange={(e) => setSchemaPath(e.target.value || null)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          >
            <option value="">（无）</option>
            {schemas.map((f) => (
              <option key={f.path} value={f.path}>
                {f.path}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500">dict.yaml</span>
          <select
            value={dictPath ?? ""}
            onChange={(e) => setDictPath(e.target.value || null)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          >
            <option value="">（无）</option>
            {dicts.map((f) => (
              <option key={f.path} value={f.path}>
                {f.path}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadingFile ? <LoadingState label="正在加载 YAML…" /> : null}

      {dict?.largeWarning ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {dict.largeWarning}
        </div>
      ) : null}

      {dict ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                词条浏览
              </h2>
              <p className="text-xs text-zinc-500">
                {dict.name ? `词典 ${dict.name}` : "词典"}
                {dict.sort ? ` · sort: ${dict.sort}` : ""}
                {" · "}
                {dict.entries.length.toLocaleString()} 条
                {query ? ` · 过滤后 ${filtered.length.toLocaleString()} 条` : ""}
              </p>
            </div>
            <label className="relative block w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索 text / code…"
                className="w-full rounded-md border border-zinc-300 bg-white py-2 pr-3 pl-9 text-sm outline-none ring-teal-600/30 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
          </div>

          {/* Desktop table / mobile cards */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-700">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="px-2 py-2 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((entry, i) => (
                  <tr
                    key={`${entry.text}-${i}`}
                    className="border-b border-zinc-100 dark:border-zinc-800"
                  >
                    {columns.map((c) => (
                      <td key={c} className="px-2 py-1.5 font-mono text-[13px]">
                        {c === "text"
                          ? entry.text
                          : c === "code"
                            ? entry.code ?? ""
                            : c === "weight"
                              ? entry.weight ?? ""
                              : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 500 ? (
              <p className="mt-2 text-xs text-zinc-500">
                仅展示前 500 条过滤结果（浏览态）。
              </p>
            ) : null}
          </div>

          <ul className="flex flex-col gap-2 md:hidden">
            {filtered.slice(0, 200).map((entry, i) => (
              <li
                key={`${entry.text}-${i}`}
                className="rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
              >
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {entry.text}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500 font-mono">
                  {entry.code !== undefined ? <span>code: {entry.code}</span> : null}
                  {entry.weight !== undefined ? <span>weight: {entry.weight}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {schemaRaw ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            schema.yaml 预览
          </h2>
          <pre className="max-h-80 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed whitespace-pre-wrap dark:border-zinc-800 dark:bg-zinc-900/80">
            {schemaRaw}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
