/** One row of a line diff: a line that is shared, added, or removed. */
export interface DiffRow {
  type: "equal" | "add" | "remove";
  text: string;
}

/**
 * Line-level diff of two texts via an LCS table. Lines present in both (in
 * order) are "equal"; lines only in `a` are "remove", only in `b` are "add".
 * Pure and deterministic — used by the variant Diff panel and unit-tested.
 */
export function diffLines(a: string, b: string): DiffRow[] {
  const left = a.split("\n");
  const right = b.split("\n");
  const n = left.length;
  const m = right.length;
  const width = m + 1;

  // Flat LCS table; `at` returns 0 past the edges so the recurrence is simple.
  const lcs = new Array<number>((n + 1) * width).fill(0);
  const at = (i: number, j: number): number => lcs[i * width + j] ?? 0;
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i * width + j] = left[i] === right[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      rows.push({ type: "equal", text: left[i] ?? "" });
      i += 1;
      j += 1;
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      rows.push({ type: "remove", text: left[i] ?? "" });
      i += 1;
    } else {
      rows.push({ type: "add", text: right[j] ?? "" });
      j += 1;
    }
  }
  for (; i < n; i += 1) {
    rows.push({ type: "remove", text: left[i] ?? "" });
  }
  for (; j < m; j += 1) {
    rows.push({ type: "add", text: right[j] ?? "" });
  }
  return rows;
}
