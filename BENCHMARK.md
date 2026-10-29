# FalsifyRx benchmark results

**Question:** does FalsifyRx reach the same conclusion the scientific community reached, using only retrieved literature?

We ran it on 14 drug–disease hypotheses whose real-world outcome is settled: 5 large trials that found no benefit, 3 approved repurposings, 1 open question, 1 made-up drug, and 4 held-out cases.

## Headline numbers

| Metric | Result |
|---|---|
| Verdict matches the known outcome | **13 / 14** |
| Held-out cases (not used while tuning) | **4 / 4** |
| Findings whose supporting quote appears verbatim in the paper's abstract | **99 / 104** (95%) |
| Recommended next tests that cite retrieved papers | **13 / 13** |
| Made-up drug: invented evidence | **none** (0 papers, "insufficient evidence") |
| Papers cited that were not retrieved | **0** (invalid IDs are dropped and counted) |
| Time per analysis | about 30 s |

Single run on 2026-10-28, `claude-haiku-5-5` with live Europe PMC retrieval. Full per-case data: [backend/eval/results.md](backend/eval/results.md) and [results.json](backend/eval/results.json). Reproduce with `cd backend && npm run eval`.

## Results by case

| Hypothesis | Known outcome | FalsifyRx | Match |
|---|---|---|---|
| Hydroxychloroquine → COVID-19 | Large RCTs: no mortality benefit | Challenged | ✓ |
| Ivermectin → COVID-19 | TOGETHER, ACTIV-6: no benefit | Insufficient evidence | ✗ |
| Vitamin E → Prostate cancer | SELECT: no benefit | Challenged | ✓ |
| Beta-carotene → Lung cancer | ATBC, CARET: higher incidence in smokers | Challenged | ✓ |
| Estrogen → Coronary heart disease | WHI, HERS: no cardioprotection | Challenged | ✓ |
| Sildenafil → Pulmonary arterial hypertension | Approved after positive RCTs | Not challenged | ✓ |
| Thalidomide → Multiple myeloma | Approved; survival benefit | Not challenged | ✓ |
| Propranolol → Infantile hemangioma | First-line after positive RCT | Not challenged | ✓ |
| Metformin → Glioblastoma | Preclinical signal, no clinical proof | Insufficient evidence | ✓ |
| "Zorvaquintide" → Glioblastoma | Made-up drug | Insufficient evidence | ✓ |
| Vitamin D → Cardiovascular disease *(held-out)* | VITAL: no reduction in events | Challenged | ✓ |
| Celecoxib → Alzheimer's disease *(held-out)* | ADAPT: no prevention benefit | Challenged | ✓ |
| Imatinib → Chronic myeloid leukemia *(held-out)* | Standard of care after IRIS | Not challenged | ✓ |
| Rituximab → Rheumatoid arthritis *(held-out)* | Approved after positive RCTs | Not challenged | ✓ |

"Not challenged" means no comparable-design evidence contradicts the hypothesis. It does not mean the hypothesis is proven.

## How it stays honest

- **Searches both sides.** Five Europe PMC queries run in parallel: clinical studies, supporting trials, contradicting evidence, mechanism, and a general query. The results are balanced so one query can't crowd out the others.
- **The AI audits its own search.** After the first retrieval, the model reviews the titles, flags papers about the wrong drug or disease, and writes better queries if the primary trials are missing. This is what fixed thalidomide: the first pass returned lenalidomide and pomalidomide papers, and the refined search found the thalidomide phase III trial.
- **Weighs study design, not paper count.** A randomized trial outweighs any number of cell studies, and a well-powered null trial counts as evidence against the hypothesis.
- **Checks quotes.** Every finding carries a quote copied from the abstract, and the server verifies that it appears there.

## Caveats

- **Tuning.** The first 10 cases were used while we adjusted queries and prompts, so their score (9/10) is optimistic. The 4 held-out cases were added afterwards and not tuned on. That's a small sample.
- **Run-to-run variation.** The model gives slightly different answers each time. Across runs on the same code, the full set scored 10/10 once, and 9/10 once when a malformed model reply caused a crash that we have since made less likely with more retries. Ivermectin switches between "challenged" and "insufficient evidence"; it has never returned a false "not challenged" since the null-trial rule was added.
- **Scope.** This tests agreement with settled literature on a small, hand-picked set. It does not show the tool predicts clinical efficacy or finds new discoveries. Quotes found in the abstract means the finding is grounded, not that the paper is correct.
