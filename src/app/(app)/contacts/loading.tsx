export default function Loading() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Contacts</h1>
          <p className="muted">Loading directory…</p>
        </div>
      </div>
      <div className="filterbar">
        <div className="skeleton skel-bar" />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: 16 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="skeleton skel-row" key={i} />
          ))}
        </div>
      </div>
    </>
  );
}
