import { useState } from 'react';
import './App.css';

const exampleHypothesis = 'Metformin suppresses glioblastoma growth through altered cellular metabolism.';

export default function App() {
  const [hypothesis, setHypothesis] = useState(exampleHypothesis);
  const [showReport, setShowReport] = useState(true);

  function analyze(event) {
    event.preventDefault();
    if (hypothesis.trim() === exampleHypothesis) setShowReport(true);
    else setShowReport(false);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="FalsifyRx home"><span className="brand-mark">F</span><span>Falsify<span className="brand-light">Rx</span></span></a>
        <div className="side-label">WORKSPACE</div>
        <button className="nav-item active"><span className="nav-icon">⌕</span> Hypothesis review</button>
        <div className="side-note"><span className="status-dot" /> Proof of concept</div>
        <div className="sidebar-bottom"><div className="mini-icon">✳</div><div><strong>Evidence first</strong><p>Every next test should trace back to a specific gap.</p></div></div>
      </aside>

      <section className="main-content" id="top">
        <header className="topbar"><span>Hypothesis review</span><span className="demo-badge">DEMO MODE</span></header>
        <div className="content-wrap">
          <div className="eyebrow"><span className="eyebrow-line" /> DRUG–DISEASE HYPOTHESIS</div>
          <h1>Pressure-test your<br className="desktop-break" /> scientific hypothesis.</h1>
          <p className="intro">Find the weakest assumption, then identify a useful experiment to challenge it.</p>

          <form className="hypothesis-form" onSubmit={analyze}>
            <label htmlFor="hypothesis">Your hypothesis</label>
            <textarea id="hypothesis" value={hypothesis} onChange={(event) => { setHypothesis(event.target.value); setShowReport(false); }} rows="2" />
            <div className="form-footer"><span className="form-hint"><span className="sparkle">✳</span> Start with a drug and a disease</span><button type="submit">Analyze hypothesis <span aria-hidden="true">↗</span></button></div>
          </form>

          {showReport ? (
            <section className="report" aria-live="polite">
              <div className="report-heading"><div><div className="section-kicker">ANALYSIS PREVIEW <span className="preview-pill">ILLUSTRATIVE</span></div><h2>Hypothesis assessment</h2></div><span className="verdict"><span /> Insufficient evidence</span></div>
              <div className="hypothesis-summary"><span className="summary-label">ASSESSING</span><p>{hypothesis}</p></div>

              <div className="report-grid">
                <article className="report-card challenge-card"><div className="card-title"><span className="card-icon coral">!</span><h3>Strongest challenge</h3></div><p>The proposed metabolic mechanism may not be sufficient to explain an observed antitumor effect. Results could depend on cell context, drug exposure, or other mechanisms.</p><div className="gap-callout"><span>KEY ASSUMPTION TO TEST</span><strong>Is the metabolic change causing the effect, or simply occurring alongside it?</strong></div></article>
                <article className="report-card"><div className="card-title"><span className="card-icon green">↗</span><h3>Evidence assessment</h3></div><div className="evidence-row"><span className="evidence-dot support"/><div><strong>Supporting evidence</strong><p>Relevant metabolic or antitumor findings, if identified in retrieved literature.</p></div></div><div className="evidence-row"><span className="evidence-dot contradict"/><div><strong>Contradictory evidence</strong><p>Weak, absent, or context-dependent effects, if reported.</p></div></div><div className="evidence-row"><span className="evidence-dot limit"/><div><strong>Limitations</strong><p>Model systems, exposure, endpoints, and study quality may vary.</p></div></div></article>
              </div>

              <article className="next-test"><div className="test-topline"><div className="card-title"><span className="card-icon purple">⌁</span><h3>Recommended next test</h3></div><span className="recommendation-tag">RECOMMENDATION</span></div><p>In a relevant glioblastoma model, compare a prespecified metabolic readout with cell viability under matched exposure conditions and appropriate controls.</p><div className="test-rationale"><span>WHY THIS TEST</span><p>It could help distinguish a metabolic mechanism from a nonspecific or context-dependent effect. The exact assay should follow review of the retrieved studies and available resources.</p></div></article>
              <div className="report-footnote"><span>ⓘ</span> This is an illustrative output structure, not a completed literature review or a claim about actual evidence. No papers have been retrieved for this preview.</div>
            </section>
          ) : (
            <div className="empty-report"><span className="empty-icon">✳</span><strong>Custom analysis isn’t connected yet</strong><p>The report preview uses the built-in metformin and glioblastoma example. Restore that example to view its illustrative assessment.</p><button type="button" onClick={() => { setHypothesis(exampleHypothesis); setShowReport(true); }}>Restore example hypothesis</button></div>
          )}
          <footer>FalsifyRx <span>·</span> Research support, not medical advice</footer>
        </div>
      </section>
    </main>
  );
}
