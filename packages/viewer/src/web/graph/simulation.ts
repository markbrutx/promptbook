/**
 * Hand-rolled force-directed layout: pairwise repulsion + edge springs +
 * gentle centering, integrated with velocity damping under a decaying alpha
 * so the layout blooms, then settles and stops (no perpetual jiggle).
 * Deterministic: nodes start on a phyllotaxis spiral and no randomness is
 * used, so the same book always lays out the same way. O(n²) per tick is
 * fine for the few hundred nodes a book can hold.
 */

/** A particle in the layout. Positions and velocities are world units. */
export interface SimNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Visual radius: feeds repulsion mass and the overlap floor. */
  r: number;
  /** Pinned position (while dragging); null = free. */
  fx: number | null;
  fy: number | null;
}

/** One spring; endpoints are indices into the node array. */
export interface SimEdge {
  source: number;
  target: number;
}

export interface SimulationOptions {
  /** Coulomb constant for pairwise repulsion. */
  repulsion?: number;
  /** Spring stiffness along edges. */
  springK?: number;
  /** Rest length added on top of the two endpoint radii. */
  springLength?: number;
  /** Pull toward the origin (keeps disconnected clusters on screen). */
  centering?: number;
  /** Velocity kept per tick (1 = frictionless). */
  damping?: number;
  /** Exponential alpha decay per tick. */
  alphaDecay?: number;
  /** Alpha below which the simulation counts as settled. */
  alphaMin?: number;
}

export interface Simulation {
  nodes: SimNode[];
  alpha(): number;
  /** One physics step. Returns false (and does nothing) once settled. */
  tick(): boolean;
  /** Bump alpha back up (drag, data change) so the layout re-flows. */
  reheat(alpha?: number): void;
  /** Run ticks synchronously until settled (the prefers-reduced-motion path). */
  settle(maxTicks?: number): void;
  settled(): boolean;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function createSimulation(
  radii: number[],
  edges: SimEdge[],
  options: SimulationOptions = {},
): Simulation {
  const {
    repulsion = 3400,
    springK = 0.9,
    springLength = 56,
    centering = 0.006,
    damping = 0.6,
    alphaDecay = 0.024,
    alphaMin = 0.004,
  } = options;

  const nodes: SimNode[] = radii.map((r, i) => ({
    x: 24 * Math.sqrt(i + 0.5) * Math.cos(i * GOLDEN_ANGLE),
    y: 24 * Math.sqrt(i + 0.5) * Math.sin(i * GOLDEN_ANGLE),
    vx: 0,
    vy: 0,
    r,
    fx: null,
    fy: null,
  }));

  // Degree-normalized springs (d3-style): a hub's many edges each pull
  // weakly and the lighter endpoint absorbs most of the motion, so heavily
  // shared fragments cannot collapse every composition into one clump.
  const degree = nodes.map(() => 0);
  for (const edge of edges) {
    degree[edge.source] = (degree[edge.source] ?? 0) + 1;
    degree[edge.target] = (degree[edge.target] ?? 0) + 1;
  }

  let alpha = 1;

  const tick = (): boolean => {
    if (alpha < alphaMin) {
      return false;
    }
    alpha *= 1 - alphaDecay;

    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      if (a === undefined) {
        continue;
      }
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        if (b === undefined) {
          continue;
        }
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 === 0) {
          // Coincident nodes: nudge apart deterministically.
          dx = 0.01 * (i - j);
          dy = 0.01;
          d2 = dx * dx + dy * dy;
        }
        const d = Math.sqrt(d2);
        const mass = (a.r * b.r) / 36;
        let force = (repulsion * mass * alpha) / d2;
        const minDistance = a.r + b.r + 6;
        if (d < minDistance) {
          // Firm overlap push so big nodes never swallow small ones.
          force += ((minDistance - d) / d) * 0.6;
        }
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    for (const edge of edges) {
      const a = nodes[edge.source];
      const b = nodes[edge.target];
      if (a === undefined || b === undefined || a === b) {
        continue;
      }
      const degreeA = Math.max(1, degree[edge.source] ?? 1);
      const degreeB = Math.max(1, degree[edge.target] ?? 1);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const rest = springLength + a.r + b.r;
      const strength = springK / Math.min(degreeA, degreeB);
      const force = (strength * alpha * (d - rest)) / d;
      const biasA = degreeB / (degreeA + degreeB);
      a.vx += dx * force * biasA;
      a.vy += dy * force * biasA;
      b.vx -= dx * force * (1 - biasA);
      b.vy -= dy * force * (1 - biasA);
    }

    for (const node of nodes) {
      node.vx -= node.x * centering * alpha;
      node.vy -= node.y * centering * alpha;
      node.vx *= damping;
      node.vy *= damping;
      if (node.fx !== null) {
        node.x = node.fx;
        node.vx = 0;
      } else {
        node.x += node.vx;
      }
      if (node.fy !== null) {
        node.y = node.fy;
        node.vy = 0;
      } else {
        node.y += node.vy;
      }
    }
    return true;
  };

  return {
    nodes,
    alpha: () => alpha,
    tick,
    reheat: (next = 0.3) => {
      alpha = Math.max(alpha, next);
    },
    settle: (maxTicks = 600) => {
      for (let i = 0; i < maxTicks && tick(); i += 1) {
        // tick() advances until alpha crosses alphaMin
      }
    },
    settled: () => alpha < alphaMin,
  };
}
