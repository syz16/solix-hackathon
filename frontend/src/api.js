import { sampleAnalysis } from './data/analysis';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';
const STAGE_KEYS = sampleAnalysis.stages.map((s) => s.key);

// Calls the real backend pipeline while animating through the known stage
// list client-side, since the backend responds once rather than streaming.
// Only falls back to the sample fixture if the backend is unreachable
// (network/connection failure); real API errors are surfaced to the caller.
export async function analyze(input, onStage = () => {}) {
  const request = fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Request failed');
    return res.json();
  });

  const stagePromise = (async () => {
    for (const key of STAGE_KEYS.slice(0, -1)) {
      await new Promise((r) => setTimeout(r, 500));
      onStage(key);
    }
  })();

  let result;
  try {
    [result] = await Promise.all([request, stagePromise]);
  } catch (err) {
    if (err instanceof TypeError) {
      // fetch() only throws TypeError for network-level failures (backend down/unreachable)
      await stagePromise;
      onStage(STAGE_KEYS[STAGE_KEYS.length - 1]);
      return { ...sampleAnalysis, input, isSample: true };
    }
    throw err;
  }

  onStage(STAGE_KEYS[STAGE_KEYS.length - 1]);
  return { ...result, input, isSample: false };
}
