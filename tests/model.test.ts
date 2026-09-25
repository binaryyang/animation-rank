import { describe, it, expect } from "vitest";
import {
  addAnime,
  createTask,
  moveEntry,
  exportSchema,
  tiers,
  emptyHistory,
  emptyState,
  record,
  undo,
  redo,
  removeEntries,
  State,
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
describe("移除动画", () => {
  it("只移除指定条目，保留其余顺序与等级", () => {
    let t = addAnime(createTask("t"), ["1", "2", "3"].map(anime));
    t = moveEntry(t, "3", 0);
    const next = removeEntries(t, ["1", "missing"]);
    expect(next.entries.map((e) => [e.anime.id, e.tier])).toEqual([
      ["2", null],
      ["3", 0],
    ]);
    expect(t.entries).toHaveLength(3);
  });
});
describe("撤销与重做", () => {
  it("恢复任务和所在榜单，保留偏好，新操作清空重做", () => {
    const a = createTask("a"),
      b = createTask("b");
    const s0: State = { ...emptyState, tasks: [a], activeId: a.id };
    const s1: State = { ...s0, tasks: [a, b], activeId: b.id };
    let h = record(emptyHistory, s0, "新建");
    const later = {
      ...s1,
      activeId: a.id,
      preferences: { sidebarCollapsed: true, showNames: true },
    };
    const back = undo(h, later)!;
    expect(back.label).toBe("新建");
    expect(back.state.tasks).toEqual([a]);
    expect(back.state.preferences.showNames).toBe(true);
    const forward = redo(back.history, back.state)!;
    expect(forward.state.tasks).toEqual([a, b]);
    expect(forward.state.activeId).toBe(a.id);
    h = record(back.history, back.state, "其他");
    expect(redo(h, back.state)).toBeNull();
    expect(undo(emptyHistory, s0)).toBeNull();
  });
  it("修改非当前榜单时，撤销和重做切换到被修改的榜单", () => {
    const a = createTask("a"),
      b = createTask("b");
    const s0: State = { ...emptyState, tasks: [a, b], activeId: a.id };
    const s1: State = { ...s0, tasks: [a, addAnime(b, [anime("1")])] };
    const back = undo(record(emptyHistory, s0, "添加", b.id), s1)!;
    expect(back.state.activeId).toBe(b.id);
    expect(
      redo(back.history, { ...back.state, activeId: a.id })!.state.activeId,
    ).toBe(b.id);
  });
  it("历史最多保留 100 步", () => {
    let h = emptyHistory;
    for (let i = 0; i < 120; i++) h = record(h, emptyState, String(i));
    expect(h.past).toHaveLength(100);
    expect(h.past[0].label).toBe("20");
  });
});
