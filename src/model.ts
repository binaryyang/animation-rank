import { z } from "zod";
export const tiers = [
  "夯",
  "顶级",
  "人上上",
  "NPC",
  "拉完了",
  "无关心",
] as const;
export const animeSchema = z
  .object({
    id: z.string(),
    bangumiId: z.number().int().positive().optional(),
    name: z.string().min(1),
    original: z.string().default(""),
    summary: z.string().default(""),
    date: z.string().default(""),
    cover: z.string().default(""),
  })
  .transform((anime) =>
    anime.bangumiId ? { ...anime, id: `bgm:${anime.bangumiId}` } : anime,
  );
export const entrySchema = z.object({
  anime: animeSchema,
  tier: z.number().int().min(0).max(5).nullable(),
});
export const taskSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  entries: z.array(entrySchema),
  createdAt: z.string(),
});
export const stateSchema = z.object({
  version: z.literal(1),
  tasks: z.array(taskSchema),
  activeId: z.string().nullable(),
});
export const exportSchema = z.object({
  version: z.literal(1),
  task: taskSchema,
});
export type Anime = z.infer<typeof animeSchema>;
export type Task = z.infer<typeof taskSchema>;
export type State = z.infer<typeof stateSchema>;
export const emptyState: State = { version: 1, tasks: [], activeId: null };
export function createTask(name: string): Task {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    entries: [],
    createdAt: new Date().toISOString(),
  };
}
export function moveEntry(
  task: Task,
  id: string,
  tier: number | null,
  before?: string,
): Task {
  const entry = task.entries.find((e) => e.anime.id === id);
  if (!entry) return task;
  const entries = task.entries.filter((e) => e.anime.id !== id);
  const index = before ? entries.findIndex((e) => e.anime.id === before) : -1;
  entries.splice(index < 0 ? entries.length : index, 0, { ...entry, tier });
  return { ...task, entries };
}
export function addAnime(task: Task, anime: Anime[]): Task {
  const seen = new Set(task.entries.map((e) => e.anime.id));
  return {
    ...task,
    entries: [
      ...task.entries,
      ...anime
        .filter((a) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        })
        .map((a) => ({ anime: a, tier: null })),
    ],
  };
}
export type Query = {
  mode: "search" | "season" | "collection";
  keyword: string;
  offset: number;
  year?: number;
  quarter?: number;
  status?: number;
};
export type Page = { items: Anime[]; total: number };
export interface DesktopAPI {
  load(): Promise<{ state: State; warning?: string }>;
  save(state: State): Promise<void>;
  query(q: Query): Promise<Page>;
  cache(anime: Anime[]): Promise<Anime[]>;
  pickCover(): Promise<string | null>;
  exportTask(task: Task): Promise<boolean>;
  importTask(): Promise<Task | null>;
  exportImages(images: string[]): Promise<boolean>;
  openSubject(id: number): Promise<void>;
}
