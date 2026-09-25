import { useState } from "react";
import { AnimeEdit, Task, tiers } from "./model";
import { colors } from "./export";
import { Cover } from "./Cover";
export function DetailDialog({
  entry,
  close,
  notify,
  rank,
  remove,
  save,
}: {
  entry: Task["entries"][number];
  close: () => void;
  notify: (message: string) => void;
  rank: (tier: number | null) => void;
  remove: () => void;
  save: (edit: AnimeEdit) => void;
}) {
  const anime = entry.anime;
  const [draft, setDraft] = useState<AnimeEdit | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const edit = (patch: Partial<AnimeEdit>) =>
    setDraft((d) => d && { ...d, ...patch });
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay" onClick={close}>
      <div
        className="dialog detail"
        role="dialog"
        aria-label={draft ? "编辑动画信息" : anime.name}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close" aria-label="关闭详情" onClick={close}>
          ×
        </button>
        {draft ? (
          <div className="form detail-form">
            <Cover anime={draft} />
            <div className="cover-actions">
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const cover = await window.desktop.pickCover();
                    if (cover) edit({ cover });
                  })
                }
              >
                选择本地图片
              </button>
              {anime.bangumiId && (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const fresh = await window.desktop.subject(
                        anime.bangumiId!,
                      );
                      edit({
                        cover: fresh.cover || draft.cover,
                        original: fresh.original || draft.original,
                        date: fresh.date || draft.date,
                        summary: fresh.summary || draft.summary,
                      });
                      if (!fresh.cover)
                        setError("封面获取失败，已保留原封面。");
                    })
                  }
                >
                  {busy ? "获取中…" : "从 Bangumi 重新获取"}
                </button>
              )}
              {draft.cover && (
                <button disabled={busy} onClick={() => edit({ cover: "" })}>
                  移除封面
                </button>
              )}
            </div>
            <label>动画名称 *</label>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => edit({ name: e.target.value })}
            />
            <label>原名</label>
            <input
              value={draft.original}
              onChange={(e) => edit({ original: e.target.value })}
            />
            <label>首播日期</label>
            <input
              value={draft.date}
              placeholder="YYYY-MM-DD"
              onChange={(e) => edit({ date: e.target.value })}
            />
            <label>简介</label>
            <textarea
              rows={5}
              value={draft.summary}
              onChange={(e) => edit({ summary: e.target.value })}
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button onClick={() => setDraft(null)}>取消</button>
              <button
                className="primary"
                disabled={busy || !draft.name.trim()}
                onClick={() => {
                  save(draft);
                  setDraft(null);
                }}
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          <>
            <Cover anime={anime} />
            <span
              className="current-tier"
              style={
                entry.tier === null
                  ? undefined
                  : { background: colors[entry.tier] }
              }
            >
              {entry.tier === null ? "待评价" : `当前：${tiers[entry.tier]}`}
            </span>
            <h2>{anime.name}</h2>
            <p>{anime.original}</p>
            <small>首播日期：{anime.date || "暂无资料"}</small>
            <p className="summary">{anime.summary || "暂无简介"}</p>
            <div className="detail-links">
              <button
                onClick={() =>
                  setDraft({
                    name: anime.name,
                    original: anime.original,
                    date: anime.date,
                    summary: anime.summary,
                    cover: anime.cover,
                  })
                }
              >
                编辑信息
              </button>
              {anime.bangumiId && (
                <button
                  onClick={() =>
                    window.desktop
                      .openSubject(anime.bangumiId!)
                      .catch((e) => notify(String(e)))
                  }
                >
                  在 Bangumi 查看 ↗
                </button>
              )}
            </div>
            <div className="detail-ranks">
              {tiers.map((t, i) => (
                <button
                  key={t}
                  className={entry.tier === i ? "current" : ""}
                  aria-pressed={entry.tier === i}
                  style={{ background: colors[i] }}
                  onClick={() => rank(i)}
                >
                  {entry.tier === i ? `✓ ${t}` : t}
                </button>
              ))}
              {entry.tier !== null && (
                <button onClick={() => rank(null)}>移回待评价</button>
              )}
            </div>
            <button className="danger-text remove-entry" onClick={remove}>
              从榜单移除
            </button>
          </>
        )}
      </div>
    </div>
  );
}
