import { describe, it, expect, vi } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  CoverStore,
  Store,
  fetchSubject,
  queryBangumi,
} from "../electron/service";
import { State, emptyState } from "../src/model";
describe("持久化", () => {
  it("串行原子写入，重启加载，主文件损坏时恢复备份", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "animation-rank-test-"));
    try {
      const store = new Store(dir);
      const first: State = structuredClone(emptyState);
      expect((await store.load()).state).toEqual(first);
      const second: State = {
        ...first,
        tasks: [{ id: "t", name: "任务", entries: [], createdAt: "today" }],
        activeId: "t",
      };
      await Promise.all([store.save(first), store.save(second)]);
      expect((await new Store(dir).load()).state).toEqual(second);
      expect(
        JSON.parse(await readFile(path.join(dir, "state.json.bak"), "utf8")),
      ).toEqual(first);
      await writeFile(path.join(dir, "state.json"), "broken");
      expect((await store.load()).warning).toBeTruthy();
      expect((await store.load()).state).toEqual(first);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
describe("封面存储", () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("rest"),
  ]);
  const dataUrl = "data:image/png;base64," + png.toString("base64");
  it("按内容去重写入文件，状态中只保留引用，导出时还原为 data URL", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "animation-rank-cover-"));
    try {
      const covers = new CoverStore(dir);
      const ref = await covers.put(png);
      expect(ref).toMatch(/^cover:\/\/local\/[0-9a-f]{64}\.png$/);
      expect(await covers.put(png)).toBe(ref);
      expect(await covers.fromDataUrl(dataUrl)).toBe(ref);
      expect(await covers.toDataUrl(ref)).toBe(dataUrl);
      expect(await covers.fromDataUrl("data:image/png;base64,broken")).toBe("");
      await expect(covers.put(Buffer.from("text"))).rejects.toThrow("格式");
      const state: State = {
        ...emptyState,
        tasks: [
          {
            id: "t",
            name: "t",
            createdAt: "",
            entries: [
              {
                tier: null,
                anime: {
                  id: "1",
                  name: "1",
                  original: "",
                  summary: "",
                  date: "",
                  cover: dataUrl,
                },
              },
            ],
          },
        ],
      };
      const migrated = await covers.migrate(state);
      expect(migrated.tasks[0].entries[0].anime.cover).toBe(ref);
      expect(await covers.migrate(migrated)).toBe(migrated);
      expect(
        (await covers.externalize(migrated.tasks[0])).entries[0].anime.cover,
      ).toBe(dataUrl);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("拒绝越界或格式错误的引用", () => {
    const covers = new CoverStore("/tmp/x");
    expect(covers.resolve("cover://local/../state.json")).toBeNull();
    expect(covers.resolve("cover://local/abc.png")).toBeNull();
    expect(covers.resolve("https://example.com/a.png")).toBeNull();
  });
});
describe("Bangumi 获取", () => {
  it("搜索只查动画，并传递分页", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 40,
          data: [
            {
              id: 1,
              name: "原名",
              name_cn: "中文",
              date: "2026-01-01",
              images: { medium: "cover" },
            },
          ],
        }),
      ),
    );
    const result = await queryBangumi(
      { mode: "search", keyword: "动画", offset: 30 },
      request,
    );
    expect(request.mock.calls[0][0]).toContain("offset=30");
    expect(JSON.parse(request.mock.calls[0][1].body).filter.type).toEqual([2]);
    expect(result.items[0].id).toBe("bgm:1");
    expect(result.total).toBe(40);
  });
  it("冬秋季度日期边界正确", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [], total: 0 })));
    await queryBangumi(
      { mode: "season", keyword: "", year: 2026, quarter: 4, offset: 0 },
      request,
    );
    expect(JSON.parse(request.mock.calls[0][1].body).filter.air_date).toEqual([
      ">=2026-10-01",
      "<2027-01-01",
    ]);
  });
  it("收藏主页用户名及状态映射", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 1,
          data: [{ subject: { id: 8, name: "动画" } }],
        }),
      ),
    );
    const page = await queryBangumi(
      {
        mode: "collection",
        keyword: "https://bgm.tv/user/example",
        offset: 0,
        status: 3,
      },
      request,
    );
    expect(request.mock.calls[0][0]).toContain(
      "/users/example/collections?subject_type=2&type=3",
    );
    expect(page.items[0].name).toBe("动画");
  });
  it("按 ID 获取单个条目并校验参数", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: 5, name: "原名", images: { common: "c" } }),
        ),
      );
    const anime = await fetchSubject(5, request);
    expect(request.mock.calls[0][0]).toBe("https://api.bgm.tv/v0/subjects/5");
    expect(anime).toMatchObject({ id: "bgm:5", name: "原名", cover: "c" });
    await expect(fetchSubject(0, request)).rejects.toThrow("无效");
    await expect(
      fetchSubject(
        5,
        vi.fn().mockResolvedValue(new Response("", { status: 404 })),
      ),
    ).rejects.toThrow("找不到");
  });
  it("空结果可正常返回", async () => {
    expect(
      await queryBangumi(
        { mode: "search", keyword: "x", offset: 0 },
        vi.fn().mockResolvedValue(new Response('{"data":[],"total":0}')),
      ),
    ).toEqual({ items: [], total: 0 });
  });
  it("限流和超时给出可重试错误", async () => {
    await expect(
      queryBangumi(
        { mode: "search", keyword: "x", offset: 0 },
        vi.fn().mockResolvedValue(new Response("", { status: 429 })),
      ),
    ).rejects.toThrow("频繁");
    await expect(
      queryBangumi(
        { mode: "search", keyword: "x", offset: 0 },
        vi.fn().mockRejectedValue(new Error("timeout")),
      ),
    ).rejects.toThrow("超时");
  });
});
