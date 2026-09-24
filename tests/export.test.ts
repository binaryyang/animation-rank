import { describe, it, expect } from "vitest";
import { layoutExport } from "../src/export";
import { createTask, stateSchema, exportSchema } from "../src/model";
function fixture(count: number) {
  return {
    ...createTask("分页测试"),
    entries: Array.from({ length: count }, (_, i) => ({
      anime: {
        id: String(i),
        name: "中文长标题".repeat(10),
        original: "",
        date: "",
        summary: "",
        cover: "",
      },
      tier: 0,
    })),
  };
}
describe("导出布局和兼容性", () => {
  it("旧数据补齐偏好，任务导出不带全局设置", () => {
    expect(
      stateSchema.parse({ version: 1, tasks: [], activeId: null }).preferences,
    ).toEqual({ sidebarCollapsed: false, showNames: false });
    expect(
      exportSchema.parse({
        version: 1,
        task: createTask("t"),
        preferences: { showNames: true },
      }),
    ).not.toHaveProperty("preferences");
  });
  it("空榜单保留六个紧凑等级", () => {
    const pages = layoutExport(fixture(0), { showNames: false });
    expect(pages).toHaveLength(1);
    expect(pages[0].blocks).toHaveLength(6);
    expect(pages[0].height).toBeLessThan(600);
  });
  it("同级多行合为单块，显示名字增加行高", () => {
    const compact = layoutExport(fixture(21), { showNames: false });
    const named = layoutExport(fixture(21), { showNames: true });
    expect(compact[0].blocks[0].rows.map((row) => row.length)).toEqual([
      10, 10, 1,
    ]);
    expect(compact[0].blocks.filter((b) => b.tier === 0)).toHaveLength(1);
    expect(named[0].height).toBeGreaterThan(compact[0].height);
  });
  it.each([false, true])("长榜单分页不丢条目不截行，名称=%s", (showNames) => {
    const pages = layoutExport(fixture(450), { showNames });
    expect(pages.length).toBeGreaterThan(1);
    const blocks = pages.flatMap((p) => p.blocks);
    expect(blocks.flatMap((b) => b.rows.flat()).map((a) => a.id)).toEqual(
      Array.from({ length: 450 }, (_, i) => String(i)),
    );
    expect(
      blocks
        .filter((b) => b.tier === 0)
        .slice(1)
        .every((b) => b.continued),
    ).toBe(true);
    for (const page of pages) {
      expect(page.height).toBeLessThanOrEqual(2800);
      for (const b of page.blocks)
        expect(b.y + b.height).toBeLessThan(page.height);
    }
  });
});
