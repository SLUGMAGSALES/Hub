export default function Loading() {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="crumb muted">← Contacts</div>
          <h1 className="muted">Loading…</h1>
        </div>
      </div>
      <div className="detail-grid">
        <div className="card">
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="skeleton skel-row" key={i} />
          ))}
        </div>
        <div className="stack">
          <div className="card">
            <div className="skeleton skel-row" />
            <div className="skeleton skel-row" />
          </div>
        </div>
      </div>
    </>
  );
}
