import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { fetchBackendHello } from "../app/lib/api.ts";

test("fetchBackendHello parses greeting payload and query parameter from backend", async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const name = url.searchParams.get("name");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: name
          ? `Xin chào ${name} từ Backend Bộ Trợ lý AI!`
          : "Xin chào từ Backend Bộ Trợ lý AI UBND xã, phường!",
        service: "ubnd-ai-backend",
        version: "0.1.0",
        timestamp: "2026-11-18T01:20:00Z",
      }),
    );
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const result = await fetchBackendHello({ baseUrl, name: "UBND Xã Đông Anh" });
    assert.equal(result.connected, true);
    if (result.connected) {
      assert.equal(
        result.data.message,
        "Xin chào UBND Xã Đông Anh từ Backend Bộ Trợ lý AI!",
      );
      assert.equal(result.data.service, "ubnd-ai-backend");
      assert.ok(result.latencyMs >= 0);
    }
  } finally {
    server.close();
  }
});

test("fetchBackendHello returns connected: false cleanly when backend is offline", async () => {
  const result = await fetchBackendHello({ baseUrl: "http://127.0.0.1:1" });
  assert.equal(result.connected, false);
  if (!result.connected) {
    assert.ok(result.error.length > 0);
  }
});

