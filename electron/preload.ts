import { contextBridge, ipcRenderer } from "electron";
import type { DesktopAPI } from "../src/model";
const api: DesktopAPI = {
  load: () => ipcRenderer.invoke("load"),
  save: (s) => ipcRenderer.invoke("save", s),
  query: (q) => ipcRenderer.invoke("query", q),
  cache: (a) => ipcRenderer.invoke("cache", a),
  pickCover: () => ipcRenderer.invoke("pick-cover"),
  exportTask: (t) => ipcRenderer.invoke("export-task", t),
  importTask: () => ipcRenderer.invoke("import-task"),
  exportImages: (i) => ipcRenderer.invoke("export-images", i),
  openSubject: (id) => ipcRenderer.invoke("open-subject", id),
};
contextBridge.exposeInMainWorld("desktop", api);
