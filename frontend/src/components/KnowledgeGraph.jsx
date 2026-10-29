import { useEffect, useMemo, useRef } from 'react';
import { forceSimulation, forceManyBody, forceLink, forceCollide, forceX, forceY } from 'd3-force';
import { drag } from 'd3-drag';
import { select } from 'd3-selection';

const W = 640, H = 480, cx = W / 2, cy = H / 2;
const studyLabel = { rct: 'RCT', cohort: 'Cohort', cell: 'Cell', animal: 'Animal', review: 'Review' };
const claimGlyph = { mechanism: '⚙', outcome: '◎', counterargument: '⚡' };
const titleOf = (t, n = 26) => (t && t.length > n ? `${t.slice(0, n - 1).trim()}…` : t);

function curve(x1, y1, x2, y2, bow) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  return `M ${x1} ${y1} Q ${mx + nx * bow} ${my + ny * bow} ${x2} ${y2}`;
}

function buildGraph(analysis) {
  const { papers, claims, input } = analysis;
  const linkedPaperIds = new Set(claims.flatMap((c) => c.links.map((l) => l.paperId)));

  const nodes = [
    { id: 'drug', kind: 'hub', r: 34, label: titleOf(input.drug, 16), fx: cx - 90, fy: cy, x: cx - 90, y: cy },
    { id: 'disease', kind: 'hub', r: 34, label: titleOf(input.disease, 16), fx: cx + 90, fy: cy, x: cx + 90, y: cy },
    ...claims.map((c) => ({ id: c.id, kind: 'claim', r: 16, data: c, x: cx + (Math.random() - 0.5) * 40, y: cy + (Math.random() - 0.5) * 40 })),
    ...papers.map((p) => ({ id: p.id, kind: 'paper', r: 18, data: p, x: cx + (Math.random() - 0.5) * 60, y: cy + (Math.random() - 0.5) * 60 })),
  ];

  const links = [
    { source: 'drug', target: 'disease', kind: 'core hub-link' },
    ...claims.map((c) => ({ source: 'drug', target: c.id, kind: 'core' })),
    ...claims.flatMap((c) => c.links.map((l) => ({ source: c.id, target: l.paperId, kind: l.relation }))),
    ...papers.filter((p) => !linkedPaperIds.has(p.id)).map((p) => ({ source: 'disease', target: p.id, kind: `${p.stance} dashed` })),
  ];

  return { nodes, links };
}

export default function KnowledgeGraph({ analysis, selectedId, onSelect }) {
  const svgRef = useRef(null);
  const simRef = useRef(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  // Rebuilt only when `analysis` itself changes (new identity each run());
  // this is first-paint layout data only — see note near the JSX below.
  const graph = useMemo(() => buildGraph(analysis), [analysis]);

  // Runs the simulation and wires dragging. Position updates bypass React —
  // the tick handler writes transforms/paths directly to the DOM for
  // performance, since this fires dozens of times per second while settling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const nodes = graph.nodes.map((n) => ({ ...n }));
    const links = graph.links.map((l) => ({ ...l }));
    nodesRef.current = nodes;
    linksRef.current = links;
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

    const sim = forceSimulation(nodes)
      .force('charge', forceManyBody().strength((n) => (n.kind === 'hub' ? -420 : n.kind === 'claim' ? -220 : -170)))
      .force('link', forceLink(links).id((n) => n.id).distance((l) => (l.kind.startsWith('core') ? 110 : 85)).strength(0.9))
      .force('collide', forceCollide().radius((n) => n.r + 10).strength(0.9))
      .force('x', forceX(cx).strength(0.03))
      .force('y', forceY(cy).strength(0.04))
      .alpha(1)
      .alphaDecay(0.035)
      .on('tick', () => {
        for (const n of nodes) {
          n.x = Math.max(n.r, Math.min(W - n.r, n.x));
          n.y = Math.max(n.r, Math.min(H - n.r, n.y));
          const el = svg.querySelector(`[data-node="${n.id}"]`);
          if (el) el.setAttribute('transform', `translate(${n.x},${n.y})`);
        }
        const halo1 = svg.querySelector('[data-halo="drug"]');
        const halo2 = svg.querySelector('[data-halo="disease"]');
        if (halo1) { halo1.setAttribute('cx', byId.drug.x); halo1.setAttribute('cy', byId.drug.y); }
        if (halo2) { halo2.setAttribute('cx', byId.disease.x); halo2.setAttribute('cy', byId.disease.y); }
        links.forEach((l, i) => {
          const s = byId[l.source.id || l.source], t = byId[l.target.id || l.target];
          if (!s || !t) return;
          const bow = l.kind.startsWith('core') ? 0 : 30;
          const el = svg.querySelector(`[data-link="${i}"]`);
          if (el) el.setAttribute('d', curve(s.x, s.y, t.x, t.y, bow));
        });
      });

    simRef.current = sim;

    const dragBehavior = drag()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        if (d.kind !== 'hub') { d.fx = null; d.fy = null; }
      });

    // Bind drag directly per-node (each already has a unique DOM element via
    // data-node) rather than d3's selectAll().data() join, which assumes a
    // general-update-pattern DOM that React doesn't hand it reliably.
    for (const n of nodes) {
      const el = svg.querySelector(`[data-node="${n.id}"]`);
      if (el) select(el).datum(n).call(dragBehavior);
    }

    return () => sim.stop();
  }, [graph]);

  // Selection changes only toggle classes/opacity directly on the DOM —
  // never through React re-render — so node positions set by the live
  // simulation (or a drag) are never clobbered by a stale render.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    for (const n of nodesRef.current) {
      if (n.kind !== 'paper') continue;
      const el = svg.querySelector(`[data-node="${n.id}"]`);
      if (!el) continue;
      const sel = selectedId === n.id;
      const dimmed = Boolean(selectedId) && !sel;
      el.classList.toggle('sel', sel);
      el.classList.toggle('dim', dimmed);
      el.setAttribute('aria-pressed', String(sel));
    }
    for (const l of linksRef.current) {
      const paperId = l.target.id || l.target;
      const sourceId = l.source.id || l.source;
      const dimmed = Boolean(selectedId) && !l.kind.startsWith('core') && selectedId !== paperId && selectedId !== sourceId;
      const idx = linksRef.current.indexOf(l);
      const el = svg.querySelector(`[data-link="${idx}"]`);
      if (el) el.classList.toggle('dim', dimmed);
    }
  }, [selectedId, graph]);

  // Below, `transform`/`className` on nodes and `d` on links only matter for
  // first paint (pre-simulation layout); live position, drag, and selection
  // state afterward are owned entirely by the imperative effects above, which
  // write straight to the DOM via data-node/data-link so a React re-render
  // triggered by something else never snaps the graph back to stale state.
  const { nodes, links } = graph;
  const hubs = nodes.filter((n) => n.kind === 'hub');
  const claims = nodes.filter((n) => n.kind === 'claim');
  const papers = nodes.filter((n) => n.kind === 'paper');

  return (
    <div className="panel graph">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evidence knowledge graph">
        <defs>
          <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--violet)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--violet)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {hubs.map((n) => (
          <circle key={`halo-${n.id}`} data-halo={n.id} className="halo" cx={n.x} cy={n.y} r="64" fill="url(#hubGlow)" />
        ))}

        {links.map((l, i) => {
          const paperId = l.target.id || l.target;
          const sourceId = l.source.id || l.source;
          const dimmed = selectedId && !l.kind.startsWith('core') && selectedId !== paperId && selectedId !== sourceId;
          return <path key={i} data-link={i} className={`edge ${l.kind} ${dimmed ? 'dim' : ''}`} d="" />;
        })}

        {hubs.map((n) => (
          <g key={n.id} data-node={n.id} data-draggable className="node hub" transform={`translate(${n.x},${n.y})`}>
            <circle r={n.r} />
            <text y="-2">{n.label}</text>
            <text className="hub-tag" y="14">{n.id === 'drug' ? 'DRUG' : 'DISEASE'}</text>
          </g>
        ))}

        {claims.map((n) => (
          <g key={n.id} data-node={n.id} data-draggable className={`node claim ${n.data.kind}`} transform={`translate(${n.x},${n.y})`}>
            <circle r={n.r} />
            <text className="claim-kind" y="4">{claimGlyph[n.data.kind] || '•'}</text>
            <title>{n.data.text}</title>
          </g>
        ))}

        {papers.map((n) => {
          const p = n.data;
          const sel = selectedId === p.id;
          const dimmed = selectedId && !sel;
          return (
            <g
              key={n.id}
              data-node={n.id}
              data-draggable
              className={`node paper ${p.stance} ${sel ? 'sel' : ''} ${dimmed ? 'dim' : ''}`}
              transform={`translate(${n.x},${n.y})`}
              tabIndex="0"
              role="button"
              aria-label={p.title}
              aria-pressed={sel}
              onClick={() => onSelect(sel ? null : p.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(sel ? null : p.id)}
            >
              <circle r={n.r} />
              <text className="paper-type" y="-1">{studyLabel[p.studyType] || p.studyType}</text>
              <text className="paper-year" y="11">{p.year}</text>
              <title>{p.title}</title>
            </g>
          );
        })}
      </svg>

      <ul className="legend">
        <li><i className="supports" /> Supports</li>
        <li><i className="challenges" /> Challenges</li>
        <li><i className="neutral" /> Neutral</li>
        <li><i className="claim-key" /> Claim</li>
        <li className="legend-hint">Drag nodes to rearrange</li>
      </ul>
      <ul className="claim-list">
        {claims.map((n) => <li key={n.id}><b>{n.data.kind}</b> {n.data.text}</li>)}
      </ul>
    </div>
  );
}
