import { useEffect, useState } from "react";
import { Task } from "./model";
import { renderImages } from "./export";
export function ExportPreview({
  task,
  close,
  notify,
}: {
  task: Task;
  close: () => void;
  notify: (message: string) => void;
}) {
  const [showNames, setShowNames] = useState(false),
    [images, setImages] = useState<string[]>([]),
    [page, setPage] = useState(0),
    [busy, setBusy] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let stale = false;
    setBusy(true);
    setImages([]);
    setError("");
    setPage(0);
    renderImages(task, { showNames })
      .then((result) => {
        if (!stale) setImages(result);
      })
      .catch((e) => {
        if (!stale) setError(String(e));
      })
      .finally(() => {
        if (!stale) setBusy(false);
      });
    return () => {
      stale = true;
    };
  }, [task, showNames]);
  async function save() {
    setSaving(true);
    try {
      if (await window.desktop.exportImages(images)) {
        notify("榜单图片已导出");
        close();
      }
    } catch (e) {
      setError("保存失败：" + String(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="overlay">
      <section
        className="export-preview"
        role="dialog"
        aria-modal="true"
        aria-label="导出图片预览"
      >
        <header>
          <div>
            <h2>导出图片预览</h2>
            <small>{task.name}</small>
          </div>
          <button disabled={saving} aria-label="关闭导出预览" onClick={close}>
            ×
          </button>
        </header>
        <div className="preview-options">
          <label>
            <input
              type="checkbox"
              checked={showNames}
              disabled={saving}
              onChange={(e) => {
                setBusy(true);
                setShowNames(e.target.checked);
              }}
            />{" "}
            显示动画名称
          </label>
          <span>1440px · PNG</span>
        </div>
        <div className="preview-canvas">
          {busy ? (
            <p>正在生成预览…</p>
          ) : (
            images[page] && (
              <img src={images[page]} alt={`榜单预览，第 ${page + 1} 页`} />
            )
          )}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <div>
            <button
              disabled={busy || saving || page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              上一页
            </button>
            <span>
              {images.length ? `${page + 1} / ${images.length}` : "—"}
            </span>
            <button
              disabled={busy || saving || page >= images.length - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </button>
          </div>
          <button
            className="primary"
            disabled={busy || saving || !images.length}
            onClick={save}
          >
            {saving ? "保存中…" : "保存图片"}
          </button>
        </footer>
      </section>
    </div>
  );
}
