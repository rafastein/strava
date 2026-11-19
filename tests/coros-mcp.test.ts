import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// Servidor MCP local que imita o COROS: exige Bearer e responde queryTrainingSchedule em texto.
async function startFakeCorosMcp(expectedToken: string) {
  const seen: Array<Record<string, unknown>> = [];

  const server: Server = createServer(async (req: IncomingMessage, res) => {
    if (req.headers.authorization !== `Bearer ${expectedToken}`) {
      res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "invalid_token" }));
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;

    const mcp = new McpServer({ name: "fake-coros", version: "1.0.0" });
    mcp.registerTool(
      "queryTrainingSchedule",
      { inputSchema: { startDate: z.string().optional(), endDate: z.string().optional() } },
      async (args) => {
        seen.push(args);
        return { content: [{ type: "text", text: "Training Schedule\n========================\n\n2026-11-20\nRodagem\nDistance: 5.00 km" }] };
      },
    );
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void mcp.close();
    });
    await mcp.connect(transport);
    await transport.handleRequest(req, res, body);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/mcp`, seen, close: () => new Promise((r) => server.close(r)) };
}

test("cliente MCP chama a ferramenta com o token e devolve o texto", async () => {
  const fake = await startFakeCorosMcp("token-bom");
  process.env.COROS_MCP_URL = fake.url;
  try {
    // Importa depois de definir a URL: o módulo lê COROS_MCP_URL ao carregar.
    const { callCorosToolWithToken } = await import("../app/lib/coros-mcp");
    const text = await callCorosToolWithToken("token-bom", "queryTrainingSchedule", { startDate: "20261116", endDate: "20261122" });
    assert.match(text, /^Training Schedule/);
    assert.deepEqual(fake.seen, [{ startDate: "20261116", endDate: "20261122" }]);

    await assert.rejects(callCorosToolWithToken("token-ruim", "queryTrainingSchedule", {}), (error: unknown) => {
      assert.equal((error as { code?: number }).code, 401);
      return true;
    });
  } finally {
    delete process.env.COROS_MCP_URL;
    await fake.close();
  }
});
