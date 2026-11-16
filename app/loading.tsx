export default function Loading() {
  return (
    <div className="ui-page" role="status" aria-live="polite" style={{ display: "grid", placeItems: "center" }}>
      <p className="ui-muted" style={{ fontSize: 14 }}>Carregando dados…</p>
    </div>
  );
}
