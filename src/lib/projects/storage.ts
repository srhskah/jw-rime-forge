import type { Project } from "@/types";

const STORAGE_KEY = "rime-forge-projects-v1";

export function loadProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Project[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function upsertProject(project: Project): Project[] {
  const all = loadProjects();
  const idx = all.findIndex((p) => p.id === project.id);
  if (idx >= 0) all[idx] = project;
  else all.push(project);
  saveProjects(all);
  return all;
}

export function deleteProject(id: string): Project[] {
  const all = loadProjects().filter((p) => p.id !== id);
  saveProjects(all);
  return all;
}

export function getProject(id: string): Project | null {
  return loadProjects().find((p) => p.id === id) ?? null;
}

export function createProjectId(): string {
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
