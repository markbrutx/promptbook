/** Minimal ANSI styling, used by the explain and lint renderers. */
export interface Style {
  bold(text: string): string;
  dim(text: string): string;
  green(text: string): string;
  red(text: string): string;
  warn(text: string): string;
}

/** Pluralize `word` by `count`, e.g. `plural(2, "error")` -> "2 errors". */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Build a {@link Style}; when `color` is false every helper is a no-op. */
export function makeStyle(color: boolean): Style {
  const wrap =
    (code: string) =>
    (text: string): string =>
      color ? `\x1b[${code}m${text}\x1b[0m` : text;
  return {
    bold: wrap("1"),
    dim: wrap("2"),
    green: wrap("32"),
    red: wrap("31"),
    warn: wrap("33"),
  };
}
