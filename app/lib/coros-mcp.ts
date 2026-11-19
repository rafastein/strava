import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { COROS_MCP_URL, getCorosAccessToken } from "./coros-oauth";

// Chamada a uma ferramenta do MCP do COROS com o token salvo. Devolve o texto da resposta.

function isUnauthorized(error: unknown) {
  if ((error as { code?: unknown })?.code === 401) return true;
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /401|unauthori[sz]ed|invalid_token/i.test(text);
}

export async function callCorosToolWithToken(accessToken: string, name: string, args: Record<string, unknown>) {
  const client = new Client({ name: "strava-do-rafa", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(COROS_MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  try {
    await client.connect(transport);
    const result = await client.callTool({ name, arguments: args });
    const content = Array.isArray(result.content) ? result.content : [];
    const text = content
      .filter((item): item is { type: "text"; text: string } => item?.type === "text" && typeof item.text === "string")
      .map((item) => item.text)
      .join("\n");

    if (result.isError) throw new Error(`COROS recusou ${name}: ${text.slice(0, 300)}`);
    return text;
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function callCorosTool(name: string, args: Record<string, unknown> = {}) {
  const token = await getCorosAccessToken();
  if (!token) throw new Error("COROS não conectado: conecte na página do COROS.");

  try {
    return await callCorosToolWithToken(token, name, args);
  } catch (error) {
    // Token revogado ou expirado antes da hora: renova uma vez e tenta de novo.
    if (!isUnauthorized(error)) throw error;
    const fresh = await getCorosAccessToken({ forceRefresh: true });
    if (!fresh) throw error;
    return callCorosToolWithToken(fresh, name, args);
  }
}
