export default function UncertaintyGrid({ items }) {
  return (
    <div className="uncertainty">
      {items.map((u) => (
        <div key={u.area} className={`cell ${u.status}`}>
          <span className="label">{u.area}</span>
          <strong>{u.status}</strong>
          <p>{u.note}</p>
        </div>
      ))}
    </div>
  );
}
