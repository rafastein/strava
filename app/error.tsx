"use client"; // Limites de erro precisam ser Client Components

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="ui-page">
      <main className="ui-container" style={{ maxWidth: 560, paddingTop: 48 }}>
        <section className="ui-card ui-card--pad ui-stack" role="alert">
          <h1 className="ui-title">Não deu para carregar esta página</h1>
          <p style={{ fontSize: 15, color: "var(--ui-text-2)" }}>
            Algo falhou ao montar os dados. Pode ser instabilidade do Strava ou do banco de dados; tentar de novo
            costuma resolver.
          </p>
          <button type="button" className="ui-btn" style={{ border: 0, cursor: "pointer" }} onClick={() => unstable_retry()}>
            Tentar de novo
          </button>
          {error.digest ? <p className="ui-muted">Código do erro: {error.digest}</p> : null}
        </section>
      </main>
    </div>
  );
}
