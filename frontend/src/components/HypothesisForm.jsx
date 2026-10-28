import { exampleInput } from '../data/analysis';

const fields = [
  ['drug', 'Drug', 'e.g. Metformin'],
  ['disease', 'Disease', 'e.g. Glioblastoma'],
  ['mechanism', 'Proposed mechanism', 'e.g. Altered cellular metabolism'],
];

export default function HypothesisForm({ value, onChange, onSubmit }) {
  const ready = value.drug.trim() && value.disease.trim();
  return (
    <form className="panel form" onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit(); }}>
      <div className="form-grid">
        {fields.map(([key, label, ph]) => (
          <label key={key}>
            <span className="label">{label}</span>
            <input value={value[key]} placeholder={ph} onChange={(e) => onChange({ ...value, [key]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="ghost" onClick={() => onChange(exampleInput)}>Load example</button>
        <button type="submit" className="primary" disabled={!ready}>Challenge hypothesis ↗</button>
      </div>
    </form>
  );
}
