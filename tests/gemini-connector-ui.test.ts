import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GEMINI_MODEL_PRESETS,
  probeApiConnector,
} from "../app/lib/api.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, "..");

test("GEMINI_MODEL_PRESETS lists current Gemini 4 models and zero deprecated models", () => {
  const ids = GEMINI_MODEL_PRESETS.map((m) => m.id);
  assert.deepEqual(ids, [
    "gemini-4-carbon",
    "gemini-4-argon",
    "gemini-4-hydrogen",
    "gemini-3.5-flash-lite",
  ]);
  for (const id of ids) {
    assert.ok(!id.startsWith("gemini-2.5"), `Deprecated model found: ${id}`);
    assert.ok(!id.startsWith("gemini-2.0"), `Deprecated model found: ${id}`);
    assert.ok(!id.startsWith("gemini-1.5"), `Deprecated model found: ${id}`);
  }
});

test("probeApiConnector posts to /api/m07/api-connectors/{id}/test and returns latency + resolved_model", async () => {
  let receivedMethod = "";
  let receivedPath = "";
  let receivedBody: Record<string, unknown> = {};

  const server = http.createServer((req, res) => {
    receivedMethod = req.method ?? "";
    receivedPath = req.url ?? "";
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      receivedBody = raw ? JSON.parse(raw) : {};
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          provider: "google-gemini",
          resolved_model: "gemini-4-hydrogen",
          latency_ms: 142,
          sample_reply: "Đã kết nối thành công với Hệ thống AI UBND cấp xã.",
          detail: "Kết nối thành công tới gemini-4-hydrogen.",
        }),
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;

  try {
    const result = await probeApiConnector(
      1,
      {
        provider: "google-gemini",
        base_url: "https://generativelanguage.googleapis.com",
        model_name: "gemini-4-hydrogen",
        api_key: "AIzaSyTestProbe123456",
      },
      `http://127.0.0.1:${port}`,
    );
    assert.equal(receivedMethod, "POST");
    assert.equal(receivedPath, "/api/m07/api-connectors/1/test");
    assert.equal(receivedBody.provider, "google-gemini");
    assert.equal(receivedBody.model_name, "gemini-4-hydrogen");
    assert.equal(result.ok, true);
    assert.equal(result.resolved_model, "gemini-4-hydrogen");
    assert.equal(result.latency_ms, 142);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("m07-admin.tsx renders Gemini 4 connector selector, AI Studio guide link, and live probe button", () => {
  const m07Src = fs.readFileSync(
    path.join(APP_ROOT, "app/routes/m07-admin.tsx"),
    "utf8",
  );
  assert.ok(m07Src.includes("google-gemini"));
  assert.ok(m07Src.includes("GEMINI_MODEL_PRESETS"));
  assert.ok(m07Src.includes("https://aistudio.google.com/apikey"));
  assert.ok(m07Src.includes("probeApiConnector"));
  assert.ok(m07Src.includes("Kiểm tra kết nối AI"));
  assert.ok(!m07Src.includes("transition-all"));
});

test("m01-assistant.tsx displays model_used badge when returned on assistant messages", () => {
  const m01Src = fs.readFileSync(
    path.join(APP_ROOT, "app/routes/m01-assistant.tsx"),
    "utf8",
  );
  assert.ok(m01Src.includes("msg.model_used"));
  assert.ok(!m01Src.includes("transition-all"));
});
