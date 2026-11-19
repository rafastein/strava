"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchWithAdminRetry } from "../lib/admin-client";

type SyncStatus = {
  at: string;
  ok: boolean;
  trigger: string;
  saved?: number;
  removed?: number;
  error?: string;
} | null;

const RETURN_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  conectado: { text: "COROS conectado. A primeira sincronização já começou; atualize em alguns segundos.", ok: true },
  negado: { text: "A autorização foi recusada no COROS.", ok: false },
  invalido: { text: "O retorno do COROS não confere com o login iniciado aqui. Tente conectar de novo.", ok: false },
  erro: { text: "O COROS não concluiu o login.", ok: false },
};

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function CorosConnectionCard({
  connected,
  connectedAt,
  lastSync,
  redisConfigured,
  returnStatus,
  returnDetail,
}: {
  connected: boolean;
  connectedAt: string | null;
  lastSync: SyncStatus;
  redisConfigured: boolean;
  returnStatus: string | null;
  returnDetail: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    returnStatus && RETURN_MESSAGES[returnStatus]
      ? {
          ...RETURN_MESSAGES[returnStatus],
          text: [RETURN_MESSAGES[returnStatus].text, returnDetail].filter(Boolean).join(" "),
        }
      : null,
  );

  async function connect() {
    setBusy("connect");
    setMessage(null);
    try {
      const res = await fetchWithAdminRetry("/api/auth/coros/start", { method: "POST" });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error ?? "Não foi possível iniciar o login.");
      window.location.href = body.url;
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Falha ao conectar.", ok: false });
      setBusy(null);
    }
  }

  async function syncNow() {
    setBusy("sync");
    setMessage(null);
    try {
      const res = await fetchWithAdminRetry("/api/coros/sync", { method: "POST" });
      const body = (await res.json()) as NonNullable<SyncStatus>;
      if (!res.ok || !body.ok) throw new Error(body.error ?? "A sincronização falhou.");
      setMessage({
        text: `Agenda sincronizada: ${body.saved ?? 0} treinos gravados${body.removed ? `, ${body.removed} removidos` : ""}.`,
        ok: true,
      });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Falha ao sincronizar.", ok: false });
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!window.confirm("Desconectar o COROS? Os treinos já gravados continuam no site.")) return;
    setBusy("disconnect");
    try {
      const res = await fetchWithAdminRetry("/api/auth/coros/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Não foi possível desconectar.");
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Falha ao desconectar.", ok: false });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="ui-card ui-card--pad ui-stack" aria-label="Conexão com o COROS">
      <div className="ui-section__head" style={{ padding: 0, alignItems: "center" }}>
        <p className="ui-label-accent">Conexão com o COROS</p>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: connected ? (lastSync && !lastSync.ok ? "var(--ui-accent)" : "var(--ui-good)") : "var(--ui-muted)",
          }}
        >
          {connected ? (lastSync && !lastSync.ok ? "Com erro" : "Conectado") : "Desconectado"}
        </span>
      </div>

      {!redisConfigured ? (
        <p className="ui-muted" style={{ fontSize: 14 }}>
          A conexão precisa do Redis (Upstash) configurado no site.
        </p>
      ) : connected ? (
        <dl className="ui-dl">
          <div>
            <dt>Última sincronização</dt>
            <dd style={{ fontSize: 15 }}>
              {lastSync ? `${formatWhen(lastSync.at)} · ${lastSync.trigger}` : "ainda não rodou"}
            </dd>
          </div>
          <div>
            <dt>Resultado</dt>
            <dd style={{ fontSize: 15 }}>
              {lastSync
                ? lastSync.ok
                  ? `${lastSync.saved ?? 0} treinos${lastSync.removed ? ` · ${lastSync.removed} removidos` : ""}`
                  : lastSync.error ?? "falhou"
                : "—"}
            </dd>
          </div>
          {connectedAt ? (
            <div>
              <dt>Conectado em</dt>
              <dd style={{ fontSize: 15 }}>{formatWhen(connectedAt)}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="ui-muted" style={{ fontSize: 14 }}>
          Conecte a sua conta COROS para a agenda entrar sozinha: todo dia de madrugada e sempre que você abrir o site
          depois de 3 horas sem sincronizar.
        </p>
      )}

      {message ? (
        <p role="status" style={{ fontSize: 14, color: message.ok ? "var(--ui-good)" : "var(--ui-accent)" }}>
          {message.text}
        </p>
      ) : null}

      {redisConfigured ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {connected ? (
            <>
              <button type="button" className="ui-btn" onClick={syncNow} disabled={busy !== null}>
                {busy === "sync" ? "Sincronizando…" : "Sincronizar agora"}
              </button>
              <button type="button" className="ui-btn ui-btn--ghost" onClick={connect} disabled={busy !== null}>
                Reconectar
              </button>
              <button type="button" className="ui-btn ui-btn--ghost" onClick={disconnect} disabled={busy !== null}>
                Desconectar
              </button>
            </>
          ) : (
            <button type="button" className="ui-btn" onClick={connect} disabled={busy !== null}>
              {busy === "connect" ? "Abrindo o COROS…" : "Conectar COROS"}
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
