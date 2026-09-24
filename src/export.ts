import { Anime, Task, tiers } from "./model";
export const colors = [
  "#ef7973",
  "#f4b16f",
  "#ebd471",
  "#9bca9a",
  "#94b9df",
  "#bac0cd",
];
export type ExportOptions = { showNames: boolean };
export type ExportBlock = {
  tier: number;
  rows: Anime[][];
  continued: boolean;
  y: number;
  height: number;
};
export type ExportPage = { blocks: ExportBlock[]; height: number };
const width = 1440,
  top = 148,
  bottom = 40,
  maxHeight = 2800,
  columns = 10,
  coverWidth = 112,
  coverHeight = 168,
  gap = 12;
export function layoutExport(task: Task, options: ExportOptions): ExportPage[] {
  const rowHeight = options.showNames ? 238 : 184;
  const pages: ExportPage[] = [];
  let page: ExportPage = { blocks: [], height: top };
  const finish = () => {
    page.height += bottom;
    pages.push(page);
    page = { blocks: [], height: top };
  };
  for (let tier = 0; tier < tiers.length; tier++) {
    const entries = task.entries
      .filter((e) => e.tier === tier)
      .map((e) => e.anime);
    if (!entries.length) {
      if (page.height + 60 + bottom > maxHeight) finish();
      page.blocks.push({
        tier,
        rows: [],
        continued: false,
        y: page.height,
        height: 48,
      });
      page.height += 60;
      continue;
    }
    const rows = Array.from(
      { length: Math.ceil(entries.length / columns) },
      (_, i) => entries.slice(i * columns, (i + 1) * columns),
    );
    let cursor = 0;
    while (cursor < rows.length) {
      const capacity = Math.floor(
        (maxHeight - bottom - page.height - 32) / rowHeight,
      );
      if (capacity < 1) {
        finish();
        continue;
      }
      const chunk = rows.slice(cursor, cursor + capacity),
        height = chunk.length * rowHeight + 20;
      page.blocks.push({
        tier,
        rows: chunk,
        continued: cursor > 0,
        y: page.height,
        height,
      });
      page.height += height + 12;
      cursor += chunk.length;
      if (cursor < rows.length) finish();
    }
  }
  if (page.blocks.length) finish();
  return pages;
}
function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function textLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
) {
  const chars = [...text];
  let cursor = 0;
  for (let line = 0; line < maxLines && cursor < chars.length; line++) {
    let value = "";
    while (
      cursor < chars.length &&
      ctx.measureText(value + chars[cursor]).width <= maxWidth
    ) {
      value += chars[cursor++];
    }
    if (line === maxLines - 1 && cursor < chars.length) {
      while (value && ctx.measureText(value + "…").width > maxWidth)
        value = value.slice(0, -1);
      value += "…";
    }
    ctx.fillText(value, x, y + line * lineHeight);
  }
}
export async function renderImages(
  task: Task,
  options: ExportOptions = { showNames: false },
): Promise<string[]> {
  const pages = layoutExport(task, options),
    output: string[] = [];
  const decoded = new Map<string, Promise<HTMLImageElement | null>>();
  const decode = (cover: string) => {
    if (!decoded.has(cover))
      decoded.set(
        cover,
        (async () => {
          if (!cover.startsWith("data:image/")) return null;
          try {
            const image = new Image();
            image.src = cover;
            await image.decode();
            return image;
          } catch {
            return null;
          }
        })(),
      );
    return decoded.get(cover)!;
  };
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p],
      canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = page.height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f5f6f8";
    ctx.fillRect(0, 0, width, page.height);
    rounded(ctx, 32, 35, 5, 48, 2, "#346757");
    ctx.fillStyle = "#24352f";
    ctx.font = "600 32px sans-serif";
    textLines(ctx, task.name, 52, 66, 1180, 38, 1);
    ctx.fillStyle = "#819087";
    ctx.font = "15px sans-serif";
    ctx.fillText(
      `动画梯度排行  /  ${task.entries.filter((e) => e.tier !== null).length} 部已评价`,
      52,
      102,
    );
    ctx.textAlign = "right";
    ctx.fillText(`${p + 1} / ${pages.length}`, 1408, 66);
    ctx.textAlign = "left";
    for (const block of page.blocks) {
      rounded(ctx, 32, block.y, 1376, block.height, 12, "#ffffff");
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(32, block.y, 1376, block.height, 12);
      ctx.clip();
      ctx.fillStyle = colors[block.tier];
      ctx.fillRect(32, block.y, 116, block.height);
      ctx.restore();
      ctx.fillStyle = "#303c39";
      ctx.font = "600 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        tiers[block.tier],
        90,
        block.y + block.height / 2 + (block.continued ? -3 : 8),
      );
      if (block.continued) {
        ctx.font = "12px sans-serif";
        ctx.fillText("续", 90, block.y + block.height / 2 + 20);
      }
      ctx.textAlign = "left";
      if (!block.rows.length) {
        ctx.fillStyle = "#abb4ae";
        ctx.font = "13px sans-serif";
        ctx.fillText("暂无动画", 170, block.y + 30);
      }
      for (let r = 0; r < block.rows.length; r++)
        for (let c = 0; c < block.rows[r].length; c++) {
          const anime = block.rows[r][c],
            x = 168 + c * (coverWidth + gap),
            y = block.y + 16 + r * (options.showNames ? 238 : 184);
          const image = await decode(anime.cover);
          rounded(ctx, x, y, coverWidth, coverHeight, 7, "#e8eeea");
          if (image) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(x, y, coverWidth, coverHeight, 7);
            ctx.clip();
            const scale = Math.max(
                coverWidth / image.width,
                coverHeight / image.height,
              ),
              sw = coverWidth / scale,
              sh = coverHeight / scale;
            ctx.drawImage(
              image,
              (image.width - sw) / 2,
              (image.height - sh) / 2,
              sw,
              sh,
              x,
              y,
              coverWidth,
              coverHeight,
            );
            ctx.restore();
          } else {
            ctx.fillStyle = "#8b9f91";
            ctx.font = "26px sans-serif";
            ctx.fillText("✦", x + 43, y + 52);
            ctx.font = "13px sans-serif";
            textLines(ctx, anime.name, x + 10, y + 87, coverWidth - 20, 20);
          }
          if (options.showNames) {
            ctx.fillStyle = "#3f4c46";
            ctx.font = "14px sans-serif";
            textLines(ctx, anime.name, x, y + 189, coverWidth, 19);
          }
        }
    }
    output.push(canvas.toDataURL("image/png"));
  }
  return output;
}
