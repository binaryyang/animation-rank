const { _electron: electron, expect } = require("@playwright/test");
const { mkdtemp, readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

(async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "animation-rank-e2e-"));
  let application;
  const launch = () =>
    electron.launch({
      ...(process.argv.includes("--packaged")
        ? {
            executablePath: path.resolve(
              "release/mac-arm64/动画梯度排行.app/Contents/MacOS/动画梯度排行",
            ),
            args: [],
          }
        : { args: [path.resolve(".")] }),
      env: { ...process.env, ANIMATION_RANK_DATA_DIR: dir },
    });
  let page;
  try {
    application = await launch();
    page = await application.firstWindow();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("button", { name: "＋ 创建第一份评价任务" }).click();
    await page.locator(".dialog textarea").fill("2026 夏季新番\n历史最爱");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.locator(".task-link")).toHaveCount(2);
    await page
      .getByRole("button", { name: "＋ 添加动画", exact: true })
      .click();
    await page.getByRole("button", { name: "手动", exact: true }).click();
    await page
      .locator(".form input")
      .nth(0)
      .fill("测试动画：一段很长的中文名称用来验证展示");
    await page.getByRole("button", { name: "加入榜单 →" }).click();
    await expect(page.locator(".pending .anime-card")).toHaveCount(1);
    await page.getByRole("button", { name: "ϟ 快捷评价" }).click();
    await page.keyboard.press("6");
    await expect(page.getByText("全部评价完成 ✨")).toBeVisible();
    await page.getByRole("button", { name: "↶ 撤销" }).click();
    await expect(page.locator(".quick-view .cover")).toBeVisible();
    await page.keyboard.press("1");
    await page.getByRole("button", { name: "▦ 梯度榜单" }).click();
    await expect(
      page.locator(".tier-row").nth(0).locator(".anime-card"),
    ).toHaveCount(1);
    // Real HTML drag/drop between tiers, moved in several steps like a real
    // pointer; a single jump occasionally fails to start a native drag.
    const from = await page
      .locator(".tier-row")
      .nth(0)
      .locator(".anime-card")
      .boundingBox();
    const to = await page
      .locator(".tier-row")
      .nth(2)
      .locator(".tier-content")
      .boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(
      page.locator(".tier-row").nth(2).locator(".anime-card"),
    ).toHaveCount(1);
    await page.locator(".task-link").nth(1).click();
    await expect(page.locator(".anime-card")).toHaveCount(0);
    await page.locator(".task-link").nth(0).click();
    await expect(page.locator(".save-status")).toContainText("已保存");
    const saved = JSON.parse(
      await readFile(path.join(dir, "state.json"), "utf8"),
    );
    expect(saved.tasks[0].entries[0].tier).toBe(2);
    // Bind importing to the original task even when the sidebar switches.
    await page
      .getByRole("button", { name: "＋ 添加动画", exact: true })
      .click();
    await page.getByRole("button", { name: "手动", exact: true }).click();
    await page.locator(".form input").nth(0).fill("目标绑定测试");
    await page.locator(".task-link").nth(1).click();
    await page.getByRole("button", { name: "加入榜单 →" }).click();
    await expect(page.locator(".anime-card")).toHaveCount(0);
    await page.locator(".task-link").nth(0).click();
    await expect(page.locator(".anime-card")).toHaveCount(2);
    // Undo reverts the latest action, even adding; redo reapplies it.
    await page.getByRole("button", { name: "↶ 撤销" }).click();
    await expect(page.locator(".anime-card")).toHaveCount(1);
    await expect(page.getByRole("status")).toContainText("已撤销");
    await page.keyboard.press("Meta+Shift+z");
    await expect(page.locator(".anime-card")).toHaveCount(2);
    await page.keyboard.press("Meta+z");
    await page
      .getByRole("status")
      .getByRole("button", { name: "重做", exact: true })
      .click();
    await expect(page.locator(".anime-card")).toHaveCount(2);
    // Removing an entry from the detail dialog is undoable.
    await page.locator(".pending .card-button").first().click();
    await page.getByRole("button", { name: "从榜单移除", exact: true }).click();
    await expect(page.locator(".anime-card")).toHaveCount(1);
    await expect(page.getByRole("status")).toContainText("已从榜单移除");
    await page
      .getByRole("status")
      .getByRole("button", { name: "撤销", exact: true })
      .click();
    await expect(page.locator(".anime-card")).toHaveCount(2);
    // Editing anime info updates the card and is undoable.
    await page.locator(".pending .card-button").first().click();
    await page.getByRole("button", { name: "编辑信息", exact: true }).click();
    await page
      .getByRole("dialog", { name: "编辑动画信息" })
      .locator("input")
      .first()
      .fill("编辑后的名称");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.locator(".detail h2")).toHaveText("编辑后的名称");
    await page.getByRole("button", { name: "关闭详情" }).click();
    await expect(page.locator(".pending .card-button").first()).toHaveAttribute(
      "title",
      "编辑后的名称",
    );
    await page.keyboard.press("Meta+z");
    await expect(page.locator(".pending .card-button").first()).toHaveAttribute(
      "title",
      "目标绑定测试",
    );
    // Rename, duplicate and delete remain isolated to the selected task.
    await page.getByRole("button", { name: "重命名", exact: true }).click();
    await page.locator(".dialog textarea").fill("重命名验证");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.locator("h1")).toHaveText("重命名验证");
    await page.getByRole("button", { name: "复制", exact: true }).click();
    await expect(page.locator(".task-link")).toHaveCount(3);
    await expect(page.locator(".anime-card")).toHaveCount(2);
    await page.getByRole("button", { name: "删除", exact: true }).click();
    await page.getByRole("button", { name: "删除任务", exact: true }).click();
    await expect(page.locator(".task-link")).toHaveCount(2);
    // Deleting a task can be undone from the notice and redone again.
    await page
      .getByRole("status")
      .getByRole("button", { name: "撤销", exact: true })
      .click();
    await expect(page.locator(".task-link")).toHaveCount(3);
    await expect(page.locator("h1")).toHaveText("重命名验证 · 副本");
    await page.keyboard.press("Meta+Shift+z");
    await expect(page.locator(".task-link")).toHaveCount(2);
    // Exercise export IPC with native save dialogs stubbed to an isolated test directory.
    await application.evaluate(({ dialog }, dir) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: dir + "/task.json",
      });
    }, dir);
    await page.getByRole("button", { name: "任务 JSON", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("任务文件已导出");
    const exported = JSON.parse(
      await readFile(path.join(dir, "task.json"), "utf8"),
    );
    expect(exported.task.entries).toHaveLength(2);
    await application.evaluate(({ dialog }, dir) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: dir + "/board.png",
      });
    }, dir);
    await page.getByRole("button", { name: "↗ 导出图片" }).click();
    await expect(
      page.getByRole("dialog", { name: "导出图片预览" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "保存图片", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("checkbox", { name: "显示动画名称", exact: true })
      .check();
    await expect(
      page.getByRole("button", { name: "保存图片", exact: true }),
    ).toBeEnabled();
    const previewData = await page
      .locator(".preview-canvas img")
      .getAttribute("src");
    await page.screenshot({ path: path.join(dir, "export-preview.png") });
    await page.getByRole("button", { name: "保存图片", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("榜单图片已导出");
    expect(
      (await readFile(path.join(dir, "board.png"))).subarray(1, 4).toString(),
    ).toBe("PNG");
    expect(
      (await readFile(path.join(dir, "board.png"))).toString("base64"),
    ).toBe(previewData.split(",")[1]);
    await page.screenshot({
      path: path.join(dir, "desktop.png"),
      fullPage: true,
    });
    await application.evaluate(({ dialog }, dir) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [dir + "/task.json"],
      });
    }, dir);
    await page.getByRole("button", { name: "↥ 导入任务文件" }).click();
    await expect(page.locator(".task-link")).toHaveCount(3);
    await expect(page.locator(".anime-card")).toHaveCount(2);
    await expect(page.locator(".save-status")).toContainText("已保存");
    await expect(page.locator(".board .card-button > span")).toHaveCount(0);
    await expect(page.locator(".pending .card-button > span")).toHaveCount(1);
    await page.getByRole("checkbox", { name: "显示名称", exact: true }).check();
    await expect(page.locator(".board .card-button > span")).toHaveCount(1);
    const beforeCollapse = await page.locator(".board-scroll").boundingBox();
    await page.getByRole("button", { name: "收起侧栏", exact: true }).click();
    await expect(page.locator(".sidebar")).toBeHidden();
    const afterCollapse = await page.locator(".board-scroll").boundingBox();
    expect(afterCollapse.width - beforeCollapse.width).toBeGreaterThan(150);
    await expect(page.locator(".save-status")).toContainText("已保存");
    await application.close();
    application = await launch();
    page = await application.firstWindow();
    await expect(page.locator(".task-link")).toHaveCount(3);
    await expect(page.locator(".anime-card")).toHaveCount(2);
    await expect(page.locator(".sidebar")).toBeHidden();
    await expect(
      page.getByRole("checkbox", { name: "显示名称", exact: true }),
    ).toBeChecked();
    await page.getByRole("button", { name: "展开侧栏", exact: true }).click();
    await page
      .getByRole("checkbox", { name: "显示名称", exact: true })
      .uncheck();
    expect(errors).toEqual([]);
    // Import a long fixture and verify automatic multipage PNG output.
    const sampleCover = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#345f73";
      ctx.fillRect(0, 0, 320, 320);
      ctx.fillStyle = "#e4c077";
      ctx.beginPath();
      ctx.arc(160, 115, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "24px sans-serif";
      ctx.fillText("封面裁切测试", 88, 248);
      return canvas.toDataURL("image/png");
    });
    const fixture = {
      version: 1,
      task: {
        id: "large",
        name: "长榜单 · 中文与缺失封面验证",
        createdAt: new Date().toISOString(),
        entries: Array.from({ length: 170 }, (_, i) => ({
          anime: {
            id: String(i),
            name: `第 ${i + 1} 部动画：这是用于测试自动换行的中文长标题`,
            original: "",
            date: "",
            summary: "",
            cover:
              i % 3 === 0
                ? sampleCover
                : i % 3 === 1
                  ? "data:image/png;base64,broken"
                  : "",
          },
          tier: i % 6,
        })),
      },
    };
    await writeFile(path.join(dir, "large.json"), JSON.stringify(fixture));
    await application.evaluate(({ dialog }, dir) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [dir + "/large.json"],
      });
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: dir + "/large.png",
      });
    }, dir);
    await page.getByRole("button", { name: "↥ 导入任务文件" }).click();
    await expect(page.locator(".anime-card")).toHaveCount(170);
    // Covers are stored as files; state.json only keeps references.
    await expect(page.locator(".save-status")).toContainText("已保存");
    const stored = await readFile(path.join(dir, "state.json"), "utf8");
    expect(stored).not.toContain("data:image");
    expect(stored).toContain("cover://local/");
    await expect(
      page.locator(".board img.cover[src^='cover://local/']").first(),
    ).toHaveJSProperty("complete", true);
    expect(
      await page
        .locator(".board img.cover[src^='cover://local/']")
        .first()
        .evaluate((img) => img.naturalWidth),
    ).toBe(320);
    await page.getByRole("button", { name: "↗ 导出图片" }).click();
    await expect(
      page.getByRole("dialog", { name: "导出图片预览" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "保存图片", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "下一页", exact: true }).click();
    await expect(page.locator(".preview-canvas img")).toHaveAttribute(
      "alt",
      "榜单预览，第 2 页",
    );
    await page.getByRole("button", { name: "上一页", exact: true }).click();
    await page.getByRole("button", { name: "保存图片", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("榜单图片已导出");
    for (const filename of ["large-1.png", "large-2.png"]) {
      const dimensions = await application.evaluate(
        ({ nativeImage }, file) => nativeImage.createFromPath(file).getSize(),
        dir + "/" + filename,
      );
      expect(dimensions.width).toBe(1440);
      expect(dimensions.height).toBeLessThanOrEqual(2800);
    }
    // Exported task files embed the cover images again.
    await application.evaluate(({ dialog }, dir) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: dir + "/large-export.json",
      });
    }, dir);
    await page.getByRole("button", { name: "任务 JSON", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("任务文件已导出");
    const largeExport = JSON.parse(
      await readFile(path.join(dir, "large-export.json"), "utf8"),
    );
    expect(largeExport.task.entries[0].anime.cover).toBe(sampleCover);
    expect(largeExport.task.entries[1].anime.cover).toBe("");
    // Batch partial failure remains reviewable; successful candidates can still import.
    await application.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("query");
      ipcMain.handle("query", (_, q) => {
        if (q.keyword === "失败项") throw new Error("模拟网络失败");
        return {
          total: 1,
          items: [
            {
              id: "bgm:123",
              bangumiId: 123,
              name: q.keyword,
              original: "",
              summary: "",
              date: "2026-01-01",
              cover: "",
            },
          ],
        };
      });
    });
    await page
      .getByRole("button", { name: "＋ 添加动画", exact: true })
      .click();
    await page.getByRole("button", { name: "批量名称", exact: true }).click();
    await page.locator(".panel-body textarea").fill("成功项\n失败项");
    await page.getByRole("button", { name: "匹配动画名称" }).click();
    await expect(page.locator(".batch-row")).toHaveCount(2);
    await expect(page.locator(".batch-row").nth(1)).toContainText(
      "模拟网络失败",
    );
    await page
      .locator(".batch-row")
      .nth(0)
      .locator("select")
      .selectOption("bgm:123");
    await page
      .locator(".batch-row")
      .nth(1)
      .locator("select")
      .selectOption("manual");
    await page.getByRole("button", { name: "加入榜单 →" }).click();
    await expect(page.locator(".anime-card")).toHaveCount(172);
    // Search results already in the target task are marked and not selectable.
    await page
      .getByRole("button", { name: "＋ 添加动画", exact: true })
      .click();
    await page.locator(".search-input").fill("成功项");
    await page.getByRole("button", { name: "搜索动画" }).click();
    await expect(page.locator(".result.added")).toContainText("已在榜单");
    await expect(page.locator(".result.added")).toBeDisabled();
    await expect(page.getByRole("button", { name: "选择已加载" })).toHaveCount(
      0,
    );
    await page.locator(".panel-title button").click();
    // Fixed panes and direct drops remain reachable at minimum window size.
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1000, 700),
    );
    await page.locator(".pending-header input").fill("成功项");
    await expect(page.locator(".pending .anime-card")).toHaveCount(1);
    await page
      .locator(".board-scroll")
      .evaluate((el) => (el.scrollTop = el.scrollHeight));
    const transfer = await page.evaluateHandle(() => new DataTransfer());
    await page
      .locator(".pending .anime-card")
      .dispatchEvent("dragstart", { dataTransfer: transfer });
    await expect(page.locator(".dropbar")).toHaveCount(0);
    const bounds = await page.locator(".board-scroll").boundingBox();
    expect(bounds.y).toBeLessThan(180);
    expect(bounds.height).toBeGreaterThan(450);
    await page.screenshot({ path: path.join(dir, "minimum-drag.png") });
    await page.locator(".board-scroll").evaluate((el) => (el.scrollTop = 0));
    await page
      .locator(".tier-row")
      .first()
      .dispatchEvent("drop", { dataTransfer: transfer });
    await expect(page.locator(".dropbar")).toHaveCount(0);
    await expect(page.locator(".pending .anime-card")).toHaveCount(0);
    await page.getByRole("button", { name: "↶ 撤销" }).click();
    await expect(page.locator(".pending .anime-card")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    // Edge scrolling stops once the pointer leaves the scrolling area.
    await page.locator(".board-scroll").evaluate((el) => (el.scrollTop = 0));
    await page
      .locator(".pending .anime-card")
      .dispatchEvent("dragstart", { dataTransfer: transfer });
    const area = await page.locator(".board-scroll").boundingBox();
    await page.locator(".board-scroll").dispatchEvent("dragover", {
      dataTransfer: transfer,
      clientX: area.x + 50,
      clientY: area.y + area.height - 5,
    });
    await expect
      .poll(() => page.locator(".board-scroll").evaluate((el) => el.scrollTop))
      .toBeGreaterThan(20);
    await page
      .locator(".toolbar")
      .dispatchEvent("dragover", { dataTransfer: transfer });
    const stopped = await page
      .locator(".board-scroll")
      .evaluate((el) => el.scrollTop);
    await page.waitForTimeout(100);
    expect(
      await page.locator(".board-scroll").evaluate((el) => el.scrollTop),
    ).toBe(stopped);
    await page.keyboard.press("Escape");
    await expect(page.locator(".dropbar")).toHaveCount(0);
    // Task changes invalidate the drag before any destination can receive it.
    await page
      .locator(".pending .anime-card")
      .dispatchEvent("dragstart", { dataTransfer: transfer });
    await page.locator(".task-link").first().click();
    await expect(page.locator(".dropbar")).toHaveCount(0);
    await page
      .locator(".tier-row")
      .first()
      .dispatchEvent("drop", { dataTransfer: transfer });
    await expect(page.locator(".anime-card")).toHaveCount(2);
    // Quick ranking: skip, rate, then revisit the previous one.
    const quickFixture = {
      version: 1,
      task: {
        id: "quick",
        name: "快捷评价验证",
        createdAt: new Date().toISOString(),
        entries: ["甲", "乙", "丙"].map((name) => ({
          anime: {
            id: name,
            name,
            original: name + " original",
            date: "2020-04-01",
            summary: name + " 的简介",
            cover: "",
          },
          tier: null,
        })),
      },
    };
    await writeFile(path.join(dir, "quick.json"), JSON.stringify(quickFixture));
    await application.evaluate(({ dialog }, dir) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [dir + "/quick.json"],
      });
    }, dir);
    await page.getByRole("button", { name: "↥ 导入任务文件" }).click();
    await page.getByRole("button", { name: "ϟ 快捷评价" }).click();
    const quickName = page.locator(".quick-view h2").nth(1);
    await expect(quickName).toHaveText("甲");
    await expect(page.locator(".quick-summary")).toHaveText("甲 的简介");
    await page.keyboard.press("s");
    await expect(quickName).toHaveText("乙");
    await page.keyboard.press("1");
    await expect(quickName).toHaveText("丙");
    await page.keyboard.press("ArrowLeft");
    await expect(quickName).toHaveText("乙");
    await expect(page.locator(".quick-view h2").first()).toContainText(
      "当前为「夯」",
    );
    await page.screenshot({ path: path.join(dir, "quick.png") });
    await page.keyboard.press("3");
    await expect(quickName).toHaveText("丙");
    await page.getByRole("button", { name: "▦ 梯度榜单" }).click();
    await expect(
      page.locator(".tier-row").nth(2).locator(".anime-card"),
    ).toHaveCount(1);
    await expect(
      page.locator(".tier-row").nth(0).locator(".anime-card"),
    ).toHaveCount(0);
    // Board keyboard: number keys rank the focused card and focus follows it.
    await page.locator("[data-anime-id='甲'] .card-button").focus();
    await page.keyboard.press("2");
    await expect(
      page.locator(".tier-row").nth(1).locator("[data-anime-id='甲']"),
    ).toHaveCount(1);
    await expect(
      page.locator("[data-anime-id='甲'] .card-button"),
    ).toBeFocused();
    await page.keyboard.press("0");
    await expect(page.locator(".pending [data-anime-id='甲']")).toHaveCount(1);
    await page.keyboard.press("ArrowLeft");
    await expect(
      page.locator("[data-anime-id='丙'] .card-button"),
    ).toBeFocused();
    await page.keyboard.press("Delete");
    await expect(page.locator(".anime-card")).toHaveCount(2);
    await page.keyboard.press("Meta+z");
    await expect(page.locator(".anime-card")).toHaveCount(3);
    await page.locator("[data-anime-id='乙']").hover();
    await page.keyboard.press("5");
    await expect(
      page.locator(".tier-row").nth(4).locator("[data-anime-id='乙']"),
    ).toHaveCount(1);
    // Multi-select with ⌘-click, rank the selection by key and context menu.
    await page.mouse.move(0, 0);
    await page
      .locator("[data-anime-id='甲'] .card-button")
      .click({ modifiers: ["Meta"] });
    await page
      .locator("[data-anime-id='丙'] .card-button")
      .click({ modifiers: ["Meta"] });
    await expect(page.locator(".selection-bar")).toContainText("已选 2 部");
    await page.mouse.move(0, 0);
    await page.keyboard.press("1");
    await expect(
      page.locator(".tier-row").nth(0).locator(".anime-card"),
    ).toHaveCount(2);
    await page.locator("[data-anime-id='甲']").click({ button: "right" });
    await expect(page.getByRole("menu")).toContainText("2 部动画");
    await page.screenshot({ path: path.join(dir, "menu.png") });
    await page.getByRole("menuitem", { name: "NPC" }).click();
    await expect(
      page.locator(".tier-row").nth(3).locator(".anime-card.selected"),
    ).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(page.locator(".anime-card.selected")).toHaveCount(0);
    await page.locator("[data-anime-id='乙']").click({ button: "right" });
    await page.getByRole("menuitem", { name: "从榜单移除" }).click();
    await expect(page.locator(".anime-card")).toHaveCount(2);
    await page.keyboard.press("Meta+z");
    await expect(page.locator(".anime-card")).toHaveCount(3);
    console.log(
      JSON.stringify({
        passed: true,
        packaged: process.argv.includes("--packaged"),
        artifacts: dir,
        checks: [
          "batch creation",
          "manual import",
          "keyboard ranking",
          "undo",
          "drag/drop",
          "task isolation",
          "bound import",
          "JSON roundtrip",
          "PNG export",
          "restart persistence",
          "rename/copy/delete",
          "long PNG pagination",
          "batch partial failure",
          "collapsed sidebar and preference persistence",
          "name visibility",
          "preview exact PNG and pagination",
        ],
      }),
    );
  } catch (error) {
    await page
      ?.screenshot({ path: path.join(dir, "failure.png") })
      .catch(() => {});
    console.error("Failure screenshot:", path.join(dir, "failure.png"));
    throw error;
  } finally {
    if (application) await application.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
