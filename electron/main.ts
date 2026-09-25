import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  screen,
  shell,
} from "electron";
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  Anime,
  animeSchema,
  coverPrefix,
  exportSchema,
  taskSchema,
} from "../src/model";
import {
  CoverStore,
  Store,
  fetchSubject,
  maxCoverBytes,
  queryBangumi,
} from "./service";
import { installMenu, manualUrl } from "./menu";
import { minWindow, restoreWindow } from "./window-state";
let win: BrowserWindow;
if (process.env.ANIMATION_RANK_DATA_DIR)
  app.setPath("userData", process.env.ANIMATION_RANK_DATA_DIR);
protocol.registerSchemesAsPrivileged([
  {
    scheme: "cover",
    privileges: { standard: true, secure: true, corsEnabled: true },
  },
]);
app.whenReady().then(() => {
  if (!app.isPackaged) {
    app.dock?.setIcon(path.join(__dirname, "../../build/dock-icon.png"));
  }
  const store = new Store(app.getPath("userData"));
  const covers = new CoverStore(path.join(app.getPath("userData"), "images"));
  protocol.handle("cover", async (request) => {
    const target = covers.resolve(request.url);
    if (!target) return new Response(null, { status: 404 });
    try {
      return new Response(await fs.readFile(target.file), {
        headers: {
          "Content-Type": target.mime,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "max-age=31536000, immutable",
        },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  let ready = false;
  ipcMain.handle("load", async () => {
    const result = await store.load();
    const state = await covers.migrate(result.state);
    if (state !== result.state) await store.save(state);
    ready = true;
    return { ...result, state };
  });
  ipcMain.handle("save", (_, state) => {
    if (!ready) throw new Error("请先恢复数据");
    return store.save(state);
  });
  ipcMain.handle("query", (_, q) => queryBangumi(q));
  ipcMain.handle("cache", (_, input) => cache(input));
  ipcMain.handle("subject", async (_, id) => {
    const [anime] = await cache([await fetchSubject(id)]);
    return anime;
  });
  const cache = (input: unknown) =>
    Promise.all(
      animeSchema
        .array()
        .parse(input)
        .map(async (a: Anime) => {
          if (!a.cover) return a;
          if (
            a.cover.startsWith("data:image/") ||
            a.cover.startsWith(coverPrefix)
          )
            return { ...a, cover: await covers.fromDataUrl(a.cover) };
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
            const cached = await fs.readFile(file, "utf8").catch(() => "");
            let cover = cached.startsWith("data:image/")
              ? await covers.fromDataUrl(cached)
              : (await covers.exists(cached))
                ? cached
                : "";
            if (!cover) {
              const r = await fetch(url, {
                signal: AbortSignal.timeout(10000),
              });
              if (!r.ok) throw new Error();
              cover = await covers.put(Buffer.from(await r.arrayBuffer()));
            }
            if (cover !== cached) await fs.writeFile(file, cover);
            return { ...a, cover };
          } catch {
            return { ...a, cover: "" };
          }
        }),
    );
  ipcMain.handle("pick-cover", async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    if ((await fs.stat(file)).size > maxCoverBytes)
      throw new Error("封面不能超过 10 MB");
    return covers.put(await fs.readFile(file));
  });
  ipcMain.handle("export-task", async (_, input) => {
    const task = await covers.externalize(taskSchema.parse(input));
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
    return covers.mapTask(task, (cover) =>
      cover.startsWith("data:image/")
        ? covers.fromDataUrl(cover)
        : Promise.resolve(""),
    );
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
  ipcMain.handle("open-manual", () => shell.openExternal(manualUrl));
  const windowFile = path.join(app.getPath("userData"), "window.json");
  function createWindow() {
    let saved: unknown;
    try {
      saved = JSON.parse(readFileSync(windowFile, "utf8"));
    } catch {}
    const bounds = restoreWindow(
      saved,
      screen.getAllDisplays().map((d) => d.workArea),
    );
    win = new BrowserWindow({
      ...bounds,
      minWidth: minWindow.width,
      minHeight: minWindow.height,
      title: "动画梯度排行",
      backgroundColor: "#f7f8fa",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    if (bounds.maximized) win.maximize();
    const current = win;
    let timer: NodeJS.Timeout | undefined;
    const persist = () => {
      clearTimeout(timer);
      if (current.isDestroyed() || current.isFullScreen()) return;
      const state = {
        ...current.getNormalBounds(),
        maximized: current.isMaximized(),
      };
      fs.writeFile(windowFile, JSON.stringify(state)).catch(() => {});
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(persist, 400);
    };
    win.on("resize", schedule);
    win.on("move", schedule);
    win.on("maximize", schedule);
    win.on("unmaximize", schedule);
    win.on("close", persist);
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e) => e.preventDefault());
    win.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
  installMenu();
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
