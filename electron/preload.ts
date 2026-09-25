import { contextBridge, ipcRenderer } from "electron";
import type { DesktopAPI } from "../src/model";
const api: DesktopAPI = {
  onMenu: (listener) => {
    const handler = (_: unknown, command: Parameters<typeof listener>[0]) =>
      listener(command);
    ipcRenderer.on("menu", handler);
    return () => ipcRenderer.removeListener("menu", handler);
  },
  load: () => ipcRenderer.invoke("load"),
  save: (s) => ipcRenderer.invoke("save", s),
  query: (q) => ipcRenderer.invoke("query", q),
  cache: (a) => ipcRenderer.invoke("cache", a),
  subject: (id) => ipcRenderer.invoke("subject", id),
  pickCover: () => ipcRenderer.invoke("pick-cover"),
  exportTask: (t) => ipcRenderer.invoke("export-task", t),
  importTask: () => ipcRenderer.invoke("import-task"),
  exportImages: (i) => ipcRenderer.invoke("export-images", i),
  openSubject: (id) => ipcRenderer.invoke("open-subject", id),
  openManual: () => ipcRenderer.invoke("open-manual"),
};
contextBridge.exposeInMainWorld("desktop", api);
