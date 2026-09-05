import { describe, it, expect } from "vitest";
import {
  addAnime,
  createTask,
  moveEntry,
  exportSchema,
  tiers,
} from "../src/model";
const anime = (id: string) => ({
  id,
  name: id,
  original: "",
  summary: "",
  date: "",
  cover: "",
});
describe("任务与评价", () => {
  it("六级固定且无关心是已评价", () => {
    expect(tiers).toEqual(["夯", "顶级", "人上上", "NPC", "拉完了", "无关心"]);
    const t = moveEntry(addAnime(createTask("a"), [anime("1")]), "1", 5);
    expect(t.entries.filter((e) => e.tier !== null)).toHaveLength(1);
  });
  it("跨任务评价不互相影响，重复来源只添加一次", () => {
    const a = addAnime(createTask("a"), [anime("bgm:1"), anime("bgm:1")]);
    const b = addAnime(createTask("b"), [anime("bgm:1")]);
    expect(a.entries).toHaveLength(1);
    expect(moveEntry(a, "bgm:1", 0).entries[0].tier).toBe(0);
    expect(b.entries[0].tier).toBeNull();
    expect(a.entries[0].tier).toBeNull();
  });
  it("同等级排序、跨级及返回待评价", () => {
    let t = addAnime(createTask("t"), ["1", "2", "3"].map(anime));
    t = moveEntry(t, "1", 0);
    t = moveEntry(t, "2", 0, "1");
    expect(
      t.entries.filter((e) => e.tier === 0).map((e) => e.anime.id),
    ).toEqual(["2", "1"]);
    t = moveEntry(t, "1", null);
    expect(t.entries.filter((e) => e.tier === 0)).toHaveLength(1);
  });
  it("任务文件往返保留封面、等级和顺序，拒绝不支持的版本", () => {
    const task = moveEntry(
      addAnime(createTask("中文榜单"), [
        { ...anime("1"), cover: "data:image/png;base64,abc" },
        anime("2"),
      ]),
      "1",
      4,
      "2",
    );
    expect(
      exportSchema.parse(JSON.parse(JSON.stringify({ version: 1, task }))),
    ).toEqual({ version: 1, task });
    expect(() => exportSchema.parse({ version: 2, task })).toThrow();
  });
});
