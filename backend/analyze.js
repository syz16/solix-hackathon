const { searchEuropePMC } = require('./europepmc');

const MAX_PAPERS = 8;

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
      "finding": string (<=160 chars, one concrete takeaway),
      "quote": string (a short verbatim span copied exactly from that paper's abstract that backs the finding, <=200 chars) }
  ],
  "claims": [
    { "id": string (e.g. "c1"), "kind": "mechanism"|"outcome"|"counterargument", "text": string,
      "links": [ { "paperId": string, "relation": "supports"|"challenges" } ] }
  ],
  "uncertainty": [
    { "area": "Mechanism"|"Biological context"|"Clinical efficacy"|"Safety", "status": "supported"|"mixed"|"unknown",
      "note": string (<=140 chars) }
  ],
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
- Every claim link's paperId must reference a paper in your "papers" array.
- Every nextTest.paperIds entry must reference a paper in your "papers" array.
- Each "quote" must be copied character-for-character from the given abstract; it is checked automatically.
- Weigh evidence by study design, not paper count: randomized trials > cohort/observational > animal > cell > review/speculation. \
One well-controlled clinical study outweighs several preclinical ones. Base the verdict on the strongest-design evidence.
- Evidence was deliberately retrieved from both sides. Do not treat a mix of supporting and contradicting papers as automatically "insufficient": \
compare the strongest-design papers on each side and let those decide the verdict.
- Decide the verdict on whether the drug has the claimed effect on the disease. A mechanism that was never directly measured is an assumption to list \
and to design the next test around; it only lowers the verdict to "insufficient" if no strong-design study shows the effect at all, \
and it only supports "challenged" if evidence contradicts the effect or the mechanism.
- A well-powered randomized trial or meta-analysis that finds no benefit, no difference from control, or harm counts as "challenges", \
not "neutral": a null result is evidence against the hypothesis. Mark "neutral" only when a paper does not test the hypothesis.
- Supporting evidence from cell, animal, in-silico, or surrogate-endpoint studies cannot override a contradicting randomized trial or meta-analysis; \
when they conflict, the verdict follows the clinical-outcome evidence.
- Use "challenged" when strong-design evidence contradicts the hypothesis, "not_challenged" when at least one randomized trial or meta-analysis directly supports the hypothesis \
and no comparable-design evidence contradicts it (weaker contradicting papers should be listed as limitations, not decide the verdict), and "insufficient" when only weak or indirect evidence exists.
- Keep text concise and evidence-grounded; do not invent findings beyond what the abstract supports.
- If the retrieved evidence is thin or absent, say so honestly via "insufficient" and "unknown" uncertainty — do not pad.`;

// Several targeted queries so the evidence set isn't left to relevance ranking:
// a falsification tool has to go looking for contradicting and clinical evidence.
function buildQueries(input) {
  // Title/abstract match keeps neighbouring drugs out; sort_cited surfaces landmark trials over the newest papers.
  const clean = (t) => t.replace(/["()]/g, ' ').trim();
  const base = `(TITLE_ABS:"${clean(input.drug)}") AND (TITLE_ABS:"${clean(input.disease)}")`;
  const byCitations = ' sort_cited:y';
  const queries = [
    { key: 'clinical', query: `${base} AND (PUB_TYPE:"Clinical Trial" OR PUB_TYPE:"Randomized Controlled Trial" OR PUB_TYPE:"Observational Study")${byCitations}` },
    { key: 'supporting', query: `${base} AND (PUB_TYPE:"Clinical Trial" OR PUB_TYPE:"Randomized Controlled Trial" OR PUB_TYPE:"Meta-Analysis") AND (efficacy OR effective OR improved OR benefit OR "significantly reduced" OR approved)${byCitations}` },
    { key: 'contradicting', query: `${base} AND ("no effect" OR "no benefit" OR "did not" OR ineffective OR failed OR resistance OR "no significant")${byCitations}` },
    { key: 'base', query: base },
  ];
  if (input.mechanism) queries.splice(2, 0, { key: 'mechanism', query: `${base} AND (${clean(input.mechanism)})` });
  return queries;
}

async function retrieve(input) {
  const queries = buildQueries(input);
  const settled = await Promise.allSettled(queries.map((q) => searchEuropePMC(q.query, 8)));
  if (settled.every((r) => r.status === 'rejected')) throw settled[0].reason;
  return queries.map((q, i) => ({
    ...q,
    papers: settled[i].status === 'fulfilled' ? settled[i].value.map((p) => ({ ...p, retrievedBy: q.key })) : [],
    error: settled[i].status === 'rejected' ? settled[i].reason.message : undefined,
  }));
}

// Round-robin across query buckets (in priority order) so one query can't crowd out the others.
function selectBalanced(buckets, limit) {
  const seen = new Set();
  const picked = [];
  const queues = buckets.map((b) => [...b.papers]);
  while (picked.length < limit && queues.some((q) => q.length)) {
    for (const q of queues) {
      while (q.length) {
        const p = q.shift();
        const keys = [p.id, p.title.trim().toLowerCase()];
        if (keys.some((k) => seen.has(k))) continue;
        keys.forEach((k) => seen.add(k));
        picked.push(p);
        break;
      }
      if (picked.length >= limit) break;
    }
  }
  return picked;
}

const normalize = (t) => String(t || '').replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

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

const ENUMS = {
  studyType: ['rct', 'cohort', 'cell', 'animal', 'review'],
  stance: ['supports', 'challenges', 'neutral'],
  directness: ['direct', 'indirect', 'speculative'],
  status: ['supported', 'mixed', 'unknown'],
  verdict: ['challenged', 'not_challenged', 'insufficient'],
};
const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

// Repairs the model output against the retrieved set instead of trusting it: unknown paper ids
// are dropped (and counted), enums are coerced, and each quote is checked against its abstract.
function sanitize(result, papers) {
  if (!Array.isArray(result.papers)) throw new Error('Missing papers');
  if (!Array.isArray(result.claims)) throw new Error('Missing claims');
  if (!Array.isArray(result.uncertainty)) throw new Error('Missing uncertainty');
  if (!result.verdict?.nextTest) throw new Error('Missing verdict');

  const byId = new Map(papers.map((p) => [p.id, p]));
  const dropped = [];
  const keep = (id) => (byId.has(id) ? true : (dropped.push(id), false));

  const outPapers = result.papers.filter((p) => keep(p.id)).map((p) => {
    const source = byId.get(p.id);
    const quote = String(p.quote || '').trim();
    return {
      ...p,
      title: source.title,
      url: source.url,
      year: source.year ?? p.year,
      studyType: pick(p.studyType, ENUMS.studyType, source.hintedStudyType || 'review'),
      stance: pick(p.stance, ENUMS.stance, 'neutral'),
      directness: pick(p.directness, ENUMS.directness, 'indirect'),
      quote,
      quoteVerified: quote.length >= 12 && normalize(source.abstract).includes(normalize(quote)),
      retrievedBy: source.retrievedBy,
    };
  });
  if (outPapers.length === 0) throw new Error('Model returned no valid papers');
  const validIds = new Set(outPapers.map((p) => p.id));
  const valid = (id) => (validIds.has(id) ? true : (dropped.push(id), false));

  const claims = result.claims.map((c) => ({
    ...c,
    links: (c.links || []).filter((l) => valid(l.paperId)).map((l) => ({ ...l, relation: pick(l.relation, ['supports', 'challenges'], 'supports') })),
  }));
  const uncertainty = result.uncertainty.map((u) => ({
    ...u,
    status: pick(u.status === 'known' ? 'supported' : u.status, ENUMS.status, 'unknown'),
  }));
  const { nextTest } = result.verdict;
  const verdict = {
    ...result.verdict,
    label: pick(result.verdict.label, ENUMS.verdict, 'insufficient'),
    assumptions: result.verdict.assumptions || [],
    nextTest: { ...nextTest, outcomes: nextTest.outcomes || [], paperIds: (nextTest.paperIds || []).filter(valid) },
  };

  return { papers: outPapers, claims, uncertainty, verdict, droppedIds: dropped };
}

// The model occasionally emits malformed JSON (e.g. an unescaped quote); one retry usually clears it.
async function withRetry(fn, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i >= attempts) throw error;
      console.warn(`Analysis attempt ${i} failed, retrying:`, error.message);
    }
  }
}

const REFINE_PROMPT = `You review literature-search results for a drug-repurposing hypothesis and fix bad searches. \
You get a drug, a disease, and the titles of papers a first search returned from Europe PMC. Decide whether the set is on target: \
papers must study THIS drug (not a related drug, class member, or combination where the drug is incidental) in THIS disease, \
and the set should include primary clinical evidence (trials, cohorts) if any exists.

Respond with ONLY a JSON object:
{
  "onTarget": boolean,
  "problems": string (<=200 chars; empty if onTarget),
  "offTargetIds": [string] (ids of papers that are not about this drug in this disease),
  "queries": [ { "query": string, "purpose": string } ] (0-2 replacement searches; empty if onTarget)
}

Query syntax (Europe PMC): TITLE_ABS:"term", PUB_TYPE:"Randomized Controlled Trial", PUB_TYPE:"Clinical Trial", PUB_TYPE:"Meta-Analysis", AND, OR, parentheses, \
and a trailing "sort_cited:y" to rank landmark papers first. Every query must require the drug (include synonyms, brand and older names with OR) \
and the disease (include synonyms with OR). Prefer queries that target primary trials of this exact drug. Do not invent study results. Keep every string short; no commentary outside the JSON.`;

async function refineRetrieval(anthropic, input, papers) {
  try {
    const list = papers.map((p) => `id=${p.id} year=${p.year ?? '?'} type=${p.hintedStudyType ?? '?'} title: ${p.title}`).join('\n');
    const message = await anthropic.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 3072,
      system: REFINE_PROMPT,
      messages: [{ role: 'user', content: `Drug: ${input.drug}\nDisease: ${input.disease}\n\nFirst-pass results:\n${list}` }],
    });
    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    const review = extractJson(text);
    if (review.onTarget && !(review.offTargetIds || []).length) return { onTarget: true, buckets: [], excluded: new Set(), queries: [] };

    const queries = (review.queries || []).filter((q) => typeof q.query === 'string' && q.query.trim()).slice(0, 2);
    const settled = await Promise.allSettled(queries.map((q) => searchEuropePMC(q.query, 8)));
    const buckets = queries.map((q, i) => ({
      key: 'refined',
      query: q.query,
      purpose: q.purpose,
      papers: settled[i].status === 'fulfilled' ? settled[i].value.map((p) => ({ ...p, retrievedBy: 'refined' })) : [],
      error: settled[i].status === 'rejected' ? settled[i].reason.message : undefined,
    }));
    const valid = new Set(papers.map((p) => p.id));
    return {
      onTarget: false,
      problems: String(review.problems || ''),
      buckets,
      excluded: new Set((review.offTargetIds || []).filter((id) => valid.has(id))),
      queries,
    };
  } catch (error) {
    console.warn('Query refinement skipped:', error.message);
    return null; // refinement is best-effort; fall back to the first-pass results
  }
}

async function runAnalysis(anthropic, input, onStage = () => {}) {
  onStage('search');
  let buckets = await retrieve(input);

  onStage('dedupe');
  let papers = selectBalanced(buckets, MAX_PAPERS);

  // Let the model audit the first pass: drop off-target papers and, if needed, search again with better queries.
  const refinement = papers.length ? await refineRetrieval(anthropic, input, papers) : null;
  if (refinement && !refinement.onTarget) {
    buckets = [...refinement.buckets, ...buckets].map((b) => ({
      ...b,
      papers: b.papers.filter((p) => !refinement.excluded.has(p.id)),
    }));
    papers = selectBalanced(buckets, MAX_PAPERS);
  }
  const foundCount = buckets.reduce((n, b) => n + b.papers.length, 0);
  const meta = {
    queries: buckets.map((b) => ({ key: b.key, query: b.query, count: b.papers.length, error: b.error })),
    refinement: refinement && {
      onTarget: refinement.onTarget,
      problems: refinement.problems,
      excludedIds: [...refinement.excluded],
      queries: refinement.queries,
    },
  };

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
      meta,
    };
  }

  onStage('extract');
  const result = await withRetry(async () => {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(input, papers) }],
    });
    if (message.stop_reason === 'max_tokens') {
      throw new Error('Model response was truncated (max_tokens reached)');
    }
    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    return sanitize(extractJson(text), papers);
  });
  onStage('compare');

  onStage('recommend');
  const stageCounts = {
    search: foundCount,
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
    meta: {
      ...meta,
      droppedIds: result.droppedIds,
      quotesVerified: result.papers.filter((p) => p.quoteVerified).length,
    },
  };
}

module.exports = { runAnalysis, STAGES };
