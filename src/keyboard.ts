const cardSelector = ".anime-card .card-button";
export const cardId = (element: Element | null) =>
  element?.closest<HTMLElement>("[data-anime-id]")?.dataset.animeId ?? null;
export function focusCard(id: string) {
  const button = document.querySelector<HTMLElement>(
    `[data-anime-id="${CSS.escape(id)}"] .card-button`,
  );
  button?.focus();
  button?.scrollIntoView({ block: "nearest" });
  return !!button;
}
export function neighborCard(from: HTMLElement | null, key: string) {
  const cards = [...document.querySelectorAll<HTMLElement>(cardSelector)];
  if (!from || !cards.includes(from)) return cards[0] ?? null;
  const index = cards.indexOf(from);
  if (key === "ArrowLeft") return cards[index - 1] ?? null;
  if (key === "ArrowRight") return cards[index + 1] ?? null;
  const area = from.closest("[data-drag-scroll]");
  const origin = from.getBoundingClientRect();
  const up = key === "ArrowUp";
  let best: HTMLElement | null = null,
    score = Infinity;
  for (const card of cards) {
    if (card === from || card.closest("[data-drag-scroll]") !== area) continue;
    const rect = card.getBoundingClientRect();
    const dy = up ? origin.top - rect.bottom : rect.top - origin.bottom;
    if (dy < -1) continue;
    const dx = Math.abs(rect.left - origin.left);
    const value = dy * 10 + dx;
    if (value < score) {
      score = value;
      best = card;
    }
  }
  return best;
}
