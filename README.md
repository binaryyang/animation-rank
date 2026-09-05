# 动画梯度排行

macOS 本地动画评价工具。支持独立榜单、六级拖拽排序、数字键快捷评价、Bangumi 搜索/季度/公开收藏获取、批量名称匹配、手动添加和离线自动保存。

## 开发与验证

```sh
npm install
npm run dev
npm run check
npm test
npm run test:desktop
npm run pack
node tests/desktop.e2e.cjs --packaged
```

`dev` 编译并启动 Electron，修改后重新运行即可。`pack` 生成当前目标 arm64 的应用，位于 `release/mac-arm64/动画梯度排行.app`。应用未签名公证。

桌面测试在临时目录启动真实 Electron 窗口，覆盖任务创建与管理、拖拽、快捷键、导出、重启和部分失败导入。`npm run test:live` 额外检查 Bangumi 公开搜索和季度接口，需要联网。

## 使用

新建任务时每行输入一个名称可以批量创建。添加动画侧栏绑定打开时的榜单；在线结果勾选后才加入，批量名称需要逐项确认候选。收藏只读取公开信息。

拖拽卡片放入等级，拖到另一张卡片前调整顺序，也可以拖回待评价区。点击卡片查看详情或直接选级。快捷评价使用数字键 1–6，⌘Z 撤销最近评价。“无关心”计入已评价进度。

数据写入 Electron 的 userData 目录（macOS 通常为 `~/Library/Application Support/animation-rank`）。`state.json` 是当前数据，`state.json.bak` 是最近有效备份。每次修改串行写入临时文件后原子替换；保存失败在界面重试。封面缓存在 `covers` 并随任务数据保存，离线仍可评价。

JSON 导出包含一个完整任务及已缓存封面，导入总是创建新任务。PNG 导出只包含六级已评价动画，长榜单自动分成多张图片。在线接口不可用时仍可手动添加；未缓存成功的封面使用名称占位。

## 架构

React 渲染界面，Electron 主进程执行网络和本地文件操作，隔离的 preload 提供有限接口。`src/model.ts` 定义版本化数据与纯评价操作；`electron/service.ts` 封装存储和 Bangumi 映射。测试不依赖在线服务。
