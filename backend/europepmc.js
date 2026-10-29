const BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';

// Narrows Europe PMC's broad pubTypeList into the small set the UI distinguishes.
function inferStudyType(pubTypeList) {
  const types = (pubTypeList?.pubType || []).map((t) => t.toLowerCase());
  const has = (...needles) => types.some((t) => needles.some((n) => t.includes(n)));
  if (has('review', 'systematic review', 'meta-analysis')) return 'review';
  if (has('randomized controlled trial', 'clinical trial')) return 'rct';
  if (has('observational study', 'comparative study', 'cohort')) return 'cohort';
  return null; // left for the model to infer from the abstract (cell vs animal)
}

async function searchEuropePMC(query, pageSize = 12) {
  const url = `${BASE}?query=${encodeURIComponent(query)}&format=json&pageSize=${pageSize}&resultType=core`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Europe PMC request failed: ${res.status}`);
  const data = await res.json();
  return (data.resultList?.result || [])
    .filter((r) => r.abstractText)
    .map((r) => ({
      id: r.pmid || r.id,
      title: r.title,
      year: Number(r.pubYear) || null,
      abstract: r.abstractText,
      url: r.doi
        ? `https://doi.org/${r.doi}`
        : `https://europepmc.org/article/${r.source}/${r.id}`,
      hintedStudyType: inferStudyType(r.pubTypeList),
    }));
}

module.exports = { searchEuropePMC };
