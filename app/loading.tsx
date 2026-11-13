export default function Loading() {
  return (
    <div className="page" role="status" aria-live="polite" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <p className="ba-label" style={{ fontSize: 12 }}>Carregando dados…</p>
    </div>
  );
}
