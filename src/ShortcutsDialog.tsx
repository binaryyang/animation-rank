import { useEffect } from "react";
import { tiers } from "./model";
const mod = /Mac/.test(navigator.platform) ? "⌘" : "Ctrl+";
const groups: { title: string; keys: [string, string][] }[] = [
  {
    title: "梯度榜单",
    keys: [
      ["1 – 6", `把悬停或选中的卡片放进「${tiers[0]}」到「${tiers[5]}」`],
      ["0", "移回待评价"],
      ["⌫", "移出榜单"],
      ["方向键", "在卡片之间移动"],
      ["回车", "打开动画详情"],
      [`${mod}点击 / ⇧点击`, "多选卡片"],
      ["右键", "打开卡片菜单"],
      ["Esc", "取消多选"],
    ],
  },
  {
    title: "快捷评价",
    keys: [
      ["1 – 6", "评级并进入下一部"],
      ["S 或 →", "跳过这一部"],
      ["←", "回到上一部"],
      ["Esc", "返回梯度榜单"],
    ],
  },
  {
    title: "通用",
    keys: [
      [`${mod}Z`, "撤销"],
      [`⇧${mod}Z`, "重做"],
      [`${mod}F`, "搜索当前榜单"],
      [`${mod}A`, "全选卡片"],
      [`${mod}1 / ${mod}2`, "切换梯度榜单 / 快捷评价"],
      [`${mod}N`, "新建评价任务"],
      [`⇧${mod}A`, "添加动画"],
      [`${mod}E`, "导出图片"],
      [`${mod}O`, "导入任务文件"],
      ["?", "显示本帮助"],
    ],
  },
];
export function ShortcutsDialog({
  close,
  openManual,
}: {
  close: () => void;
  openManual: () => void;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [close]);
  return (
    <div className="overlay" onClick={close}>
      <div
        className="dialog shortcuts"
        role="dialog"
        aria-label="键盘快捷键"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close" aria-label="关闭帮助" onClick={close}>
          ×
        </button>
        <h2>键盘快捷键</h2>
        <div className="shortcut-groups">
          {groups.map((g) => (
            <section key={g.title}>
              <h3>{g.title}</h3>
              <dl>
                {g.keys.map(([k, v]) => (
                  <div key={k + v}>
                    <dt>
                      <kbd>{k}</kbd>
                    </dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <div className="dialog-actions">
          <button onClick={openManual}>阅读完整使用手册 ↗</button>
          <button className="primary" onClick={close}>
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
