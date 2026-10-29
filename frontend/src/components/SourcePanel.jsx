const typeLabel = { rct: 'Randomized trial', cohort: 'Cohort study', cell: 'Cell study', animal: 'Animal study', review: 'Review' };

export default function SourcePanel({ paper, onClose }) {
  if (!paper) return <aside className="panel source empty"><p>Select a paper in the graph to inspect its source.</p></aside>;
  return (
    <aside className="panel source">
      <button className="ghost close" onClick={onClose} aria-label="Close source">×</button>
      <span className={`tag ${paper.stance}`}>{paper.stance}</span>
      <h4>{paper.title}</h4>
      <p className="meta">{typeLabel[paper.studyType]} · {paper.year} · {paper.directness} evidence</p>
      <p>{paper.finding}</p>
      <a href={paper.url} target="_blank" rel="noreferrer">Open source ↗</a>
    </aside>
  );
}
