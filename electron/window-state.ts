import { z } from "zod";
type Rect = { x: number; y: number; width: number; height: number };
const windowStateSchema = z.object({
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  maximized: z.boolean().default(false),
});
export type WindowState = z.infer<typeof windowStateSchema>;
export const defaultWindow = { width: 1440, height: 960 };
export const minWindow = { width: 1000, height: 700 };
function overlap(a: Rect, b: Rect) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? { w, h } : null;
}
export function restoreWindow(saved: unknown, workAreas: Rect[]): WindowState {
  const parsed = windowStateSchema.safeParse(saved);
  if (!parsed.success) return { ...defaultWindow, maximized: false };
  const state = parsed.data;
  const largest = workAreas.reduce(
    (max, a) => ({
      width: Math.max(max.width, a.width),
      height: Math.max(max.height, a.height),
    }),
    minWindow,
  );
  const width = Math.min(Math.max(state.width, minWindow.width), largest.width);
  const height = Math.min(
    Math.max(state.height, minWindow.height),
    largest.height,
  );
  const { x, y } = state;
  const visible =
    x !== undefined &&
    y !== undefined &&
    workAreas.some((area) => {
      const o = overlap({ x, y, width, height }, area);
      return o && o.w >= 100 && o.h >= 50;
    });
  return visible
    ? { x, y, width, height, maximized: state.maximized }
    : { width, height, maximized: state.maximized };
}
