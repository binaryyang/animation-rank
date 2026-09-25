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
  preferences: z
    .object({
      sidebarCollapsed: z.boolean().default(false),
      showNames: z.boolean().default(false),
    })
    .default({}),
});
export const exportSchema = z.object({
  version: z.literal(1),
  task: taskSchema,
});
export type Anime = z.infer<typeof animeSchema>;
export type Task = z.infer<typeof taskSchema>;
export type State = z.infer<typeof stateSchema>;
export const emptyState: State = stateSchema.parse({
  version: 1,
  tasks: [],
  activeId: null,
});
export function createTask(name: string): Task {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    entries: [],
    createdAt: new Date().toISOString(),
  };
}
export function mapTask(
  state: State,
  id: string,
  fn: (t: Task) => Task,
): State {
  return {
    ...state,
    tasks: state.tasks.map((t) => (t.id === id ? fn(t) : t)),
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
export function removeEntries(task: Task, ids: string[]): Task {
  const set = new Set(ids);
  return { ...task, entries: task.entries.filter((e) => !set.has(e.anime.id)) };
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
export type Snapshot = {
  tasks: Task[];
  activeId: string | null;
  label: string;
  focus?: string;
};
export type History = { past: Snapshot[]; future: Snapshot[] };
export const emptyHistory: History = { past: [], future: [] };
const historyLimit = 100;
const snapshot = (
  state: State,
  { label, focus }: Pick<Snapshot, "label" | "focus">,
): Snapshot => ({ tasks: state.tasks, activeId: state.activeId, label, focus });
const restore = (state: State, s: Snapshot): State => ({
  ...state,
  tasks: s.tasks,
  activeId:
    s.focus && s.tasks.some((t) => t.id === s.focus) ? s.focus : s.activeId,
});
export function record(
  history: History,
  state: State,
  label: string,
  focus?: string,
): History {
  return {
    past: [...history.past, snapshot(state, { label, focus })].slice(
      -historyLimit,
    ),
    future: [],
  };
}
export function undo(history: History, state: State) {
  const last = history.past.at(-1);
  if (!last) return null;
  return {
    label: last.label,
    state: restore(state, last),
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, snapshot(state, last)],
    },
  };
}
export function redo(history: History, state: State) {
  const next = history.future.at(-1);
  if (!next) return null;
  return {
    label: next.label,
    state: restore(state, next),
    history: {
      past: [...history.past, snapshot(state, next)],
      future: history.future.slice(0, -1),
    },
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
