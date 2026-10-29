// Benchmark: run FalsifyRx on hypotheses whose real-world outcome is known and
// report verdict accuracy plus grounding metrics. Usage: npm run eval [-- filter|heldout]
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk').default;
const { runAnalysis } = require('../analyze');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const filter = (process.argv[2] || '').toLowerCase();
const heldOutOnly = filter === 'heldout';
const cases = require('./cases.json').filter((c) => (heldOutOnly ? c.heldOut : !filter || `${c.drug} ${c.disease}`.toLowerCase().includes(filter)));

async function runCase(c) {
  const started = Date.now();
  try {
    const a = await runAnalysis(anthropic, c);
    const ids = new Set(a.papers.map((p) => p.id));
    return {
      ...c,
      actual: a.verdict.label,
      match: c.expected.includes(a.verdict.label),
      papers: a.papers.length,
      supports: a.papers.filter((p) => p.stance === 'supports').length,
      challenges: a.papers.filter((p) => p.stance === 'challenges').length,
      strongDesign: a.papers.filter((p) => ['rct', 'cohort'].includes(p.studyType)).length,
      quotesVerified: a.meta?.quotesVerified ?? 0,
      droppedIds: a.meta?.droppedIds?.length ?? 0,
      testGrounded: a.verdict.nextTest.paperIds.length > 0 && a.verdict.nextTest.paperIds.every((id) => ids.has(id)),
      question: a.verdict.nextTest.question,
      seconds: Math.round((Date.now() - started) / 1000),
    };
  } catch (error) {
    return { ...c, actual: 'error', match: false, error: error.message };
  }
}

async function main() {
  const results = [];
  for (let i = 0; i < cases.length; i += 2) {
    results.push(...(await Promise.all(cases.slice(i, i + 2).map(runCase))));
    results.slice(-2).forEach((r) => console.log(`${r.match ? '✓' : '✗'} ${r.drug} → ${r.disease}: ${r.actual}${r.error ? ` (${r.error})` : ''}`));
  }

  const ok = results.filter((r) => r.actual !== 'error');
  const sum = (k) => ok.reduce((n, r) => n + (r[k] || 0), 0);
  const withPapers = ok.filter((r) => r.papers > 0);
  const summary = {
    verdictAccuracy: `${results.filter((r) => r.match).length}/${results.length}`,
    tunedCases: `${results.filter((r) => !r.heldOut && r.match).length}/${results.filter((r) => !r.heldOut).length}`,
    heldOutCases: `${results.filter((r) => r.heldOut && r.match).length}/${results.filter((r) => r.heldOut).length}`,
    quotesVerified: `${sum('quotesVerified')}/${sum('papers')}`,
    hallucinatedIdsCaught: sum('droppedIds'),
    testsGrounded: `${withPapers.filter((r) => r.testGrounded).length}/${withPapers.length}`,
  };

  const md = [
    '# FalsifyRx benchmark',
    '',
    `Verdict matches known outcome: **${summary.verdictAccuracy}** (tuned cases ${summary.tunedCases}, held-out ${summary.heldOutCases}) · Quotes found in abstract: **${summary.quotesVerified}** · Next tests citing retrieved papers: **${summary.testsGrounded}** · Invalid paper IDs caught: **${summary.hallucinatedIdsCaught}**`,
    '',
    '| Hypothesis | Known outcome | Expected | FalsifyRx | | Papers (RCT/cohort) | Support / challenge | Quotes found |',
    '|---|---|---|---|---|---|---|---|',
    ...results.map((r) => `| ${r.drug} → ${r.disease}${r.heldOut ? ' (held-out)' : ''} | ${r.why} | ${r.expected.join(' or ')} | ${r.actual} | ${r.match ? '✓' : '✗'} | ${r.papers ?? '-'} (${r.strongDesign ?? '-'}) | ${r.supports ?? '-'} / ${r.challenges ?? '-'} | ${r.quotesVerified ?? '-'}/${r.papers ?? '-'} |`),
    '',
  ].join('\n');

  console.log('\n', summary);
  if (filter) return; // partial runs shouldn't overwrite the full results
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ summary, results, ranAt: new Date().toISOString() }, null, 2));
  fs.writeFileSync(path.join(__dirname, 'results.md'), md);
  console.log('Wrote eval/results.md and eval/results.json');
}

main();
