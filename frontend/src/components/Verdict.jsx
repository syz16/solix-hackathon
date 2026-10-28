import { motion } from 'framer-motion';

const verdictText = { challenged: 'Challenged', not_challenged: 'Not challenged', insufficient: 'Insufficient evidence' };

export default function Verdict({ analysis }) {
  const { verdict, papers } = analysis;
  const t = verdict.nextTest;
  return (
    <div className="verdict-wrap">
      <div className={`panel verdict-banner ${verdict.label}`}>
        <span className="label">Verdict</span>
        <h2>{verdictText[verdict.label]}</h2>
        {verdict.label === 'not_challenged' && <p className="note">“Not challenged” does not mean the hypothesis is proven.</p>}
        <p>{verdict.strongestChallenge}</p>
        <span className="label">Untested assumptions</span>
        <ol>{verdict.assumptions.map((a) => <li key={a}>{a}</li>)}</ol>
      </div>
      <motion.article className="panel next-test" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="topline"><span className="label">Recommended next test</span><span className="tag ai">Recommendation, not an established finding</span></div>
        <h3>{t.question}</h3>
        <p className="experiment">{t.experiment}</p>
        <div className="outcomes">
          {t.outcomes.map((o) => (
            <div key={o.result}><span className="label">If</span><p>{o.result}</p><span className="label">Then</span><p><b>{o.implies}</b></p></div>
          ))}
        </div>
        <p className="rationale"><span className="label">Why this test</span>{t.rationale}</p>
        <div className="cites"><span className="label">Linked evidence</span>
          {t.paperIds.map((id) => { const p = papers.find((x) => x.id === id); return <a key={id} href={p.url} target="_blank" rel="noreferrer">{p.title} ↗</a>; })}
        </div>
      </motion.article>
    </div>
  );
}
