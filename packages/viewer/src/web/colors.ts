/**
 * Stable hue per fragment id, so a fragment keeps the same color across the
 * canvas, sidebar and legend. Deterministic and dependency-free.
 */
function hueOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return (hash + 360) % 360;
}

/** Soft background tint for a fragment's segment. Dark mode native. */
export function fragmentColor(id: string): string {
  return `hsl(${hueOf(id)}deg 55% 14%)`;
}

/** Saturated variant of {@link fragmentColor} for borders/legend swatches. */
export function fragmentAccent(id: string): string {
  return `hsl(${hueOf(id)}deg 70% 62%)`;
}
