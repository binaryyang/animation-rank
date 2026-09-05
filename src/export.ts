import { Task, tiers } from "./model";
export const colors = [
  "#ef7973",
  "#f4b16f",
  "#ebd471",
  "#9bca9a",
  "#94b9df",
  "#bac0cd",
];
export async function renderImages(task: Task): Promise<string[]> {
  const width = 1440,
    columns = 10,
    cardW = 118,
    cardH = 204,
    left = 160,
    maxHeight = 2800;
  const groups = tiers.flatMap((label, tier) => {
    const entries = task.entries.filter((e) => e.tier === tier);
    const rows = Math.max(1, Math.ceil(entries.length / columns));
    return Array.from({ length: rows }, (_, i) => ({
      label,
      tier,
      entries: entries.slice(i * columns, (i + 1) * columns),
      continued: i > 0,
    }));
  });
  const perPage = Math.floor((maxHeight - 170) / cardH),
    images: string[] = [];
  for (let start = 0; start < groups.length; start += perPage) {
    const rows = groups.slice(start, start + perPage);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = 150 + rows.length * cardH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f7f8fa";
    ctx.fillRect(0, 0, width, canvas.height);
    ctx.fillStyle = "#202832";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText(task.name, width * 0.035, 57, width - 100);
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#79818c";
    ctx.fillText(
      `动画梯度排行 · ${task.entries.filter((e) => e.tier !== null).length} 部已评价${groups.length > perPage ? ` · 第 ${images.length + 1} 页` : ""}`,
      50,
      94,
    );
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r],
        y = 125 + r * cardH;
      ctx.fillStyle = colors[row.tier];
      ctx.fillRect(30, y, 115, cardH - 8);
      ctx.fillStyle = "#293038";
      ctx.font = "bold 23px sans-serif";
      ctx.fillText(row.label, 43, y + cardH / 2, 90);
      for (let i = 0; i < row.entries.length; i++) {
        const a = row.entries[i].anime,
          x = left + i * (cardW + 8);
        ctx.fillStyle = "#e4e7ec";
        ctx.fillRect(x, y, cardW, 132);
        if (a.cover.startsWith("data:image/")) {
          try {
            const img = new Image();
            img.src = a.cover;
            await img.decode();
            const scale = Math.max(cardW / img.width, 132 / img.height),
              sw = cardW / scale,
              sh = 132 / scale;
            ctx.drawImage(
              img,
              (img.width - sw) / 2,
              (img.height - sh) / 2,
              sw,
              sh,
              x,
              y,
              cardW,
              132,
            );
          } catch {}
        }
        ctx.fillStyle = "#26313e";
        ctx.font = "14px sans-serif";
        let line = "",
          lineNo = 0;
        const chars = [...a.name];
        for (let c = 0; c < chars.length; c++) {
          if (ctx.measureText(line + chars[c]).width > cardW) {
            ctx.fillText(line, x, y + 151 + lineNo * 18);
            lineNo++;
            line = "";
            if (lineNo === 2) {
              let tail = chars.slice(c).join("");
              while (ctx.measureText(tail + "…").width > cardW)
                tail = tail.slice(0, -1);
              ctx.fillText(tail + "…", x, y + 151 + lineNo * 18);
              break;
            }
          }
          line += chars[c];
          if (c === chars.length - 1)
            ctx.fillText(line, x, y + 151 + lineNo * 18);
        }
      }
    }
    images.push(canvas.toDataURL("image/png"));
  }
  return images;
}
