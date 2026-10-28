// SAMPLE FIXTURE ONLY. Paper records are placeholders that mirror the shape the
// backend will return; they are not real citations. Links go to Europe PMC searches.
const search = (q) => `https://europepmc.org/search?query=${encodeURIComponent(q)}`;

export const exampleInput = {
  drug: 'Metformin',
  disease: 'Glioblastoma',
  mechanism: 'Altered cellular metabolism',
};

export const sampleAnalysis = {
  isSample: true,
  papers: [
    { id: 'p1', title: 'Sample: metabolic readouts shift after metformin in GBM cell lines', url: search('metformin glioblastoma AMPK'), year: 2019, studyType: 'cell', stance: 'supports', directness: 'direct', finding: 'Reduced viability alongside altered metabolic readouts in cultured cells.' },
    { id: 'p2', title: 'Sample: metformin and tumor growth in a glioma animal model', url: search('metformin glioma xenograft'), year: 2020, studyType: 'animal', stance: 'supports', directness: 'indirect', finding: 'Slower tumor growth in treated animals; metabolic mechanism not isolated.' },
    { id: 'p3', title: 'Sample: effect of metformin varies across glioblastoma cell contexts', url: search('metformin glioblastoma cell context resistance'), year: 2021, studyType: 'cell', stance: 'challenges', directness: 'direct', finding: 'Weak or absent response in some lines despite comparable metabolic change.' },
    { id: 'p4', title: 'Sample: clinical outcomes with metformin in glioma patients', url: search('metformin glioblastoma survival cohort'), year: 2018, studyType: 'cohort', stance: 'challenges', directness: 'indirect', finding: 'No clear survival benefit; confounded by diabetes status and treatment.' },
    { id: 'p5', title: 'Sample: review of metformin repurposing in oncology', url: search('metformin cancer repurposing review'), year: 2022, studyType: 'review', stance: 'neutral', directness: 'speculative', finding: 'Mechanisms proposed are plausible but exposure levels in tumors are uncertain.' },
  ],
  claims: [
    { id: 'c1', kind: 'mechanism', text: 'Metformin alters tumor-cell metabolism', links: [{ paperId: 'p1', relation: 'supports' }, { paperId: 'p2', relation: 'supports' }] },
    { id: 'c2', kind: 'outcome', text: 'Metabolic change drives reduced growth', links: [{ paperId: 'p1', relation: 'supports' }, { paperId: 'p3', relation: 'challenges' }, { paperId: 'p4', relation: 'challenges' }] },
    { id: 'c3', kind: 'counterargument', text: 'Effect depends on cell context and exposure', links: [{ paperId: 'p3', relation: 'challenges' }, { paperId: 'p5', relation: 'challenges' }] },
  ],
  stages: [
    { key: 'search', label: 'Searching literature', detail: 'Query Europe PMC for the drug–disease pair', count: 5 },
    { key: 'dedupe', label: 'Deduplicating results', detail: 'Merge repeated records', count: 5 },
    { key: 'extract', label: 'Extracting findings', detail: 'Pull study type and key result from each abstract', count: 5 },
    { key: 'compare', label: 'Comparing evidence', detail: 'Classify support vs. challenge by directness', count: 5 },
    { key: 'recommend', label: 'Preparing recommendation', detail: 'Tie the biggest gap to one experiment', count: 1 },
  ],
  uncertainty: [
    { area: 'Mechanism', status: 'mixed', note: 'Metabolic change seen; causal role unclear' },
    { area: 'Biological context', status: 'mixed', note: 'Response varies across cell contexts' },
    { area: 'Clinical efficacy', status: 'unknown', note: 'No well-controlled evidence retrieved' },
    { area: 'Safety', status: 'unknown', note: 'Not addressed by retrieved studies' },
  ],
  verdict: {
    label: 'insufficient',
    strongestChallenge: 'The metabolic mechanism may not be sufficient to explain the antitumor effect; results appear to depend on cell context and exposure.',
    assumptions: [
      'The metabolic change causes the growth reduction, rather than occurring alongside it',
      'Cell-line exposure reflects achievable concentrations in tumors',
      'Findings generalize across glioblastoma cell contexts',
    ],
    nextTest: {
      question: 'Is the metabolic change causing the effect, or merely accompanying it?',
      experiment: 'In responsive and non-responsive glioblastoma models, measure a prespecified metabolic readout and viability under matched exposure, with appropriate controls.',
      outcomes: [
        { result: 'Viability falls only where the metabolic readout shifts', implies: 'Supports a metabolic mechanism' },
        { result: 'Metabolic readout shifts in all models but viability falls in only some', implies: 'Mechanism is insufficient; context-dependent' },
        { result: 'Viability falls without a metabolic shift', implies: 'Another mechanism is at work' },
      ],
      rationale: 'Distinguishes a genuine metabolic mechanism from a nonspecific or context-dependent effect. The exact assay should follow review of the retrieved studies and available resources.',
      paperIds: ['p1', 'p3'],
    },
  },
};
