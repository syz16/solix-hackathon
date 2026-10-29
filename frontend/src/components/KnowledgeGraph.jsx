import { useEffect, useMemo, useRef } from 'react';
import { forceSimulation, forceManyBody, forceLink, forceCollide, forceX, forceY } from 'd3-force';
import { drag } from 'd3-drag';
import { select } from 'd3-selection';

const W = 640, H = 480, cx = W / 2, cy = H / 2;
const studyLabel = { rct: 'RCT', cohort: 'Cohort', cell: 'Cell', animal: 'Animal', review: 'Review' };
const claimKindLabel = { mechanism: 'Mechanism', outcome: 'Outcome', counterargument: 'Counterargument' };

// Rough average glyph width for this UI's font, used to size circles to
// their text instead of guessing a fixed radius and letting labels clip.
const AVG_CHAR_W = 0.58;
function textWidth(str, fontSize, weight = 400) {
  const bump = weight >= 700 ? 1.08 : 1;
  return (str?.length || 0) * fontSize * AVG_CHAR_W * bump;
}
function radiusFor(lines, minR, maxR, padding = 10) {
  const widest = Math.max(...lines.map(([t, size, weight]) => textWidth(t, size, weight)), 0);
  return Math.max(minR, Math.min(maxR, widest / 2 + padding));
}

function curve(x1, y1, x2, y2, bow) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  return `M ${x1} ${y1} Q ${mx + nx * bow} ${my + ny * bow} ${x2} ${y2}`;
}

// SVG arc path for a ring segment, used by the claim support/challenge indicator.
// A fraction of exactly 1 (single-relation claim) is a degenerate arc — start
// and end angles coincide and nothing draws — so split it into two halves.
function arcPath(r, startFrac, endFrac, strokeWidth) {
  if (endFrac - startFrac >= 0.999) {
    const mid = startFrac + (endFrac - startFrac) / 2;
    return [arcPath(r, startFrac, mid, strokeWidth), arcPath(r, mid, endFrac, strokeWidth)];
  }
  const a0 = startFrac * 2 * Math.PI - Math.PI / 2;
  const a1 = endFrac * 2 * Math.PI - Math.PI / 2;
  const x0 = r * Math.cos(a0), y0 = r * Math.sin(a0);
  const x1 = r * Math.cos(a1), y1 = r * Math.sin(a1);
  const large = endFrac - startFrac > 0.5 ? 1 : 0;
  return { d: `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`, strokeWidth };
}

function buildGraph(analysis) {
  const { papers, claims, input } = analysis;
  const linkedPaperIds = new Set(claims.flatMap((c) => c.links.map((l) => l.paperId)));

  const nodes = [
    {
      id: 'drug', kind: 'hub', data: { label: input.drug, tag: 'DRUG' },
      r: radiusFor([[input.drug, 11, 600], ['DRUG', 8, 700]], 30, 70, 14),
      fx: cx - 90, fy: cy, x: cx - 90, y: cy,
    },
    {
      id: 'disease', kind: 'hub', data: { label: input.disease, tag: 'DISEASE' },
      r: radiusFor([[input.disease, 11, 600], ['DISEASE', 8, 700]], 30, 70, 14),
      fx: cx + 90, fy: cy, x: cx + 90, y: cy,
    },
    ...claims.map((c) => {
      const supports = c.links.filter((l) => l.relation === 'supports').length;
      const challenges = c.links.filter((l) => l.relation === 'challenges').length;
      return {
        id: c.id, kind: 'claim', r: 17,
        data: { ...c, supports, challenges, label: claimKindLabel[c.kind] || c.kind },
        x: cx + (Math.random() - 0.5) * 40, y: cy + (Math.random() - 0.5) * 40,
      };
    }),
    ...papers.map((p) => ({
      id: p.id, kind: 'paper', data: p,
      r: radiusFor([[studyLabel[p.studyType] || p.studyType, 9, 700], [String(p.year ?? ''), 8, 400]], 20, 40, 9),
      x: cx + (Math.random() - 0.5) * 60, y: cy + (Math.random() - 0.5) * 60,
    })),
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
      .force('collide', forceCollide().radius((n) => n.r + (n.kind === 'claim' ? 26 : 10)).strength(0.9))
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
          <circle key={`halo-${n.id}`} data-halo={n.id} className="halo" cx={n.x} cy={n.y} r={n.r + 30} fill="url(#hubGlow)" />
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
            <text y="-2">{n.data.label}</text>
            <text className="hub-tag" y="14">{n.data.tag}</text>
          </g>
        ))}

        {claims.map((n) => {
          const { supports, challenges, label } = n.data;
          const total = supports + challenges;
          const ringR = n.r + 5;
          const segs = [];
          const pushArc = (start, end, cls) => {
            const arc = arcPath(ringR, start, end, 3);
            for (const a of Array.isArray(arc) ? arc : [arc]) segs.push({ ...a, cls });
          };
          if (total === 0) {
            pushArc(0, 1, 'neutral');
          } else {
            let cursor = 0;
            if (supports) { pushArc(cursor, cursor + supports / total, 'supports'); cursor += supports / total; }
            if (challenges) { pushArc(cursor, cursor + challenges / total, 'challenges'); }
          }
          return (
            <g key={n.id} data-node={n.id} data-draggable className={`node claim ${n.data.kind}`} transform={`translate(${n.x},${n.y})`}>
              <circle className="claim-core" r={n.r} />
              {segs.map((s, i) => <path key={i} className={`claim-ring ${s.cls}`} d={s.d} strokeWidth={s.strokeWidth} fill="none" />)}
              <text className="claim-label" y={n.r + 16}>{label}</text>
              <title>{n.data.text}</title>
            </g>
          );
        })}

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
        <li><i className="claim-key" /> Claim (ring = evidence split)</li>
        <li className="legend-hint">Drag nodes to rearrange</li>
      </ul>
      <ul className="claim-list">
        {claims.map((n) => <li key={n.id}><b>{n.data.label}</b> {n.data.text}</li>)}
      </ul>
    </div>
  );
}
