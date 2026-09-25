import {
  app,
  BrowserWindow,
  Menu,
  MenuItemConstructorOptions,
  shell,
} from "electron";
import type { MenuCommand } from "../src/model";
const repoUrl = "https://github.com/binaryyang/animation-rank";
export const manualUrl = `${repoUrl}/blob/main/docs/user-guide.md`;
export function installMenu() {
  const send = (command: MenuCommand) => () =>
    (
      BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    )?.webContents.send("menu", command);
  const item = (
    label: string,
    command: MenuCommand,
    accelerator?: string,
  ): MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: send(command),
  });
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [{ role: "appMenu" } as MenuItemConstructorOptions]
      : []),
    {
      label: "文件",
      submenu: [
        item("新建评价任务…", "new-task", "CmdOrCtrl+N"),
        item("添加动画…", "add-anime", "CmdOrCtrl+Shift+A"),
        { type: "separator" },
        item("导入任务文件…", "import", "CmdOrCtrl+O"),
        item("导出任务 JSON…", "export-json", "CmdOrCtrl+Shift+E"),
        item("导出图片…", "export-image", "CmdOrCtrl+E"),
        { type: "separator" },
        { role: "close", label: "关闭窗口" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        item("撤销", "undo", "CmdOrCtrl+Z"),
        item("重做", "redo", "Shift+CmdOrCtrl+Z"),
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "拷贝" },
        { role: "paste", label: "粘贴" },
        item("全选", "select-all", "CmdOrCtrl+A"),
        { type: "separator" },
        item("搜索动画", "find", "CmdOrCtrl+F"),
      ],
    },
    {
      label: "显示",
      submenu: [
        item("梯度榜单", "view-board", "CmdOrCtrl+1"),
        item("快捷评价", "view-quick", "CmdOrCtrl+2"),
        { type: "separator" },
        item("显示 / 隐藏卡片名称", "toggle-names", "CmdOrCtrl+Shift+L"),
        item("显示 / 隐藏侧栏", "toggle-sidebar", "Control+CmdOrCtrl+S"),
        { type: "separator" },
        ...(app.isPackaged
          ? []
          : ([
              { role: "reload" },
              { role: "toggleDevTools" },
            ] as MenuItemConstructorOptions[])),
        { role: "togglefullscreen", label: "进入全屏" },
      ],
    },
    { role: "windowMenu", label: "窗口" },
    {
      role: "help",
      label: "帮助",
      submenu: [
        { label: "使用手册", click: () => shell.openExternal(manualUrl) },
        item("键盘快捷键", "shortcuts", "CmdOrCtrl+/"),
        { type: "separator" },
        {
          label: "反馈问题",
          click: () => shell.openExternal(`${repoUrl}/issues`),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
