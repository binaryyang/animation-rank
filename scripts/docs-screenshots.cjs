// Regenerates the screenshots used by docs/user-guide.md.
// Usage: npm run docs:screenshots
const { _electron: electron, expect } = require("@playwright/test");
const { mkdtemp, mkdir, rm, writeFile } = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const out = path.resolve("docs/images");
const anime = [
  ["葬送的芙莉莲", "葬送のフリーレン", "2023-09-29", 0],
  ["孤独摇滚！", "ぼっち・ざ・ろっく！", "2022-10-08", 0],
  ["命运石之门", "STEINS;GATE", "2011-04-05", 0],
  ["进击的巨人", "進撃の巨人", "2013-04-06", 1],
  ["紫罗兰永恒花园", "ヴァイオレット・エヴァーガーデン", "2018-01-10", 1],
  ["赛博朋克：边缘行者", "Cyberpunk: Edgerunners", "2022-09-13", 1],
  ["间谍过家家", "SPY×FAMILY", "2022-04-09", 2],
  ["药屋少女的呢喃", "薬屋のひとりごと", "2023-10-21", 2],
  ["迷宫饭", "ダンジョン飯", "2024-01-04", 2],
  ["摇曳露营△", "ゆるキャン△", "2018-01-04", 2],
  ["鬼灭之刃", "鬼滅の刃", "2019-04-06", 3],
  ["咒术回战", "呪術廻戦", "2020-10-03", 3],
  ["我推的孩子", "【推しの子】", "2023-04-12", 4],
  ["化物语", "化物語", "2009-07-03", null],
  ["链锯人", "チェンソーマン", "2022-10-11", null],
  ["排球少年！！", "ハイキュー!!", "2014-04-06", null],
].map(([name, original, date, tier], i) => ({
  id: `bgm:${9000 + i}`,
  bangumiId: 9000 + i,
  name,
  original,
  date,
  tier,
  summary:
    name === "葬送的芙莉莲"
      ? "勇者一行打倒魔王后，长寿的精灵魔法使芙莉莲送走了昔日的同伴。为了了解人类，她踏上了新的旅程。（示例简介）"
      : `${name}的示例简介。实际使用时，从 Bangumi 添加的动画会自动带上官方简介。`,
}));
const extra = [
  ["轻音少女", "けいおん！", "2009-04-02"],
  ["魔法少女小圆", "魔法少女まどか☆マギカ", "2011-01-07"],
  ["少女乐队的呐喊", "ガールズバンドクライ", "2024-04-05"],
].map(([name, original, date], i) => ({
  id: `bgm:${9100 + i}`,
  bangumiId: 9100 + i,
  name,
  original,
  date,
  summary: "",
}));

(async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "animation-rank-docs-"));
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const application = await electron.launch({
    args: [path.resolve(".")],
    env: { ...process.env, ANIMATION_RANK_DATA_DIR: dir },
  });
  try {
    const page = await application.firstWindow();
    await application.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.setSize(1280, 800);
      win.center();
    });
    const shot = async (name, locator, { keep = false } = {}) => {
      const close = page.getByRole("button", { name: "关闭提示" });
      if (!keep && (await close.count()))
        await close.evaluate((b) => b.click());
      if (!keep) await page.mouse.move(0, 0);
      await page.waitForTimeout(250);
      await (locator ?? page).screenshot({
        path: path.join(out, name + ".png"),
        scale: "css",
        animations: "disabled",
      });
      console.log("saved", name);
    };
    const clickMenu = (menu, label) =>
      application.evaluate(
        ({ Menu }, [menu, label]) =>
          Menu.getApplicationMenu()
            .items.find((i) => i.label === menu)
            .submenu.items.find((i) => i.label === label)
            .click(),
        [menu, label],
      );
    const card = (name) =>
      page.locator(
        `[data-anime-id='${anime.find((a) => a.name === name).id}'] .card-button`,
      );

    await expect(page.locator(".first-steps")).toBeVisible();
    await shot("first-run");

    await page.getByRole("button", { name: "＋ 创建第一份评价任务" }).click();
    await page.locator(".dialog textarea").fill("2026 夏季新番");
    await shot("new-task", page.locator(".dialog"));
    await page.getByRole("button", { name: "保存", exact: true }).click();

    // Demo covers are drawn locally so the guide ships no third-party artwork.
    const all = [...anime, ...extra];
    const covers = await page.evaluate(
      (names) => {
        return names.map((name, i) => {
          const c = document.createElement("canvas");
          c.width = 240;
          c.height = 340;
          const g = c.getContext("2d");
          const hue = (i * 47) % 360;
          const grad = g.createLinearGradient(0, 0, 240, 340);
          grad.addColorStop(0, `hsl(${hue} 55% 62%)`);
          grad.addColorStop(1, `hsl(${(hue + 40) % 360} 45% 32%)`);
          g.fillStyle = grad;
          g.fillRect(0, 0, 240, 340);
          g.fillStyle = "rgba(255,255,255,.14)";
          g.beginPath();
          g.arc(180, 90, 70, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "white";
          g.font = "bold 26px -apple-system, 'PingFang SC', sans-serif";
          const chars = [...name];
          const lines = [];
          for (let k = 0; k < chars.length; k += 6)
            lines.push(chars.slice(k, k + 6).join(""));
          lines.forEach((line, k) =>
            g.fillText(line, 20, 250 + k * 34 - (lines.length - 1) * 34),
          );
          return c.toDataURL("image/png");
        });
      },
      all.map((a) => a.name),
    );
    all.forEach((a, i) => (a.cover = covers[i]));
    const toAnime = ({ tier, ...a }) => a;
    await writeFile(
      path.join(dir, "demo.json"),
      JSON.stringify({
        version: 1,
        task: {
          id: "demo",
          name: "我的动画梯度榜",
          createdAt: new Date().toISOString(),
          entries: anime.map((a) => ({ anime: toAnime(a), tier: a.tier })),
        },
      }),
    );
    await application.evaluate(
      ({ dialog, ipcMain }, [dir, pool]) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [dir + "/demo.json"],
        });
        ipcMain.removeHandler("query");
        ipcMain.handle("query", (_, q) => {
          const words = String(q.keyword || "")
            .split(/[\s！!]+/)
            .filter(Boolean);
          const items = pool.filter((a) =>
            words.some((w) => a.name.includes(w) || w.includes(a.name)),
          );
          return { items, total: items.length };
        });
      },
      [dir, all.map(toAnime)],
    );
    await page.getByRole("button", { name: "↥ 导入任务文件" }).click();
    await expect(page.locator(".anime-card")).toHaveCount(anime.length);
    await shot("board");

    await page
      .getByRole("button", { name: "＋ 添加动画", exact: true })
      .click();
    await page.locator(".search-input").fill("少女");
    await page.getByRole("button", { name: "搜索动画" }).click();
    await expect(page.locator(".result.added")).toHaveCount(1);
    await page.locator(".result:not(.added)").first().click();
    await shot("add-search");
    await page.getByRole("button", { name: "批量名称", exact: true }).click();
    await page
      .locator(".panel-body textarea")
      .fill("轻音少女\n魔法少女小圆\n一部查不到的动画");
    await page.getByRole("button", { name: "匹配动画名称" }).click();
    await expect(page.locator(".batch-row")).toHaveCount(3);
    await shot("add-batch");
    await page.getByRole("button", { name: "手动", exact: true }).click();
    await shot("add-manual");
    await page.locator(".panel-title button").click();

    await clickMenu("显示", "快捷评价");
    await expect(page.locator(".quick-view")).toBeVisible();
    await shot("quick-rate");
    await clickMenu("显示", "梯度榜单");

    await card("葬送的芙莉莲").click();
    await expect(page.locator(".current-tier")).toBeVisible();
    await shot("detail", page.locator(".dialog.detail"));
    await page.getByRole("button", { name: "编辑信息" }).click();
    await shot("edit", page.locator(".dialog.detail"));
    await page.getByRole("button", { name: "取消" }).click();
    await page.getByRole("button", { name: "关闭详情" }).click();

    await card("间谍过家家").click({ modifiers: ["Meta"] });
    await card("迷宫饭").click({ modifiers: ["Meta"] });
    await card("迷宫饭").click({ button: "right" });
    await expect(page.getByRole("menu")).toBeVisible();
    await shot("multi-select");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await page.locator(".pending-header input").fill("少女");
    await shot("board-search");
    await page.locator(".pending-header input").press("Escape");
    await page.locator(".pending-header input").blur();

    await card("我推的孩子").hover();
    await page.keyboard.press("Backspace");
    await expect(page.getByRole("status")).toContainText("撤销");
    await shot("undo", undefined, { keep: true });
    await page
      .getByRole("status")
      .getByRole("button", { name: "撤销" })
      .click();

    await clickMenu("文件", "导出图片…");
    await expect(
      page.getByRole("dialog", { name: "导出图片预览" }),
    ).toBeVisible();
    await page.waitForTimeout(800);
    await shot("export");
    await page.getByRole("button", { name: "关闭导出预览" }).click();

    await page.keyboard.press("?");
    await shot("shortcuts", page.getByRole("dialog", { name: "键盘快捷键" }));
  } finally {
    await application.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
