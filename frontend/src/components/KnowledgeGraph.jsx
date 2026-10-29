const W = 640, H = 460, cx = W / 2, cy = H / 2;

function ring(items, r, offset = 0) {
  return Object.fromEntries(items.map((it, i) => {
    const a = (2 * Math.PI * i) / items.length + offset;
    return [it.id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }];
  }));
}

export default function KnowledgeGraph({ analysis, selectedId, onSelect }) {
  const { papers, claims, input } = analysis;
  const claimPos = ring(claims, 95, -Math.PI / 2);
  const paperPos = ring(papers, 195, -Math.PI / 2 + 0.3);
  const drugPos = { x: cx - 38, y: cy }, diseasePos = { x: cx + 38, y: cy };
  const titleOf = (t) => (t.length > 24 ? `${t.slice(0, 22)}…` : t);

  return (
    <div className="panel graph">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evidence knowledge graph">
        {claims.map((c) => (
          <line key={c.id} className="edge core" x1={cx} y1={cy} x2={claimPos[c.id].x} y2={claimPos[c.id].y} />
        ))}
        {claims.flatMap((c) => c.links.map((l) => (
          <line key={c.id + l.paperId} className={`edge ${l.relation}`} x1={claimPos[c.id].x} y1={claimPos[c.id].y} x2={paperPos[l.paperId].x} y2={paperPos[l.paperId].y} />
        )))}
        <g className="node hub">
          <circle cx={drugPos.x} cy={drugPos.y} r="30" /><text x={drugPos.x} y={drugPos.y + 4}>{titleOf(input.drug)}</text>
          <circle cx={diseasePos.x} cy={diseasePos.y} r="30" /><text x={diseasePos.x} y={diseasePos.y + 4}>{titleOf(input.disease)}</text>
        </g>
        {claims.map((c) => (
          <g key={c.id} className={`node claim ${c.kind}`}>
            <circle cx={claimPos[c.id].x} cy={claimPos[c.id].y} r="13" />
            <title>{c.text}</title>
          </g>
        ))}
        {papers.map((p) => (
          <g key={p.id} className={`node paper ${p.stance} ${selectedId === p.id ? 'sel' : ''}`} tabIndex="0" role="button" aria-label={p.title}
            onClick={() => onSelect(p.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(p.id)}>
            <circle cx={paperPos[p.id].x} cy={paperPos[p.id].y} r="17" />
            <text x={paperPos[p.id].x} y={paperPos[p.id].y + 4}>{p.studyType}</text>
          </g>
        ))}
      </svg>
      <ul className="legend">
        <li><i className="supports" /> supports</li><li><i className="challenges" /> challenges</li><li><i className="claim-key" /> claim</li><li><i className="neutral" /> neutral</li>
      </ul>
      <ul className="claim-list">{claims.map((c) => <li key={c.id}><b>{c.kind}</b> {c.text}</li>)}</ul>
    </div>
  );
}
