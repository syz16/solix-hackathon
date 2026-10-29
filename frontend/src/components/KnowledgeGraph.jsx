import { motion } from 'framer-motion';

const W = 640, H = 480, cx = W / 2, cy = H / 2;
const studyLabel = { rct: 'RCT', cohort: 'Cohort', cell: 'Cell', animal: 'Animal', review: 'Review' };

function ring(items, r, offset = 0) {
  return Object.fromEntries(items.map((it, i) => {
    const a = (2 * Math.PI * i) / items.length + offset;
    return [it.id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), angle: a }];
  }));
}

// Quadratic curve bowed slightly away from the hub, so edges fan out
// legibly instead of overlapping as straight radial lines.
function curve(x1, y1, x2, y2, bow = 24) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  return `M ${x1} ${y1} Q ${mx + nx * bow} ${my + ny * bow} ${x2} ${y2}`;
}

const fade = { hidden: { opacity: 0, scale: 0.85 }, show: { opacity: 1, scale: 1 } };

export default function KnowledgeGraph({ analysis, selectedId, onSelect }) {
  const { papers, claims, input } = analysis;
  const claimPos = ring(claims, 110, -Math.PI / 2);
  const paperPos = ring(papers, 205, -Math.PI / 2 + 0.25);
  const hubGap = 52;
  const drugPos = { x: cx - hubGap, y: cy }, diseasePos = { x: cx + hubGap, y: cy };
  const titleOf = (t, n = 26) => (t.length > n ? `${t.slice(0, n - 1).trim()}…` : t);

  const linkedPaperIds = new Set(claims.flatMap((c) => c.links.map((l) => l.paperId)));
  const orphanPapers = papers.filter((p) => !linkedPaperIds.has(p.id));

  return (
    <div className="panel graph">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evidence knowledge graph">
        <defs>
          <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--violet)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--violet)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle className="halo" cx={drugPos.x} cy={drugPos.y} r="64" fill="url(#hubGlow)" />
        <circle className="halo" cx={diseasePos.x} cy={diseasePos.y} r="64" fill="url(#hubGlow)" />

        {claims.map((c) => (
          <motion.path
            key={c.id}
            className="edge core"
            d={curve(cx, cy, claimPos[c.id].x, claimPos[c.id].y, 0)}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        ))}
        {claims.flatMap((c) => c.links.map((l) => {
          const dimmed = selectedId && selectedId !== l.paperId;
          return (
            <motion.path
              key={c.id + l.paperId}
              className={`edge ${l.relation} ${dimmed ? 'dim' : ''}`}
              d={curve(claimPos[c.id].x, claimPos[c.id].y, paperPos[l.paperId].x, paperPos[l.paperId].y, 36)}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: dimmed ? 0.15 : 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            />
          );
        }))}
        {orphanPapers.map((p) => {
          const dimmed = selectedId && selectedId !== p.id;
          return (
            <motion.path
              key={`orphan-${p.id}`}
              className={`edge ${p.stance} dashed ${dimmed ? 'dim' : ''}`}
              d={curve(cx, cy, paperPos[p.id].x, paperPos[p.id].y, 36)}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: dimmed ? 0.15 : 0.5 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            />
          );
        })}

        <g className="node hub">
          <circle cx={drugPos.x} cy={drugPos.y} r="34" />
          <text x={drugPos.x} y={drugPos.y - 2}>{titleOf(input.drug, 16)}</text>
          <text className="hub-tag" x={drugPos.x} y={drugPos.y + 14}>DRUG</text>
          <circle cx={diseasePos.x} cy={diseasePos.y} r="34" />
          <text x={diseasePos.x} y={diseasePos.y - 2}>{titleOf(input.disease, 16)}</text>
          <text className="hub-tag" x={diseasePos.x} y={diseasePos.y + 14}>DISEASE</text>
        </g>

        {claims.map((c, i) => (
          <motion.g
            key={c.id}
            className={`node claim ${c.kind}`}
            variants={fade}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.35, delay: 0.25 + i * 0.05 }}
          >
            <circle cx={claimPos[c.id].x} cy={claimPos[c.id].y} r="15" />
            <text className="claim-kind" x={claimPos[c.id].x} y={claimPos[c.id].y + 4}>
              {c.kind === 'mechanism' ? '⚙' : c.kind === 'outcome' ? '◎' : '⚡'}
            </text>
            <title>{c.text}</title>
          </motion.g>
        ))}

        {papers.map((p, i) => {
          const sel = selectedId === p.id;
          const dimmed = selectedId && !sel;
          return (
            <motion.g
              key={p.id}
              className={`node paper ${p.stance} ${sel ? 'sel' : ''} ${dimmed ? 'dim' : ''}`}
              tabIndex="0"
              role="button"
              aria-label={p.title}
              aria-pressed={sel}
              onClick={() => onSelect(sel ? null : p.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(sel ? null : p.id)}
              variants={fade}
              initial="hidden"
              animate="show"
              transition={{ duration: 0.35, delay: 0.4 + i * 0.04 }}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.97 }}
            >
              <circle cx={paperPos[p.id].x} cy={paperPos[p.id].y} r={sel ? 21 : 18} />
              <text className="paper-type" x={paperPos[p.id].x} y={paperPos[p.id].y - 1}>{studyLabel[p.studyType] || p.studyType}</text>
              <text className="paper-year" x={paperPos[p.id].x} y={paperPos[p.id].y + 11}>{p.year}</text>
              <title>{p.title}</title>
            </motion.g>
          );
        })}
      </svg>

      <ul className="legend">
        <li><i className="supports" /> Supports</li>
        <li><i className="challenges" /> Challenges</li>
        <li><i className="neutral" /> Neutral</li>
        <li><i className="claim-key" /> Claim</li>
      </ul>
      <ul className="claim-list">
        {claims.map((c) => <li key={c.id}><b>{c.kind}</b> {c.text}</li>)}
      </ul>
    </div>
  );
}
