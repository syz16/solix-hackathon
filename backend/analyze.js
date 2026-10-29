const { searchEuropePMC } = require('./europepmc');

const STAGES = [
  { key: 'search', label: 'Searching literature', detail: 'Query Europe PMC for the drug–disease pair' },
  { key: 'dedupe', label: 'Deduplicating results', detail: 'Merge repeated records' },
  { key: 'extract', label: 'Extracting findings', detail: 'Pull study type and key result from each abstract' },
  { key: 'compare', label: 'Comparing evidence', detail: 'Classify support vs. challenge by directness' },
  { key: 'recommend', label: 'Preparing recommendation', detail: 'Tie the biggest gap to one experiment' },
];

const SYSTEM_PROMPT = `You are FalsifyRx, a research-support tool that pressure-tests drug-repurposing hypotheses. \
You are given a drug, a disease, a proposed mechanism, and a set of retrieved paper abstracts. \
Your job is to find the weakest assumption in the evidence and recommend the single experiment most likely to challenge it. \
You are skeptical by default: look for confounds, indirectness, context-dependence, and unproven causal links. \
Never give medical advice or claims of efficacy/safety; this is research support only.

Respond with ONLY a single JSON object (no markdown fences, no prose) matching this exact shape:

{
  "papers": [
    { "id": string (use the given paper id), "title": string, "url": string (use the given url),
      "year": number, "studyType": "rct"|"cohort"|"cell"|"animal"|"review",
      "stance": "supports"|"challenges"|"neutral",
      "directness": "direct"|"indirect"|"speculative",
      "finding": string (<=160 chars, one concrete takeaway) }
  ],
  "claims": [
    { "id": string (e.g. "c1"), "kind": "mechanism"|"outcome"|"counterargument", "text": string,
      "links": [ { "paperId": string, "relation": "supports"|"challenges" } ] }
  ],
  "uncertainty": [
    { "area": "Mechanism"|"Biological context"|"Clinical efficacy"|"Safety", "status": "known"|"mixed"|"unknown",
      "note": string (<=140 chars) }
  ] (exactly one entry per area — no repeats),
  "verdict": {
    "label": "challenged"|"not_challenged"|"insufficient",
    "strongestChallenge": string,
    "assumptions": [string, ...] (2-4 untested assumptions the hypothesis relies on),
    "nextTest": {
      "question": string,
      "experiment": string (a concrete, falsifiable experiment design),
      "outcomes": [ { "result": string, "implies": string }, ... ] (2-3 branches),
      "rationale": string,
      "paperIds": [string, ...] (ids of papers this test most directly follows from)
    }
  }
}

Rules:
- Use only the "papers" you were given; include every paper you were given, classified.
- Every paper must be referenced by at least one claim's "links" — if a paper doesn't clearly support or challenge an existing claim, add a claim for it (or fold it into the closest-fitting claim) rather than leaving it unlinked.
- Every claim link's paperId must reference a paper in your "papers" array.
- Every nextTest.paperIds entry must reference a paper in your "papers" array.
- Keep text concise and evidence-grounded; do not invent findings beyond what the abstract supports.
- If the retrieved evidence is thin or absent, say so honestly via "insufficient" and "unknown" uncertainty — do not pad.`;

function buildUserPrompt(input, papers) {
  const papersBlock = papers
    .map(
      (p, i) =>
        `[${i + 1}] id=${p.id} year=${p.year ?? 'unknown'} hintedStudyType=${p.hintedStudyType ?? 'unknown'} url=${p.url}\ntitle: ${p.title}\nabstract: ${p.abstract.slice(0, 1200)}`,
    )
    .join('\n\n');

  return `Drug: ${input.drug}
Disease: ${input.disease}
Proposed mechanism: ${input.mechanism || '(not specified)'}

Retrieved abstracts (${papers.length}):

${papersBlock}`;
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in model response');
  return JSON.parse(raw.slice(start, end + 1));
}

function validateShape(result, papers) {
  const ids = new Set(papers.map((p) => p.id));
  if (!Array.isArray(result.papers) || result.papers.length === 0) throw new Error('Missing papers');
  if (!Array.isArray(result.claims)) throw new Error('Missing claims');
  if (!Array.isArray(result.uncertainty)) throw new Error('Missing uncertainty');
  if (!result.verdict?.nextTest) throw new Error('Missing verdict');
  for (const p of result.papers) {
    if (!ids.has(p.id)) throw new Error(`Unknown paper id in output: ${p.id}`);
  }

  // The model is asked to link every paper to a claim but can miss one;
  // attach any orphaned paper to its best-fitting claim (by stance) so the
  // graph never has to render a disconnected node.
  const linked = new Set(result.claims.flatMap((c) => c.links.map((l) => l.paperId)));
  const orphans = result.papers.filter((p) => !linked.has(p.id));
  if (orphans.length && result.claims.length) {
    for (const paper of orphans) {
      const target =
        result.claims.find((c) => c.links.some((l) => l.relation === paper.stance)) || result.claims[0];
      target.links.push({ paperId: paper.id, relation: paper.stance === 'challenges' ? 'challenges' : 'supports' });
    }
  }

  return result;
}

async function runAnalysis(anthropic, input, onStage = () => {}) {
  const query = `(${input.drug}) AND (${input.disease})`;

  onStage('search');
  const found = await searchEuropePMC(query, 12);

  onStage('dedupe');
  const seen = new Set();
  const papers = found.filter((p) => {
    const key = p.title.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (papers.length === 0) {
    const stageCounts = { search: 0, dedupe: 0, extract: 0, compare: 0, recommend: 1 };
    onStage('extract');
    onStage('compare');
    onStage('recommend');
    return {
      papers: [],
      claims: [],
      stages: STAGES.map((s) => ({ ...s, count: stageCounts[s.key] })),
      uncertainty: [
        { area: 'Mechanism', status: 'unknown', note: 'No literature retrieved for this pair' },
        { area: 'Biological context', status: 'unknown', note: 'No literature retrieved for this pair' },
        { area: 'Clinical efficacy', status: 'unknown', note: 'No literature retrieved for this pair' },
        { area: 'Safety', status: 'unknown', note: 'No literature retrieved for this pair' },
      ],
      verdict: {
        label: 'insufficient',
        strongestChallenge: 'No retrievable evidence links this drug and disease; the hypothesis is untested in the literature we can access.',
        assumptions: ['A mechanistic connection exists at all', 'Prior unpublished or non-indexed evidence is not required to evaluate this pair'],
        nextTest: {
          question: 'Does any preclinical evidence support this drug-disease link?',
          experiment: `Run an initial in vitro screen of ${input.drug} against relevant ${input.disease} models to establish baseline signal before further investigation.`,
          outcomes: [
            { result: 'A measurable effect is observed', implies: 'Proceed to targeted literature search and mechanism studies' },
            { result: 'No effect is observed', implies: 'Deprioritize this hypothesis' },
          ],
          rationale: 'With zero retrieved evidence, the highest-value next step is generating a first data point, not further literature review.',
          paperIds: [],
        },
      },
    };
  }

  const capped = papers.slice(0, 6);

  onStage('extract');
  const message = await anthropic.messages.create({
    model: 'claude-haiku-5-5',
    max_tokens: 6144,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(input, capped) }],
  });

  if (message.stop_reason === 'max_tokens') {
    throw new Error('Model response was truncated (max_tokens reached)');
  }

  onStage('compare');
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const result = validateShape(extractJson(text), capped);

  onStage('recommend');
  const stageCounts = {
    search: found.length,
    dedupe: papers.length,
    extract: result.papers.length,
    compare: result.papers.length,
    recommend: 1,
  };

  return {
    papers: result.papers,
    claims: result.claims,
    stages: STAGES.map((s) => ({ ...s, count: stageCounts[s.key] })),
    uncertainty: result.uncertainty,
    verdict: result.verdict,
  };
}

module.exports = { runAnalysis, STAGES };
