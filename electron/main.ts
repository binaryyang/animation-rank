import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Anime, animeSchema, exportSchema, taskSchema } from "../src/model";
import { Store, queryBangumi } from "./service";
let win: BrowserWindow;
if (process.env.ANIMATION_RANK_DATA_DIR)
  app.setPath("userData", process.env.ANIMATION_RANK_DATA_DIR);
app.whenReady().then(() => {
  const store = new Store(app.getPath("userData"));
  let ready = false;
  ipcMain.handle("load", async () => {
    const result = await store.load();
    ready = true;
    return result;
  });
  ipcMain.handle("save", (_, state) => {
    if (!ready) throw new Error("请先恢复数据");
    return store.save(state);
  });
  ipcMain.handle("query", (_, q) => queryBangumi(q));
  ipcMain.handle("cache", async (_, input) =>
    Promise.all(
      animeSchema
        .array()
        .parse(input)
        .map(async (a: Anime) => {
          if (!a.cover || a.cover.startsWith("data:image/")) return a;
          try {
            const url = new URL(a.cover);
            if (url.protocol !== "https:" || url.hostname !== "lain.bgm.tv")
              return { ...a, cover: "" };
            const dir = path.join(app.getPath("userData"), "covers");
            await fs.mkdir(dir, { recursive: true });
            const file = path.join(
              dir,
              createHash("sha256").update(a.cover).digest("hex"),
            );
            let cover: string;
            try {
              cover = await fs.readFile(file, "utf8");
            } catch {
              const r = await fetch(url, {
                signal: AbortSignal.timeout(10000),
              });
              if (!r.ok) throw new Error();
              const mime = r.headers.get("content-type") || "";
              if (!/^image\/(png|jpeg|webp|gif)/.test(mime)) throw new Error();
              const bytes = Buffer.from(await r.arrayBuffer());
              if (bytes.length > 10_000_000) throw new Error();
              cover = `data:${mime.split(";")[0]};base64,${bytes.toString("base64")}`;
              await fs.writeFile(file, cover);
            }
            return { ...a, cover };
          } catch {
            return { ...a, cover: "" };
          }
        }),
    ),
  );
  ipcMain.handle("pick-cover", async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    const bytes = await fs.readFile(file);
    if (bytes.length > 10_000_000) throw new Error("封面不能超过 10 MB");
    const ext = path.extname(file).slice(1);
    return `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${bytes.toString("base64")}`;
  });
  ipcMain.handle("export-task", async (_, input) => {
    const task = taskSchema.parse(input);
    const result = await dialog.showSaveDialog(win, {
      defaultPath: task.name.replace(/[\\/:]/g, "_") + ".json",
      filters: [{ name: "任务文件", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return false;
    await fs.writeFile(
      result.filePath,
      JSON.stringify({ version: 1, task }, null, 2),
    );
    return true;
  });
  ipcMain.handle("import-task", async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "任务文件", extensions: ["json"] }],
    });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    if ((await fs.stat(file)).size > 100_000_000)
      throw new Error("任务文件超过 100 MB");
    const { task } = exportSchema.parse(
      JSON.parse(await fs.readFile(file, "utf8")),
    );
    task.id = randomUUID();
    task.entries = task.entries.filter(
      (e, i, all) => all.findIndex((a) => a.anime.id === e.anime.id) === i,
    );
    for (const e of task.entries)
      if (!e.anime.cover.startsWith("data:image/")) e.anime.cover = "";
    return task;
  });
  ipcMain.handle("export-images", async (_, images: string[]) => {
    const result = await dialog.showSaveDialog(win, {
      defaultPath: "动画梯度排行.png",
      filters: [{ name: "PNG 图片", extensions: ["png"] }],
    });
    if (result.canceled || !result.filePath) return false;
    for (let i = 0; i < images.length; i++) {
      if (!images[i].startsWith("data:image/png;base64,"))
        throw new Error("无效图片");
      const file =
        images.length === 1
          ? result.filePath
          : result.filePath.replace(/\.png$/i, "") + `-${i + 1}.png`;
      await fs.writeFile(file, Buffer.from(images[i].split(",")[1], "base64"));
    }
    return true;
  });
  ipcMain.handle("open-subject", (_, id) => {
    if (!Number.isInteger(id) || id <= 0) throw new Error("无效条目");
    return shell.openExternal(`https://bgm.tv/subject/${id}`);
  });
  function createWindow() {
    win = new BrowserWindow({
      width: 1440,
      height: 960,
      minWidth: 1000,
      minHeight: 700,
      title: "动画梯度排行",
      backgroundColor: "#f7f8fa",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e) => e.preventDefault());
    win.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  let flushed = false;
  app.on("before-quit", (event) => {
    if (flushed) return;
    event.preventDefault();
    store
      .flush()
      .then(() => {
        flushed = true;
        app.quit();
      })
      .catch(async () => {
        await dialog.showMessageBox({
          type: "error",
          message: "保存失败，请返回应用重试后再退出。",
        });
      });
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
