const typeLabel = { rct: 'Randomized trial', cohort: 'Cohort', cell: 'Cell', animal: 'Animal', review: 'Review' };

function Column({ title, cls, papers }) {
  const counts = papers.reduce((a, p) => ({ ...a, [p.studyType]: (a[p.studyType] || 0) + 1 }), {});
  return (
    <div className={`col ${cls}`}>
      <h4>{title} <span>{papers.length}</span></h4>
      <div className="chips">{Object.entries(counts).map(([t, n]) => <span key={t} className="chip">{n} {typeLabel[t]}</span>)}</div>
      <ul>{papers.map((p) => <li key={p.id}><b>{typeLabel[p.studyType]}, {p.year}.</b> {p.finding}</li>)}</ul>
    </div>
  );
}

export default function EvidenceSplit({ papers }) {
  return (
    <div className="panel split">
      <Column title="Supporting" cls="supports" papers={papers.filter((p) => p.stance === 'supports')} />
      <Column title="Contradicting" cls="challenges" papers={papers.filter((p) => p.stance === 'challenges')} />
    </div>
  );
}
