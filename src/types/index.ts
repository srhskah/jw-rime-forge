export type DictEntry = {
  text: string;
  code?: string;
  weight?: string;
};

export type RimeFilePair = {
  schemaPath: string | null;
  dictPath: string | null;
  schemaRaw: string | null;
  dictRaw: string | null;
  dictHeaderRaw: string | null;
  dictEntries: DictEntry[];
  dictColumns: string[];
};

export type ProjectRepo = {
  owner: string;
  repo: string;
  branch: string;
};

export type Project = {
  id: string;
  name: string;
  repos: ProjectRepo[];
};

export type GitHubRepoCard = {
  id: number;
  full_name: string;
  owner: string;
  name: string;
  description: string | null;
  stargazers_count: number;
  html_url: string;
  default_branch: string;
  private?: boolean;
  updated_at?: string;
};

export type DiscoveredRimeFile = {
  path: string;
  type: "schema" | "dict";
  size: number;
  sha: string;
};

export type SessionUser = {
  login: string;
  name: string | null;
  avatarUrl: string | null;
};

export type WritePermission = "admin" | "maintain" | "write" | "triage" | "read" | "none";

export type FileChange = {
  path: string;
  content: string;
  /** Current blob SHA for optimistic locking; omit for new files */
  baseSha?: string;
};

export type CommitRequest = {
  owner: string;
  repo: string;
  branch: string;
  message: string;
  changes: FileChange[];
};

export type SchemaFieldPath =
  | "menu/page_size"
  | "translator/enable_completion"
  | "translator/enable_sentence"
  | "translator/enable_user_dict"
  | "speller/max_code_length"
  | "speller/auto_select";
