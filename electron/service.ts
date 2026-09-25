import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  Anime,
  Page,
  Query,
  State,
  Task,
  coverPrefix,
  stateSchema,
} from "../src/model";

export class Store {
  private queue: Promise<void> = Promise.resolve();
  constructor(private dir: string) {}
  flush() {
    return this.queue;
  }
  async load(): Promise<{ state: State; warning?: string }> {
    const file = path.join(this.dir, "state.json");
    try {
      return {
        state: stateSchema.parse(JSON.parse(await fs.readFile(file, "utf8"))),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return {
          state: stateSchema.parse({ version: 1, tasks: [], activeId: null }),
        };
      try {
        return {
          state: stateSchema.parse(
            JSON.parse(await fs.readFile(file + ".bak", "utf8")),
          ),
          warning: "主数据文件异常，已恢复最近备份。",
        };
      } catch {
        throw new Error("数据和备份无法读取。为保护原数据，已停止保存。");
      }
    }
  }
  save(input: State) {
    const state = stateSchema.parse(input);
    const operation = this.queue
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(this.dir, { recursive: true });
        const file = path.join(this.dir, "state.json");
        await fs.writeFile(file + ".tmp", JSON.stringify(state), "utf8");
        try {
          const old = await fs.readFile(file, "utf8");
          stateSchema.parse(JSON.parse(old));
          await fs.writeFile(file + ".bak", old);
        } catch (error) {
          if (
            (error as NodeJS.ErrnoException).code !== "ENOENT" &&
            error instanceof Error &&
            !("issues" in error) &&
            !(error instanceof SyntaxError)
          )
            throw error;
        }
        await fs.rename(file + ".tmp", file);
      });
    this.queue = operation;
    return operation;
  }
}
const signatures: [string, (b: Buffer) => boolean][] = [
  [
    "png",
    (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  ],
  ["jpeg", (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["gif", (b) => b.subarray(0, 3).toString("latin1") === "GIF"],
  [
    "webp",
    (b) =>
      b.subarray(0, 4).toString("latin1") === "RIFF" &&
      b.subarray(8, 12).toString("latin1") === "WEBP",
  ],
];
const coverName = /^[0-9a-f]{64}\.(png|jpeg|gif|webp)$/;
export const maxCoverBytes = 10_000_000;
export class CoverStore {
  constructor(private dir: string) {}
  async put(bytes: Buffer): Promise<string> {
    if (bytes.length > maxCoverBytes) throw new Error("封面不能超过 10 MB");
    const ext = signatures.find(([, test]) => test(bytes))?.[0];
    if (!ext) throw new Error("不支持的图片格式");
    const name = `${createHash("sha256").update(bytes).digest("hex")}.${ext}`;
    await fs.mkdir(this.dir, { recursive: true });
    await fs
      .writeFile(path.join(this.dir, name), bytes, { flag: "wx" })
      .catch((error) => {
        if (error.code !== "EEXIST") throw error;
      });
    return coverPrefix + name;
  }
  resolve(ref: string) {
    if (!ref.startsWith(coverPrefix)) return null;
    const name = ref.slice(coverPrefix.length);
    if (!coverName.test(name)) return null;
    return {
      file: path.join(this.dir, name),
      mime: `image/${name.split(".")[1]}`,
    };
  }
  async exists(ref: string) {
    const target = this.resolve(ref);
    return (
      !!target &&
      (await fs.access(target.file).then(
        () => true,
        () => false,
      ))
    );
  }
  async toDataUrl(cover: string) {
    const target = this.resolve(cover);
    if (!target) return cover.startsWith("data:image/") ? cover : "";
    try {
      const bytes = await fs.readFile(target.file);
      return `data:${target.mime};base64,${bytes.toString("base64")}`;
    } catch {
      return "";
    }
  }
  async fromDataUrl(cover: string) {
    if (!cover.startsWith("data:image/"))
      return this.resolve(cover) ? cover : "";
    try {
      return await this.put(Buffer.from(cover.split(",")[1] || "", "base64"));
    } catch {
      return "";
    }
  }
  async mapTask(task: Task, fn: (cover: string) => Promise<string>) {
    const entries = await Promise.all(
      task.entries.map(async (e) => {
        const cover = await fn(e.anime.cover);
        return cover === e.anime.cover
          ? e
          : { ...e, anime: { ...e.anime, cover } };
      }),
    );
    return entries.every((e, i) => e === task.entries[i])
      ? task
      : { ...task, entries };
  }
  internalize(task: Task) {
    return this.mapTask(task, (c) => this.fromDataUrl(c));
  }
  externalize(task: Task) {
    return this.mapTask(task, (c) => this.toDataUrl(c));
  }
  async migrate(state: State) {
    const tasks = await Promise.all(
      state.tasks.map((t) => this.internalize(t)),
    );
    return tasks.every((t, i) => t === state.tasks[i])
      ? state
      : { ...state, tasks };
  }
}
export function normalize(raw: any): Anime {
  return {
    id: `bgm:${raw.id}`,
    bangumiId: raw.id,
    name: raw.name_cn || raw.name,
    original: raw.name || "",
    summary: raw.summary || "",
    date: raw.date || raw.air_date || "",
    cover: raw.images?.medium || raw.images?.common || "",
  };
}
export async function fetchSubject(
  id: number,
  request: typeof fetch = fetch,
): Promise<Anime> {
  if (!Number.isInteger(id) || id <= 0) throw new Error("无效条目");
  let response: Response;
  try {
    response = await request(`https://api.bgm.tv/v0/subjects/${id}`, {
      headers: {
        "User-Agent": "AnimationRank/1.0 (Desktop; local personal ranking)",
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("连接超时或网络不可用，请重试。");
  }
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "Bangumi 上找不到该条目。"
        : `获取失败（${response.status}），请重试。`,
    );
  return normalize(await response.json());
}
export async function queryBangumi(
  q: Query,
  request: typeof fetch = fetch,
): Promise<Page> {
  if (
    !["search", "season", "collection"].includes(q.mode) ||
    !Number.isInteger(q.offset) ||
    q.offset < 0
  )
    throw new Error("无效查询参数");
  if (
    q.mode === "season" &&
    (!Number.isInteger(q.year) ||
      q.year! < 1900 ||
      q.year! > 2200 ||
      !Number.isInteger(q.quarter) ||
      q.quarter! < 1 ||
      q.quarter! > 4)
  )
    throw new Error("请选择有效年份和季度");
  let endpoint = "/v0/search/subjects";
  let body: any;
  if (q.mode === "collection") {
    let username = q.keyword.trim();
    if (username.startsWith("https://")) {
      const url = new URL(username);
      if (!["bgm.tv", "bangumi.tv", "chii.in"].includes(url.hostname))
        throw new Error("请输入 Bangumi 用户主页链接");
      username = url.pathname.split("/").filter(Boolean).pop() || "";
    }
    if (!username) throw new Error("请输入用户名");
    endpoint = `/v0/users/${encodeURIComponent(username)}/collections?subject_type=2&type=${q.status || 2}&limit=30&offset=${q.offset}`;
  } else {
    const filter: any = { type: [2] };
    if (q.mode === "season") {
      const year = q.year!,
        month = (q.quarter! - 1) * 3 + 1;
      filter.air_date = [
        `>=${year}-${String(month).padStart(2, "0")}-01`,
        `<${month === 10 ? year + 1 : year}-${String(month === 10 ? 1 : month + 3).padStart(2, "0")}-01`,
      ];
    }
    body = {
      keyword: q.mode === "search" ? q.keyword : "",
      sort: q.mode === "search" ? "match" : "heat",
      filter,
    };
    endpoint += `?limit=30&offset=${q.offset}`;
  }
  let response: Response;
  try {
    response = await request("https://api.bgm.tv" + endpoint, {
      method: body ? "POST" : "GET",
      headers: {
        "User-Agent": "AnimationRank/1.0 (Desktop; local personal ranking)",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("连接超时或网络不可用，请重试。");
  }
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "请求过于频繁，请稍后重试。"
        : response.status === 404
          ? "未找到该用户或公开收藏。"
          : `获取失败（${response.status}），请重试。`,
    );
  const data = await response.json();
  return {
    items: (data.data || []).map((item: any) =>
      normalize(q.mode === "collection" ? item.subject : item),
    ),
    total: data.total || 0,
  };
}
