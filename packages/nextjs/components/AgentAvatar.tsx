"use client";

/**
 * AgentAvatar — deterministic mini network SVG derived from agentId.
 * Every agent gets a unique visual fingerprint without requiring an image.
 * Matches the heptagon aesthetic of the Logo component.
 */

const NODE_COUNT = 6;
const SIZE = 120;
const CENTER = SIZE / 2;
const RADIUS = 42;

/** Seeded pseudo-random: maps (id, index) → 0..1 deterministically */
function seeded(id: number, index: number): number {
  const x = Math.sin(id * 9301 + index * 49297 + 233720) * 10000;
  return x - Math.floor(x);
}

interface Node {
  x: number;
  y: number;
}

function buildNodes(agentId: bigint): Node[] {
  const id = Number(agentId % 100000n);
  return Array.from({ length: NODE_COUNT }, (_, i) => {
    // Base angle evenly spread + small jitter per agent
    const base = (i / NODE_COUNT) * Math.PI * 2;
    const jitter = (seeded(id, i) - 0.5) * 0.6;
    const angle = base + jitter;
    const r = RADIUS * (0.7 + seeded(id, i + 10) * 0.3);
    return {
      x: CENTER + Math.cos(angle) * r,
      y: CENTER + Math.sin(angle) * r,
    };
  });
}

function buildEdges(agentId: bigint): [number, number][] {
  const id = Number(agentId % 100000n);
  const edges: [number, number][] = [];
  // Always connect ring (0→1→2…→0)
  for (let i = 0; i < NODE_COUNT; i++) {
    edges.push([i, (i + 1) % NODE_COUNT]);
  }
  // Add 2–3 cross connections derived from agentId
  const extras = 2 + Math.floor(seeded(id, 99) * 2);
  for (let e = 0; e < extras; e++) {
    const a = Math.floor(seeded(id, e + 20) * NODE_COUNT);
    const b = Math.floor(seeded(id, e + 30) * NODE_COUNT);
    if (a !== b) edges.push([a, b]);
  }
  return edges;
}

export const AgentAvatar = ({ agentId, size = 120 }: { agentId: bigint; size?: number }) => {
  const nodes = buildNodes(agentId);
  const edges = buildEdges(agentId);
  const id = Number(agentId % 100000n);
  // Pick a "hero" node (brightest) — index derived from agentId
  const heroIndex = id % NODE_COUNT;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Edges */}
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="#0ea5a5"
          strokeWidth="0.8"
          opacity="0.35"
          strokeLinecap="round"
        />
      ))}
      {/* Spoke from hero node to center */}
      <line
        x1={nodes[heroIndex].x}
        y1={nodes[heroIndex].y}
        x2={CENTER}
        y2={CENTER}
        stroke="#60a5fa"
        strokeWidth="0.7"
        opacity="0.5"
        strokeLinecap="round"
      />
      {/* Regular nodes */}
      {nodes.map((n, i) =>
        i === heroIndex ? null : (
          <circle key={i} cx={n.x} cy={n.y} r={2.4} fill="#0b1329" stroke="#0ea5a5" strokeWidth="1" opacity="0.85" />
        ),
      )}
      {/* Hero node — slightly larger, cyan fill */}
      <circle cx={nodes[heroIndex].x} cy={nodes[heroIndex].y} r={3.2} fill="#0ea5a5" opacity="0.95" />
      {/* Center dot */}
      <circle cx={CENTER} cy={CENTER} r={2} fill="#60a5fa" opacity="0.7" />
    </svg>
  );
};

export default AgentAvatar;
