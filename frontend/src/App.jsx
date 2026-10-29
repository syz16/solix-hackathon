import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { analyze } from './api';
import { sampleAnalysis } from './data/analysis';
import HypothesisForm from './components/HypothesisForm';
import InvestigationTimeline from './components/InvestigationTimeline';
import KnowledgeGraph from './components/KnowledgeGraph';
import EvidenceSplit from './components/EvidenceSplit';
import UncertaintyGrid from './components/UncertaintyGrid';
import SourcePanel from './components/SourcePanel';
import Verdict from './components/Verdict';
import './App.css';

const steps = ['Input', 'Investigate', 'Explore', 'Verdict'];

export default function App() {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState({ drug: '', disease: '', mechanism: '' });
  const [done, setDone] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');

  async function run() {
    setStep(1); setDone([]); setError(''); setSelectedId(null);
    try {
      const result = await analyze(input, (key) => setDone((d) => [...d, key]));
      setAnalysis(result);
      setTimeout(() => setStep(2), 700);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.'); setStep(0);
    }
  }

  const selected = analysis?.papers.find((p) => p.id === selectedId);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">F</span>Falsify<span>Rx</span></div>
        <nav className="steps" aria-label="Progress">
          {steps.map((s, i) => (
            <button key={s} className={i === step ? 'on' : i < step ? 'past' : ''} disabled={i > step && !(analysis && i >= 2)} onClick={() => setStep(i)}>
              <span>{i + 1}</span>{s}
            </button>
          ))}
        </nav>
        {analysis?.isSample && <span className="tag amber">Sample data</span>}
      </header>

      <main>
        <AnimatePresence mode="wait">
          <motion.section key={step} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {step === 0 && (
              <>
                <h1>Pressure-test your<br />drug hypothesis.</h1>
                <p className="intro">FalsifyRx finds the weakest assumption in the evidence, then recommends the experiment most likely to challenge it.</p>
                {error && <p className="error">{error}</p>}
                <HypothesisForm value={input} onChange={setInput} onSubmit={run} />
              </>
            )}
            {step === 1 && (
              <>
                <h1>Investigating</h1>
                <p className="intro">{input.drug} → {input.disease}</p>
                <InvestigationTimeline stages={sampleAnalysis.stages} done={done} />
              </>
            )}
            {step === 2 && analysis && (
              <>
                <h1>Explore the evidence</h1>
                <p className="intro">Every connection traces to a retrieved paper. Click a paper node to inspect it.</p>
                <div className="explore">
                  <KnowledgeGraph analysis={analysis} selectedId={selectedId} onSelect={setSelectedId} />
                  <SourcePanel paper={selected} onClose={() => setSelectedId(null)} />
                </div>
                <EvidenceSplit papers={analysis.papers} />
                <h3 className="section">What’s known and unknown</h3>
                <UncertaintyGrid items={analysis.uncertainty} />
                <div className="actions"><button className="primary" onClick={() => setStep(3)}>Reveal verdict ↗</button></div>
              </>
            )}
            {step === 3 && analysis && <Verdict analysis={analysis} />}
          </motion.section>
        </AnimatePresence>
        <footer>FalsifyRx · Research support, not medical advice</footer>
      </main>
    </div>
  );
}
