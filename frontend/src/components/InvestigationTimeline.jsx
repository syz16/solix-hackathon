import { motion } from 'framer-motion';

export default function InvestigationTimeline({ stages, done }) {
  const activeIdx = stages.findIndex((s) => !done.includes(s.key));
  return (
    <ol className="panel timeline">
      {stages.map((s, i) => {
        const state = done.includes(s.key) ? 'done' : i === activeIdx ? 'active' : 'pending';
        return (
          <motion.li key={s.key} className={`stage ${state}`} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
            <span className="stage-dot">{state === 'done' ? '✓' : ''}</span>
            <div>
              <strong>{s.label}</strong>
              <p>{state === 'done' ? `${s.count} ${s.key === 'recommend' ? 'recommendation' : 'records'} · ${s.detail}` : s.detail}</p>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
