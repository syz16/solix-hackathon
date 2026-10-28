import { sampleAnalysis } from './data/analysis';

// Single seam for the backend: swap the body for fetch('/api/analyze') later.
// onStage(key) fires as each pipeline stage completes.
export async function analyze(input, onStage = () => {}) {
  const analysis = sampleAnalysis;
  for (const stage of analysis.stages) {
    await new Promise((r) => setTimeout(r, 900));
    onStage(stage.key);
  }
  return { ...analysis, input };
}
