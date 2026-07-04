import { describe, expect, it } from "vitest";
import { createSimulation } from "../src/web/graph/simulation.js";

const radii = [10, 6, 6, 6, 5, 5];
const edges = [
  { source: 0, target: 1 },
  { source: 0, target: 2 },
  { source: 0, target: 3 },
  { source: 1, target: 4 },
];

const distance = (sim: ReturnType<typeof createSimulation>, a: number, b: number): number => {
  const na = sim.nodes[a];
  const nb = sim.nodes[b];
  if (na === undefined || nb === undefined) {
    throw new Error("missing node");
  }
  return Math.hypot(nb.x - na.x, nb.y - na.y);
};

describe("createSimulation", () => {
  it("settles within the tick budget and stays finite", () => {
    const sim = createSimulation(radii, edges);
    sim.settle();
    expect(sim.settled()).toBe(true);
    expect(sim.tick()).toBe(false);
    for (const node of sim.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it("is deterministic: same input, same layout", () => {
    const a = createSimulation(radii, edges);
    const b = createSimulation(radii, edges);
    a.settle();
    b.settle();
    expect(a.nodes.map((n) => [n.x, n.y])).toEqual(b.nodes.map((n) => [n.x, n.y]));
  });

  it("holds every spring near its rest length once settled", () => {
    const sim = createSimulation(radii, edges, { springLength: 34 });
    sim.settle();
    for (const edge of edges) {
      const a = sim.nodes[edge.source];
      const b = sim.nodes[edge.target];
      if (a === undefined || b === undefined) {
        throw new Error("missing node");
      }
      const rest = 34 + a.r + b.r;
      const d = distance(sim, edge.source, edge.target);
      expect(d).toBeGreaterThan(rest * 0.4);
      expect(d).toBeLessThan(rest * 2.5);
    }
  });

  it("never lets two nodes overlap after settling", () => {
    const sim = createSimulation(radii, edges);
    sim.settle();
    for (let i = 0; i < sim.nodes.length; i += 1) {
      for (let j = i + 1; j < sim.nodes.length; j += 1) {
        const a = sim.nodes[i];
        const b = sim.nodes[j];
        if (a === undefined || b === undefined) {
          continue;
        }
        expect(distance(sim, i, j)).toBeGreaterThan(a.r + b.r);
      }
    }
  });

  it("honors pinned positions and relaxes after release", () => {
    const sim = createSimulation(radii, edges);
    const pinned = sim.nodes[1];
    expect(pinned).toBeDefined();
    if (pinned === undefined) {
      return;
    }
    pinned.fx = 200;
    pinned.fy = -80;
    sim.settle();
    expect(pinned.x).toBe(200);
    expect(pinned.y).toBe(-80);
    pinned.fx = null;
    pinned.fy = null;
    sim.reheat(0.2);
    expect(sim.settled()).toBe(false);
    sim.settle();
    expect(sim.settled()).toBe(true);
  });
});
