import { useEffect, useState } from "react";
import { Task, tiers } from "./model";
import { colors } from "./export";
import { Cover } from "./Cover";
export function QuickView({
  task,
  disabled,
  rank,
  add,
}: {
  task: Task;
  disabled: boolean;
  rank: (id: string, tier: number) => void;
  add: () => void;
}) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set()),
    [rated, setRated] = useState<string[]>([]),
    [reviewing, setReviewing] = useState<string | null>(null);
  const pending = task.entries.filter((e) => e.tier === null);
  const reviewed = task.entries.find((e) => e.anime.id === reviewing);
  const current =
    reviewed || pending.find((e) => !skipped.has(e.anime.id)) || pending[0];
  const previous = [...rated]
    .reverse()
    .find((id) => task.entries.some((e) => e.anime.id === id));
  function rate(tier: number) {
    if (!current) return;
    const id = current.anime.id;
    rank(id, tier);
    setRated((r) => [...r.filter((x) => x !== id), id]);
    setSkipped((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    setReviewing(null);
  }
  function skip() {
    if (!current || reviewed || pending.length < 2) return;
    const id = current.anime.id;
    let next = new Set(skipped).add(id);
    if (pending.every((e) => next.has(e.anime.id))) next = new Set([id]);
    setSkipped(next);
  }
  function back() {
    if (reviewed) {
      setRated((r) => [...r, reviewed.anime.id]);
      setReviewing(null);
    } else if (previous) {
      setRated((r) => r.filter((x) => x !== previous));
      setReviewing(previous);
    }
  }
  useEffect(() => {
    if (disabled) return;
    function key(e: KeyboardEvent) {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (/^[1-6]$/.test(e.key)) rate(Number(e.key) - 1);
      else if (e.key === "s" || e.key === "S" || e.key === "ArrowRight") skip();
      else if (e.key === "ArrowLeft") back();
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  return (
    <section className="quick-view">
      <span className="eyebrow">ONE ANIME AT A TIME</span>
      {current ? (
        <>
          <h2>
            {reviewed
              ? `回看：当前为「${current.tier === null ? "待评价" : tiers[current.tier]}」，要改成什么？`
              : "这部动画，在你心中是什么梯度？"}
          </h2>
          <Cover anime={current.anime} />
          <h2>{current.anime.name}</h2>
          <div className="quick-meta">
            {current.anime.original &&
              current.anime.original !== current.anime.name && (
                <span>{current.anime.original}</span>
              )}
            {current.anime.date && <span>首播 {current.anime.date}</span>}
          </div>
          {current.anime.summary && (
            <p className="quick-summary">{current.anime.summary}</p>
          )}
          <p>还剩 {pending.length} 部待评价 · 点击等级，或使用数字键 1–6</p>
          <div className="quick-tiers">
            {tiers.map((t, i) => (
              <button
                key={t}
                className={current.tier === i ? "current" : ""}
                style={{ background: colors[i] }}
                onClick={() => rate(i)}
              >
                {t}
                <kbd>{i + 1}</kbd>
              </button>
            ))}
          </div>
          <div className="quick-nav">
            <button disabled={!previous && !reviewed} onClick={back}>
              {reviewed ? "← 返回当前" : "← 上一部"}
            </button>
            <button disabled={!!reviewed || pending.length < 2} onClick={skip}>
              跳过 S / →
            </button>
          </div>
        </>
      ) : (
        <>
          <h2>
            {task.entries.length ? "全部评价完成 ✨" : "还没有待评价的动画"}
          </h2>
          <p>添加更多动画，继续记录你的喜好。</p>
          <div className="quick-nav">
            {previous && <button onClick={back}>← 回看上一部</button>}
            <button onClick={add}>＋ 添加动画</button>
          </div>
        </>
      )}
    </section>
  );
}
