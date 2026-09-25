import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Anime,
  DesktopAPI,
  History,
  Query,
  State,
  Task,
  addAnime,
  createTask,
  emptyHistory,
  emptyState,
  mapTask,
  moveEntries,
  record,
  redo,
  removeEntries,
  updateAnime,
  tiers,
  undo,
} from "./model";
import { colors } from "./export";
import { ExportPreview } from "./ExportPreview";
import { Cover } from "./Cover";
import { DetailDialog } from "./DetailDialog";
import { QuickView } from "./QuickView";
import { cardId, focusCard, neighborCard } from "./keyboard";
import "./style.css";
import iconUrl from "../build/icon.png";
declare global {
  interface Window {
    desktop: DesktopAPI;
  }
}
const api = window.desktop;
type Notice = { text: string; action?: "undo" | "redo"; duration: number };
function App() {
  const [state, setState] = useState<State>(emptyState),
    [loaded, setLoaded] = useState(false),
    [saveStatus, setSaveStatus] = useState("正在载入"),
    [notice, setNoticeState] = useState<Notice | null>(null),
    [modal, setModal] = useState<"new" | "rename" | "delete" | null>(null),
    [names, setNames] = useState(""),
    [panel, setPanel] = useState<string | null>(null),
    [detail, setDetail] = useState<string | null>(null),
    [quick, setQuick] = useState(false),
    [filter, setFilter] = useState(""),
    [exporting, setExporting] = useState(false);
  const setNotice = (
    text: string,
    action?: Notice["action"],
    duration = action ? 8000 : 4000,
  ) => {
    setHoverNotice(false);
    setNoticeState(text ? { text, action, duration } : null);
  };
  const [hoverNotice, setHoverNotice] = useState(false);
  useEffect(() => {
    if (!notice || hoverNotice || /失败|异常|无法|Error/.test(notice.text))
      return;
    const timer = window.setTimeout(
      () => setNoticeState(null),
      notice.duration,
    );
    return () => window.clearTimeout(timer);
  }, [notice, hoverNotice]);
  const [preview, setPreview] = useState<Task | null>(null);
  const stateRef = useRef(state);
  const history = useRef<History>(emptyHistory);
  function update(fn: (s: State) => State) {
    stateRef.current = fn(stateRef.current);
    setState(stateRef.current);
  }
  function apply(
    label: string,
    fn: (s: State) => State,
    focus?: string,
    duration?: number,
  ) {
    const previous = stateRef.current,
      next = fn(previous);
    if (next === previous) return;
    history.current = record(history.current, previous, label, focus);
    update(() => next);
    setNotice(label, "undo", duration);
  }
  function travel(direction: "undo" | "redo") {
    const result = (direction === "undo" ? undo : redo)(
      history.current,
      stateRef.current,
    );
    if (!result) return;
    history.current = result.history;
    update(() => result.state);
    setNotice(
      `${direction === "undo" ? "已撤销" : "已重做"}：${result.label}`,
      direction === "undo" ? "redo" : "undo",
    );
  }
  const drag = useRef<string[] | null>(null);
  const dragTask = useRef<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const scrolling = useRef<{ element: HTMLElement; speed: number } | null>(
    null,
  );
  function stopDrag() {
    drag.current = null;
    dragTask.current = null;
    scrolling.current = null;
    setDragging(false);
  }
  useLayoutEffect(() => {
    stopDrag();
  }, [state.activeId, quick, panel, modal, preview]);
  useEffect(() => {
    if (!dragging) return;
    let frame: number;
    let previous = 0;
    const tick = (time: number) => {
      if (scrolling.current)
        scrolling.current.element.scrollTop +=
          (scrolling.current.speed * Math.min(time - (previous || time), 32)) /
          16;
      previous = time;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const cancel = () => stopDrag();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") stopDrag();
    };
    const edge = (event: DragEvent) => {
      const element =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-drag-scroll]")
          : null;
      if (!element) {
        scrolling.current = null;
        return;
      }
      const rect = element.getBoundingClientRect(),
        distance = 48;
      const speed =
        event.clientY < rect.top + distance
          ? -12 * (1 - (event.clientY - rect.top) / distance)
          : event.clientY > rect.bottom - distance
            ? 12 * (1 - (rect.bottom - event.clientY) / distance)
            : 0;
      scrolling.current = speed ? { element, speed } : null;
    };
    const leave = (event: DragEvent) => {
      if (!event.relatedTarget) scrolling.current = null;
    };
    document.addEventListener("dragover", edge);
    document.addEventListener("dragleave", leave);
    document.addEventListener("drop", cancel);
    document.addEventListener("dragend", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(frame);
      scrolling.current = null;
      document.removeEventListener("dragover", edge);
      document.removeEventListener("dragleave", leave);
      document.removeEventListener("drop", cancel);
      document.removeEventListener("dragend", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", escape);
    };
  }, [dragging]);
  function drop(tier: number | null, before?: string) {
    if (drag.current && dragTask.current === task?.id)
      rankMany(drag.current, tier, before);
    stopDrag();
  }
  const revision = useRef(0);
  const task = state.tasks.find((t) => t.id === state.activeId);
  const pending = task?.entries.filter((e) => e.tier === null) || [];
  const detailEntry = task?.entries.find((e) => e.anime.id === detail);
  useEffect(() => {
    api
      .load()
      .then((r) => {
        update(() => r.state);
        setLoaded(true);
        setSaveStatus("已保存到本机");
        if (r.warning) setNotice(r.warning);
      })
      .catch((e) => {
        setSaveStatus("载入失败");
        setNotice(String(e));
      });
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const rev = ++revision.current;
    setSaveStatus("保存中…");
    api
      .save(state)
      .then(() => {
        if (rev === revision.current) setSaveStatus("已保存到本机");
      })
      .catch((e) => {
        if (rev === revision.current) {
          setSaveStatus("保存失败 · 点击重试");
          setNotice(String(e));
        }
      });
  }, [state, loaded]);
  function updateTask(label: string, id: string, fn: (t: Task) => Task) {
    apply(label, (s) => mapTask(s, id, fn), id);
  }
  function rank(id: string, tier: number | null, before?: string) {
    rankMany([id], tier, before);
  }
  function rankMany(ids: string[], tier: number | null, before?: string) {
    if (!task || !ids.length || (before && ids.includes(before))) return;
    const name = task.entries.find((e) => e.anime.id === ids[0])?.anime.name;
    const target = tier === null ? "待评价" : tiers[tier];
    updateTask(
      ids.length === 1
        ? `已将「${name}」移至${target}`
        : `已将 ${ids.length} 部动画移至${target}`,
      task.id,
      (t) => moveEntries(t, ids, tier, before),
    );
  }
  function remove(ids: string[]) {
    if (!task || !ids.length) return;
    setSelected((s) => s.filter((id) => !ids.includes(id)));
    const name = task.entries.find((e) => e.anime.id === ids[0])?.anime.name;
    updateTask(
      ids.length === 1
        ? `已从榜单移除「${name}」`
        : `已从榜单移除 ${ids.length} 部动画`,
      task.id,
      (t) => removeEntries(t, ids),
    );
  }
  const [selected, setSelected] = useState<string[]>([]);
  const selection = selected.filter((id) =>
    task?.entries.some((e) => e.anime.id === id),
  );
  const selectedSet = new Set(selection);
  const anchor = useRef<string | null>(null);
  useLayoutEffect(() => {
    setSelected([]);
    setMenu(null);
  }, [state.activeId, quick]);
  function select(id: string, mode: "toggle" | "range") {
    if (mode === "toggle" || !anchor.current) {
      anchor.current = id;
      setSelected(
        selectedSet.has(id)
          ? selection.filter((x) => x !== id)
          : [...selection, id],
      );
      return;
    }
    const order = [
      ...document.querySelectorAll<HTMLElement>("[data-anime-id]"),
    ].map((el) => el.dataset.animeId!);
    const [a, b] = [order.indexOf(anchor.current), order.indexOf(id)].sort(
      (x, y) => x - y,
    );
    if (a < 0) return select(id, "toggle");
    setSelected([...new Set([...selection, ...order.slice(a, b + 1)])]);
  }
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    ids: string[];
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!menu || !el) return;
    const { width, height } = el.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(menu.x, innerWidth - width - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(menu.y, innerHeight - height - 8))}px`;
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const outside = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".context-menu")) close();
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("wheel", close, { passive: true });
    window.addEventListener("keydown", escape);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("wheel", close);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [menu]);
  const overlayOpen = !!(modal || panel || detailEntry || preview || menu);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true]",
        ) ||
        overlayOpen
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ") {
        e.preventDefault();
        travel(e.shiftKey ? "redo" : "undo");
      } else if ((e.metaKey || e.ctrlKey) && e.code === "KeyA" && !quick) {
        e.preventDefault();
        setSelected(
          [...document.querySelectorAll<HTMLElement>("[data-anime-id]")].map(
            (el) => el.dataset.animeId!,
          ),
        );
      } else if (e.key === "Escape") {
        if (selection.length) setSelected([]);
        else setQuick(false);
      } else if (!quick && task && !e.metaKey && !e.ctrlKey && !e.altKey)
        boardKey(e);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const pointerActive = useRef(true);
  useEffect(() => {
    const move = () => (pointerActive.current = true);
    document.addEventListener("mousemove", move);
    return () => document.removeEventListener("mousemove", move);
  }, []);
  const refocus = useRef<string | null>(null);
  useEffect(() => {
    if (refocus.current && focusCard(refocus.current)) refocus.current = null;
  });
  function boardKey(e: KeyboardEvent) {
    const active = document.activeElement as HTMLElement | null;
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      pointerActive.current = false;
      const next = neighborCard(
        active?.matches(".card-button") ? active : null,
        e.key,
      );
      next?.focus();
      next?.scrollIntoView({ block: "nearest" });
      return;
    }
    const isAction =
      /^[0-6]$/.test(e.key) || e.key === "Delete" || e.key === "Backspace";
    if (isAction && selection.length) {
      e.preventDefault();
      if (/^[0-6]$/.test(e.key))
        rankMany(selection, e.key === "0" ? null : Number(e.key) - 1);
      else remove(selection);
      return;
    }
    const hovered = pointerActive.current
      ? cardId(document.querySelector(".anime-card:hover"))
      : null;
    const id = hovered ?? cardId(active);
    if (!id || !task?.entries.some((entry) => entry.anime.id === id)) return;
    if (/^[0-6]$/.test(e.key)) {
      e.preventDefault();
      const tier = e.key === "0" ? null : Number(e.key) - 1;
      if (task.entries.find((entry) => entry.anime.id === id)?.tier === tier)
        return;
      if (cardId(active) === id) refocus.current = id;
      rank(id, tier);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const next =
        cardId(active) === id
          ? (cardId(neighborCard(active, "ArrowRight")) ??
            cardId(neighborCard(active, "ArrowLeft")))
          : null;
      if (next) refocus.current = next;
      remove([id]);
    }
  }
  async function importFile() {
    try {
      const t = await api.importTask();
      if (t)
        apply(`已导入「${t.name}」`, (s) => ({
          ...s,
          tasks: [...s.tasks, t],
          activeId: t.id,
        }));
    } catch (e) {
      setNotice("任务导入失败：" + String(e));
    }
  }
  async function exportFile(image: boolean) {
    if (!task) return;
    if (image) {
      setPreview(structuredClone(task));
      return;
    }
    setExporting(true);
    try {
      const ok = await api.exportTask(task);
      if (ok) setNotice(image ? "榜单图片已导出" : "任务文件已导出");
    } catch (e) {
      setNotice("导出失败：" + String(e));
    } finally {
      setExporting(false);
    }
  }
  function submit() {
    if (modal === "new") {
      const tasks = names
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean)
        .map(createTask);
      if (!tasks.length) return;
      apply(`已新建 ${tasks.length} 份榜单`, (s) => ({
        ...s,
        tasks: [...s.tasks, ...tasks],
        activeId: tasks[0].id,
      }));
    } else if (modal === "rename" && task && names.trim())
      updateTask(`已重命名为「${names.trim()}」`, task.id, (t) => ({
        ...t,
        name: names.trim(),
      }));
    else if (modal === "delete" && task)
      apply(
        `已删除「${task.name}」`,
        (s) => {
          const tasks = s.tasks.filter((t) => t.id !== task.id);
          return { ...s, tasks, activeId: tasks[0]?.id || null };
        },
        undefined,
        15000,
      );
    setModal(null);
  }
  function openModal(type: "new" | "rename" | "delete") {
    setNames(type === "rename" ? task?.name || "" : "");
    setModal(type);
  }
  function card(a: Anime, tier: number | null) {
    return (
      <div
        className={"anime-card" + (selectedSet.has(a.id) ? " selected" : "")}
        key={a.id}
        data-anime-id={a.id}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({
            x: e.clientX,
            y: e.clientY,
            ids: selectedSet.has(a.id) ? selection : [a.id],
          });
        }}
        draggable
        onDragStart={(e) => {
          drag.current = selectedSet.has(a.id) ? selection : [a.id];
          dragTask.current = task?.id || null;
          setDragging(true);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", a.id);
        }}
        onDragEnd={stopDrag}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          drop(tier, a.id);
        }}
      >
        <button
          className="card-button"
          title={a.name}
          aria-label={a.name}
          aria-pressed={selectedSet.has(a.id)}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey) select(a.id, "toggle");
            else if (e.shiftKey) select(a.id, "range");
            else {
              setSelected([]);
              setDetail(a.id);
            }
          }}
        >
          <Cover anime={a} />
          {(tier === null || state.preferences.showNames) && (
            <span title={a.name}>{a.name}</span>
          )}
        </button>
      </div>
    );
  }
  return (
    <div
      className={
        "app" +
        (state.preferences.sidebarCollapsed ? " sidebar-collapsed" : "") +
        (selection.length && !quick ? " has-selection" : "")
      }
    >
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <img src={iconUrl} alt="" />
          </div>
          <div>
            <strong>动画梯度</strong>
            <small>ANIME TIER STUDIO</small>
          </div>
        </div>
        <button
          className="primary new-task"
          onClick={() => openModal("new")}
          disabled={!loaded}
        >
          ＋ 新建评价任务
        </button>
        <div className="section-label">
          我的榜单 <span>{state.tasks.length}</span>
        </div>
        <nav>
          {state.tasks.map((t) => {
            const count = t.entries.filter((e) => e.tier !== null).length;
            return (
              <button
                key={t.id}
                className={"task-link " + (task?.id === t.id ? "active" : "")}
                onClick={() => {
                  update((s) => ({ ...s, activeId: t.id }));
                  setQuick(false);
                  setFilter("");
                }}
              >
                <span className="task-symbol">▤</span>
                <div>
                  <strong>{t.name}</strong>
                  <small>
                    {count} / {t.entries.length} 部已评价
                  </small>
                  <div className="mini-progress">
                    <i
                      style={{
                        width: `${t.entries.length ? (count / t.entries.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
        <button className="import-task" onClick={importFile} disabled={!loaded}>
          ↥ 导入任务文件
        </button>
        <div className="local-info">
          <span className="status-dot" /> 本地工作空间
          <small>每一份喜好，都值得留下。</small>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <button
            className="sidebar-toggle"
            aria-label={
              state.preferences.sidebarCollapsed ? "展开侧栏" : "收起侧栏"
            }
            aria-expanded={!state.preferences.sidebarCollapsed}
            disabled={!loaded}
            onClick={() =>
              update((s) => ({
                ...s,
                preferences: {
                  ...s.preferences,
                  sidebarCollapsed: !s.preferences.sidebarCollapsed,
                },
              }))
            }
          >
            ☰
          </button>
          <span>
            我的榜单 <span className="slash">/</span>{" "}
            {task?.name || "开始一份新榜单"}
          </span>
          <button
            className="save-status"
            onClick={() => update((s) => ({ ...s }))}
            disabled={!loaded}
          >
            ◉ {saveStatus}
          </button>
        </header>
        {notice && (
          <div
            className="notice"
            role="status"
            onMouseEnter={() => setHoverNotice(true)}
            onMouseLeave={() => setHoverNotice(false)}
          >
            <span>{notice.text}</span>
            {notice.action && (
              <button
                className="notice-action"
                onClick={() => travel(notice.action!)}
              >
                {notice.action === "undo" ? "撤销" : "重做"}
              </button>
            )}
            <button aria-label="关闭提示" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
        {!task ? (
          <div className="empty-workspace">
            <div className="empty-art">✦</div>
            <span className="eyebrow">YOUR TASTE, YOUR TIERS</span>
            <h1>好动画，值得一个位置。</h1>
            <p>创建一份榜单，把心中的动画放进属于它的梯度。</p>
            <button
              className="primary"
              disabled={!loaded}
              onClick={() => openModal("new")}
            >
              ＋ 创建第一份评价任务
            </button>
            <div className="tier-preview">
              {tiers.map((t, i) => (
                <span style={{ background: colors[i] }} key={t}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <>
            <section className="heading">
              <div>
                <h1>{task.name}</h1>
                <p>
                  {task.entries.length} 部动画 <span>·</span>{" "}
                  {task.entries.length - pending.length} 部已评价
                </p>
              </div>
              <div className="heading-actions">
                <button onClick={() => openModal("rename")}>重命名</button>
                <button
                  onClick={() => {
                    const copy = {
                      ...task,
                      id: crypto.randomUUID(),
                      name: task.name + " · 副本",
                      createdAt: new Date().toISOString(),
                      entries: structuredClone(task.entries),
                    };
                    apply(`已复制为「${copy.name}」`, (s) => ({
                      ...s,
                      tasks: [...s.tasks, copy],
                      activeId: copy.id,
                    }));
                  }}
                >
                  复制
                </button>
                <button
                  className="danger-text"
                  onClick={() => openModal("delete")}
                >
                  删除
                </button>
              </div>
            </section>
            <section className="toolbar">
              <div className="segmented">
                <button
                  className={!quick ? "selected" : ""}
                  onClick={() => setQuick(false)}
                >
                  ▦ 梯度榜单
                </button>
                <button
                  className={quick ? "selected" : ""}
                  onClick={() => setQuick(true)}
                >
                  ϟ 快捷评价
                </button>
              </div>
              <div className="tools">
                {!quick && (
                  <label className="names-toggle">
                    <input
                      type="checkbox"
                      checked={state.preferences.showNames}
                      onChange={(e) =>
                        update((s) => ({
                          ...s,
                          preferences: {
                            ...s.preferences,
                            showNames: e.target.checked,
                          },
                        }))
                      }
                    />
                    显示名称
                  </label>
                )}
                <button
                  title="撤销 ⌘Z"
                  onClick={() => travel("undo")}
                  disabled={!history.current.past.length}
                >
                  ↶ 撤销
                </button>
                <button
                  title="重做 ⇧⌘Z"
                  onClick={() => travel("redo")}
                  disabled={!history.current.future.length}
                >
                  ↷ 重做
                </button>
                <button disabled={exporting} onClick={() => exportFile(false)}>
                  任务 JSON
                </button>
                <button disabled={exporting} onClick={() => exportFile(true)}>
                  ↗ {exporting ? "导出中…" : "导出图片"}
                </button>
                <button className="primary" onClick={() => setPanel(task.id)}>
                  ＋ 添加动画
                </button>
              </div>
            </section>
            {quick ? (
              <QuickView
                key={task.id}
                task={task}
                disabled={overlayOpen}
                rank={rank}
                add={() => setPanel(task.id)}
              />
            ) : (
              <div className="ranking-workspace">
                <div className="board-column">
                  <div className="board-scroll" data-drag-scroll>
                    <section className="board">
                      {tiers.map((tier, i) => (
                        <div
                          className="tier-row"
                          key={tier}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            drop(i);
                          }}
                        >
                          <div
                            className="tier-label"
                            style={{ background: colors[i] }}
                          >
                            <strong>{tier}</strong>
                            <small>
                              {task.entries.filter((e) => e.tier === i).length}{" "}
                              部
                            </small>
                          </div>
                          <div className="tier-content">
                            {task.entries
                              .filter((e) => e.tier === i)
                              .map((e) => card(e.anime, i))}
                            {!task.entries.some((e) => e.tier === i) && (
                              <span className="drop-hint">拖动动画到这里</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </section>
                  </div>
                  {selection.length ? (
                    <div className="selection-bar" role="toolbar">
                      <strong>已选 {selection.length} 部</strong>
                      {tiers.map((t, i) => (
                        <button
                          key={t}
                          style={{ background: colors[i] }}
                          onClick={() => rankMany(selection, i)}
                        >
                          {t}
                        </button>
                      ))}
                      <button onClick={() => rankMany(selection, null)}>
                        待评价
                      </button>
                      <button
                        className="danger-text"
                        onClick={() => remove(selection)}
                      >
                        移除
                      </button>
                      <button
                        title="取消选择 Esc"
                        onClick={() => setSelected([])}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <p className="board-hint">
                      悬停或用方向键选中卡片：1–6 评级 · 0 移回待评价 · ⌫ 移除 ·
                      ⌘/⇧ 点击多选
                    </p>
                  )}
                </div>
                <section
                  className="pending"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    drop(null);
                  }}
                >
                  <div className="pending-header">
                    <h2>
                      待评价 <span>{pending.length}</span>
                    </h2>
                    <input
                      placeholder="搜索待评价动画…"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  </div>
                  <div className="pending-cards" data-drag-scroll>
                    {pending
                      .filter(
                        (e) =>
                          e.anime.name.includes(filter) ||
                          e.anime.original.includes(filter),
                      )
                      .map((e) => card(e.anime, null))}
                    {!pending.length && (
                      <div className="pending-empty">
                        <span>＋</span>
                        <p>
                          {task.entries.length
                            ? "所有动画都已找到位置"
                            : "你的下一部心头好，从这里开始"}
                        </p>
                        <button onClick={() => setPanel(task.id)}>
                          搜索、导入或手动添加动画 →
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </main>
      {menu && (
        <div className="context-menu" role="menu" ref={menuRef}>
          {menu.ids.length > 1 && <small>{menu.ids.length} 部动画</small>}
          {tiers.map((t, i) => (
            <button
              role="menuitem"
              key={t}
              onClick={() => {
                rankMany(menu.ids, i);
                setMenu(null);
              }}
            >
              <i style={{ background: colors[i] }} />
              {t}
              <kbd>{i + 1}</kbd>
            </button>
          ))}
          <button
            role="menuitem"
            onClick={() => {
              rankMany(menu.ids, null);
              setMenu(null);
            }}
          >
            <i />
            移回待评价
            <kbd>0</kbd>
          </button>
          <hr />
          {menu.ids.length === 1 && (
            <button
              role="menuitem"
              onClick={() => {
                setDetail(menu.ids[0]);
                setMenu(null);
              }}
            >
              <i />
              查看详情 / 编辑
            </button>
          )}
          <button
            role="menuitem"
            className="danger-text"
            onClick={() => {
              remove(menu.ids);
              setMenu(null);
            }}
          >
            <i />
            从榜单移除
            <kbd>⌫</kbd>
          </button>
        </div>
      )}
      {preview && (
        <ExportPreview
          task={preview}
          close={() => setPreview(null)}
          notify={setNotice}
        />
      )}
      {panel && (
        <ImportPanel
          target={state.tasks.find((t) => t.id === panel)}
          close={() => setPanel(null)}
          notify={setNotice}
          add={(items, message) =>
            updateTask(message, panel, (t) => addAnime(t, items))
          }
        />
      )}
      {modal && (
        <div className="overlay">
          <div className="dialog">
            <button className="close" onClick={() => setModal(null)}>
              ×
            </button>
            <span className="eyebrow">YOUR NEXT COLLECTION</span>
            <h2>
              {modal === "new"
                ? "创建评价任务"
                : modal === "rename"
                  ? "重命名任务"
                  : "删除这份榜单？"}
            </h2>
            {modal === "delete" ? (
              <p>
                “{task?.name}
                ”及其评价将被删除。其他榜单不会受到影响，删除后可以撤销（⌘Z）。
              </p>
            ) : (
              <>
                <p>
                  {modal === "new"
                    ? "每行一个名称，可以一次创建多个独立榜单。"
                    : "为这份榜单起一个新名字。"}
                </p>
                <textarea
                  autoFocus
                  value={names}
                  onChange={(e) => setNames(e.target.value)}
                  placeholder={"2026 夏季新番\n那些反复重看的动画"}
                  rows={modal === "new" ? 4 : 2}
                />
              </>
            )}
            <div className="dialog-actions">
              <button onClick={() => setModal(null)}>取消</button>
              <button
                className={modal === "delete" ? "danger" : "primary"}
                disabled={modal !== "delete" && !names.trim()}
                onClick={submit}
              >
                {modal === "delete" ? "删除任务" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
      {detailEntry && task && (
        <DetailDialog
          entry={detailEntry}
          close={() => setDetail(null)}
          notify={setNotice}
          rank={(tier) => {
            rank(detailEntry.anime.id, tier);
            setDetail(null);
          }}
          remove={() => {
            remove([detailEntry.anime.id]);
            setDetail(null);
          }}
          save={(edit) =>
            updateTask(`已更新「${edit.name.trim()}」`, task.id, (t) =>
              updateAnime(t, detailEntry.anime.id, edit),
            )
          }
        />
      )}
    </div>
  );
}

function ImportPanel({
  target,
  close,
  add,
  notify,
}: {
  target: Task | undefined;
  close: () => void;
  add: (a: Anime[], message: string) => void;
  notify: (s: string) => void;
}) {
  const [mode, setMode] = useState<
      "search" | "season" | "batch" | "manual" | "collection"
    >("search"),
    [keyword, setKeyword] = useState(""),
    [year, setYear] = useState(new Date().getFullYear()),
    [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1),
    [status, setStatus] = useState(2),
    [items, setItems] = useState<Anime[]>([]),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [total, setTotal] = useState(0),
    [offset, setOffset] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [batch, setBatch] = useState<
      { name: string; candidates: Anime[]; chosen: string; error?: string }[]
    >([]),
    [manual, setManual] = useState({
      name: "",
      original: "",
      date: "",
      summary: "",
      cover: "",
    });
  const activeQuery = useRef<Query | null>(null);
  const generation = useRef(0);
  function changeMode(next: typeof mode) {
    generation.current++;
    setMode(next);
    setItems([]);
    setSelected(new Set());
    setBatch([]);
    setError("");
    setBusy(false);
    setKeyword("");
    activeQuery.current = null;
  }
  async function search(more = false) {
    const token = ++generation.current;
    setBusy(true);
    setError("");
    if (!more) {
      setItems([]);
      setSelected(new Set());
      setTotal(0);
      setOffset(0);
    }
    const q: Query =
      more && activeQuery.current
        ? { ...activeQuery.current, offset: offset + 30 }
        : {
            mode: mode as Query["mode"],
            keyword,
            year,
            quarter,
            status,
            offset: 0,
          };
    activeQuery.current = q;
    try {
      const page = await api.query(q);
      const cached = await api.cache(page.items);
      if (token !== generation.current) return;
      setItems((old) =>
        more
          ? [...old, ...cached.filter((a) => !old.some((o) => o.id === a.id))]
          : cached,
      );
      if (!more) setSelected(new Set());
      setTotal(page.total);
      setOffset(q.offset);
    } catch (e) {
      if (token === generation.current) setError(String(e));
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  async function matchBatch() {
    const token = ++generation.current;
    setBusy(true);
    setError("");
    const rows: {
      name: string;
      candidates: Anime[];
      chosen: string;
      error?: string;
    }[] = [];
    for (const name of [
      ...new Set(
        keyword
          .split("\n")
          .map((n) => n.trim())
          .filter(Boolean),
      ),
    ]) {
      try {
        const page = await api.query({
          mode: "search",
          keyword: name,
          offset: 0,
        });
        const candidates = await api.cache(page.items.slice(0, 5));
        rows.push({ name, candidates, chosen: "" });
      } catch (e) {
        rows.push({ name, candidates: [], chosen: "", error: String(e) });
      }
      if (token !== generation.current) return;
      setBatch([...rows]);
    }
    setBusy(false);
  }
  async function commit(anime: Anime[]) {
    if (!target) {
      setError("目标任务已删除，请关闭面板后重新选择任务。");
      return;
    }
    const duplicates = anime.filter(
      (a) =>
        !a.bangumiId &&
        target.entries.some((e) => e.anime.name.trim() === a.name.trim()),
    );
    if (
      duplicates.length &&
      !confirm(`存在 ${duplicates.length} 个手动同名条目，仍然添加？`)
    )
      return;
    const fresh = anime.filter(
      (a) => !target.entries.some((e) => e.anime.id === a.id),
    );
    const message = `已向「${target.name}」添加 ${fresh.length} 部动画${anime.length !== fresh.length ? `，跳过 ${anime.length - fresh.length} 个重复条目` : ""}`;
    if (fresh.length) add(fresh, message);
    else notify(message);
    close();
  }
  const newManual = (name: string): Anime => ({
    id: crypto.randomUUID(),
    name,
    original: "",
    date: "",
    summary: "",
    cover: "",
  });
  return (
    <div className="panel-backdrop">
      <aside className="import-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">GROW YOUR COLLECTION</span>
            <h2>添加动画</h2>
          </div>
          <button onClick={close}>×</button>
        </div>
        <p className="target-note">
          加入榜单：<b>{target?.name || "任务已删除"}</b>
        </p>
        <div className="source-tabs">
          {(
            [
              ["search", "搜索"],
              ["season", "季度"],
              ["batch", "批量名称"],
              ["manual", "手动"],
              ["collection", "收藏"],
            ] as const
          ).map(([m, label]) => (
            <button
              className={mode === m ? "selected" : ""}
              key={m}
              onClick={() => changeMode(m)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="panel-body">
          {mode === "manual" ? (
            <div className="form">
              <label>动画名称 *</label>
              <input
                value={manual.name}
                onChange={(e) => setManual({ ...manual, name: e.target.value })}
                placeholder="例如：葬送的芙莉莲"
              />
              <label>原名</label>
              <input
                value={manual.original}
                onChange={(e) =>
                  setManual({ ...manual, original: e.target.value })
                }
              />
              <label>首播日期</label>
              <input
                type="date"
                value={manual.date}
                onChange={(e) => setManual({ ...manual, date: e.target.value })}
              />
              <label>简介</label>
              <textarea
                rows={5}
                value={manual.summary}
                onChange={(e) =>
                  setManual({ ...manual, summary: e.target.value })
                }
              />
              <label>封面</label>
              <button
                onClick={async () => {
                  try {
                    const cover = await api.pickCover();
                    if (cover) setManual({ ...manual, cover });
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                ＋ 选择本地图片
              </button>
              {manual.cover && (
                <img className="manual-cover" src={manual.cover} />
              )}
            </div>
          ) : (
            <>
              {mode === "season" ? (
                <div className="search-row">
                  <input
                    aria-label="年份"
                    type="number"
                    min="1900"
                    max="2200"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  />
                  <select
                    aria-label="季度"
                    value={quarter}
                    onChange={(e) => setQuarter(Number(e.target.value))}
                  >
                    {[
                      "冬季 · 1–3 月",
                      "春季 · 4–6 月",
                      "夏季 · 7–9 月",
                      "秋季 · 10–12 月",
                    ].map((s, i) => (
                      <option value={i + 1} key={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              ) : mode === "batch" ? (
                <>
                  <p>
                    每行一个动画名称。搜索后，请逐项确认候选或选择手动添加。
                  </p>
                  <textarea
                    rows={6}
                    placeholder={"葬送的芙莉莲\n进击的巨人\n紫罗兰永恒花园"}
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                </>
              ) : (
                <input
                  className="search-input"
                  placeholder={
                    mode === "collection"
                      ? "Bangumi 用户名或主页链接"
                      : "搜索中文名 / 原名…"
                  }
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy && keyword.trim()) search();
                  }}
                />
              )}
              {mode === "collection" && (
                <label className="collection-status">
                  收藏状态{" "}
                  <select
                    value={status}
                    onChange={(e) => setStatus(Number(e.target.value))}
                  >
                    {["想看", "看过", "在看", "搁置", "抛弃"].map((s, i) => (
                      <option key={s} value={i + 1}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                className="primary search-submit"
                disabled={busy || (mode !== "season" && !keyword.trim())}
                onClick={() => (mode === "batch" ? matchBatch() : search())}
              >
                {busy
                  ? "正在获取…"
                  : mode === "batch"
                    ? "匹配动画名称"
                    : mode === "season"
                      ? "获取季度动画"
                      : mode === "collection"
                        ? "获取公开收藏"
                        : "搜索动画"}
              </button>
              {mode === "batch" ? (
                batch.map((row, index) => (
                  <div className="batch-row" key={row.name}>
                    <strong>{row.name}</strong>
                    {row.error && (
                      <small className="error">
                        {row.error} 可重新匹配或手动添加。
                      </small>
                    )}
                    <select
                      aria-label={row.name + "匹配候选"}
                      value={row.chosen}
                      onChange={(e) =>
                        setBatch((old) =>
                          old.map((r, i) =>
                            i === index ? { ...r, chosen: e.target.value } : r,
                          ),
                        )
                      }
                    >
                      <option value="">跳过 / 请选择候选</option>
                      {row.candidates.map((a) => (
                        <option value={a.id} key={a.id}>
                          {a.name} {a.date ? `（${a.date}）` : ""}
                        </option>
                      ))}
                      <option value="manual">作为手动条目添加</option>
                    </select>
                  </div>
                ))
              ) : (
                <>
                  <div className="results-header">
                    <span>
                      {activeQuery.current
                        ? `找到 ${total} 部动画`
                        : "搜索动画，开启你的榜单"}
                    </span>
                    {items.length > 0 && (
                      <button
                        onClick={() =>
                          setSelected(
                            selected.size === items.length
                              ? new Set()
                              : new Set(items.map((a) => a.id)),
                          )
                        }
                      >
                        {selected.size === items.length
                          ? "取消全选"
                          : "选择已加载"}
                      </button>
                    )}
                  </div>
                  <div className="results">
                    {items.map((a) => (
                      <button
                        key={a.id}
                        className={
                          "result " + (selected.has(a.id) ? "checked" : "")
                        }
                        onClick={() =>
                          setSelected((old) => {
                            const next = new Set(old);
                            next.has(a.id) ? next.delete(a.id) : next.add(a.id);
                            return next;
                          })
                        }
                      >
                        <Cover anime={a} />
                        <div>
                          <strong>{a.name}</strong>
                          <small>{a.original}</small>
                          <small>{a.date || "首播日期未知"}</small>
                        </div>
                        <span className="checkbox">
                          {selected.has(a.id) ? "✓" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                  {items.length === 0 && !busy && (
                    <div className="search-empty">
                      ✧
                      <p>
                        {activeQuery.current
                          ? "暂无结果，试试其他名称或手动添加。"
                          : "按名字寻找，或从一整个季度开始。"}
                      </p>
                    </div>
                  )}
                  {offset + 30 < total && (
                    <button
                      disabled={busy}
                      className="load-more"
                      onClick={() => search(true)}
                    >
                      加载更多
                    </button>
                  )}
                </>
              )}
            </>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <p>修改输入或再次点击获取按钮重试。</p>
            </div>
          )}
        </div>
        <div className="panel-footer">
          <span>
            {mode === "manual"
              ? "支持离线手动添加"
              : mode === "batch"
                ? `已确认 ${batch.filter((r) => r.chosen).length} 部`
                : `已选择 ${selected.size} 部`}
          </span>
          <button
            className="primary"
            disabled={
              busy ||
              !target ||
              (mode === "manual"
                ? !manual.name.trim()
                : mode === "batch"
                  ? !batch.some((r) => r.chosen)
                  : !selected.size)
            }
            onClick={() => {
              if (mode === "manual")
                commit([
                  {
                    id: crypto.randomUUID(),
                    ...manual,
                    name: manual.name.trim(),
                  },
                ]);
              else if (mode === "batch")
                commit(
                  batch
                    .filter((r) => r.chosen)
                    .map((r) =>
                      r.chosen === "manual"
                        ? newManual(r.name)
                        : r.candidates.find((a) => a.id === r.chosen)!,
                    ),
                );
              else commit(items.filter((a) => selected.has(a.id)));
            }}
          >
            加入榜单 →
          </button>
        </div>
      </aside>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
