import { describe, it, expect } from "vitest";
import { restoreWindow } from "../electron/window-state";
const screen = { x: 0, y: 0, width: 1728, height: 1080 };
describe("窗口状态", () => {
  it("恢复保存的位置、大小和最大化状态", () => {
    expect(
      restoreWindow(
        { x: 40, y: 50, width: 1200, height: 800, maximized: true },
        [screen],
      ),
    ).toEqual({ x: 40, y: 50, width: 1200, height: 800, maximized: true });
  });
  it("缺失或损坏时使用默认大小", () => {
    expect(restoreWindow(undefined, [screen])).toEqual({
      width: 1440,
      height: 960,
      maximized: false,
    });
    expect(restoreWindow({ width: "x" }, [screen]).width).toBe(1440);
  });
  it("大小限制在最小值和屏幕之间，移出屏幕时丢弃位置", () => {
    expect(
      restoreWindow({ x: 0, y: 0, width: 400, height: 5000 }, [screen]),
    ).toMatchObject({ width: 1000, height: 1080 });
    const offscreen = restoreWindow(
      { x: 3000, y: 100, width: 1200, height: 800 },
      [screen],
    );
    expect(offscreen.x).toBeUndefined();
    expect(
      restoreWindow({ x: 3000, y: 100, width: 1200, height: 800 }, [
        screen,
        { x: 1728, y: 0, width: 2560, height: 1440 },
      ]),
    ).toMatchObject({ x: 3000, y: 100 });
  });
});
