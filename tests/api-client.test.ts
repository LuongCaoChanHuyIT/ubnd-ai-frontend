import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ApiError,
  apiRequest,
  extractServerAuthHeaders,
  fetchBackendHello,
  formatHttpErrorMessage,
  resolveClientApiBase,
  resolveServerApiBase,
  uploadSessionFile,
} from "../app/lib/api.ts";
import { proxyApiRequest } from "../app/routes/api-proxy.ts";
import {
  buildScopedSessionKey,
  createMemorySessionManager,
  getActiveActorEmail,
  getActiveTenantSlug,
  getOrInitSessionId,
  getSavedAssistantMode,
  parseServerCookies,
  rotateSessionId,
  setActiveActorEmail,
  setActiveTenantSlug,
  setSavedAssistantMode,
} from "../app/lib/session.ts";

function installMockBrowser() {
  const localMap = new Map<string, string>();
  const sessionMap = new Map<string, string>();
  const cookieJar = new Map<string, string>();
  const events: Array<{ type: string; detail: unknown }> = [];

  const mockStorage = (backing: Map<string, string>) => ({
    getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
    setItem: (k: string, v: string) => {
      backing.set(k, String(v));
    },
    removeItem: (k: string) => {
      backing.delete(k);
    },
    clear: () => backing.clear(),
  });

  const mockDoc = {
    get cookie() {
      return Array.from(cookieJar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    },
    set cookie(raw: string) {
      const firstPart = raw.split(";")[0] ?? "";
      const eqIdx = firstPart.indexOf("=");
      if (eqIdx > 0) {
        const key = firstPart.slice(0, eqIdx).trim();
        const val = firstPart.slice(eqIdx + 1).trim();
        cookieJar.set(key, val);
      }
    },
  };

  const mockWin = {
    localStorage: mockStorage(localMap),
    sessionStorage: mockStorage(sessionMap),
    dispatchEvent: (ev: Event) => {
      const custom = ev as CustomEvent;
      events.push({ type: custom.type, detail: custom.detail });
      return true;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const prevWin = (globalThis as Record<string, unknown>).window;
  const prevDoc = (globalThis as Record<string, unknown>).document;
  (globalThis as Record<string, unknown>).window = mockWin;
  (globalThis as Record<string, unknown>).document = mockDoc;

  return {
    localMap,
    sessionMap,
    cookieJar,
    events,
    restore() {
      if (prevWin === undefined) delete (globalThis as Record<string, unknown>).window;
      else (globalThis as Record<string, unknown>).window = prevWin;
      if (prevDoc === undefined) delete (globalThis as Record<string, unknown>).document;
      else (globalThis as Record<string, unknown>).document = prevDoc;
    },
  };
}

test("parseServerCookies & extractServerAuthHeaders read cookie identity with safe SSR defaults", () => {
  const fallback = parseServerCookies(null);
  assert.equal(fallback.actorEmail, "tsh.co@tshorg.vn");
  assert.equal(fallback.tenantSlug, "default");

  const parsed = parseServerCookies(
    "foo=bar; ubnd_actor_email=canbo.nnmt%40ubnd.vn; ubnd_tenant_slug=ubnd-phuong-hoa-xuan",
  );
  assert.equal(parsed.actorEmail, "canbo.nnmt@ubnd.vn");
  assert.equal(parsed.tenantSlug, "ubnd-phuong-hoa-xuan");

  const req = new Request("http://127.0.0.1:3000/nguon-van-ban?dept=NNMT", {
    headers: {
      cookie:
        "ubnd_actor_email=canbo.nnmt%40ubnd.vn; ubnd_tenant_slug=ubnd-phuong-hoa-xuan",
    },
  });
  assert.deepEqual(extractServerAuthHeaders(req), {
    "X-Actor-Email": "canbo.nnmt@ubnd.vn",
    "X-Tenant-Slug": "ubnd-phuong-hoa-xuan",
  });
});

test("browser session sync initializes default cookies and syncs localStorage + document.cookie", () => {
  const env = installMockBrowser();
  try {
    // First browser visit without cookies initializes defaults in both localStorage & cookie
    assert.equal(getActiveActorEmail(), "tsh.co@tshorg.vn");
    assert.equal(getActiveTenantSlug(), "default");
    assert.equal(
      decodeURIComponent(env.cookieJar.get("ubnd_actor_email") ?? ""),
      "tsh.co@tshorg.vn",
    );
    assert.equal(env.cookieJar.get("ubnd_tenant_slug"), "default");

    setActiveActorEmail("canbo.kt@ubnd.vn");
    setActiveTenantSlug("ubnd-xa-dong-anh");
    assert.equal(getActiveActorEmail(), "canbo.kt@ubnd.vn");
    assert.equal(getActiveTenantSlug(), "ubnd-xa-dong-anh");
    assert.equal(
      decodeURIComponent(env.cookieJar.get("ubnd_actor_email") ?? ""),
      "canbo.kt@ubnd.vn",
    );
    assert.equal(env.cookieJar.get("ubnd_tenant_slug"), "ubnd-xa-dong-anh");

    // Assistant mode persists in sessionStorage
    assert.equal(getSavedAssistantMode(), "nghiep_vu");
    setSavedAssistantMode("tham_dinh");
    assert.equal(getSavedAssistantMode(), "tham_dinh");
  } finally {
    env.restore();
  }
});

test("session IDs are isolated per (tenantSlug, actorEmail, deptId) tuple", () => {
  const env = installMockBrowser();
  try {
    const keyVp = buildScopedSessionKey("VP", "tsh.co@tshorg.vn", "default");
    const keyKt = buildScopedSessionKey("KT", "tsh.co@tshorg.vn", "default");
    const keyClone = buildScopedSessionKey("VP", "tsh.co@tshorg.vn", "ubnd-hoa-xuan");
    assert.notEqual(keyVp, keyKt);
    assert.notEqual(keyVp, keyClone);

    const sidVp = getOrInitSessionId("VP");
    const sidKt = getOrInitSessionId("KT");
    assert.notEqual(sidVp, sidKt);
    assert.equal(getOrInitSessionId("VP"), sidVp);

    const rotatedVp = rotateSessionId("VP");
    assert.notEqual(rotatedVp, sidVp);
    // KT session remains untouched when VP session is wiped/rotated
    assert.equal(getOrInitSessionId("KT"), sidKt);
  } finally {
    env.restore();
  }
});

test("apiRequest sends JSON body, X-Actor-Email, X-Tenant-Slug headers and parses response", async () => {
  let receivedActor = "";
  let receivedTenant = "";
  let receivedMethod = "";
  const server = http.createServer((req, res) => {
    receivedActor = String(req.headers["x-actor-email"] ?? "");
    receivedTenant = String(req.headers["x-tenant-slug"] ?? "");
    receivedMethod = String(req.method ?? "");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;

  try {
    const res = await apiRequest<{ ok: boolean }>("/api/departments", {
      method: "POST",
      body: { ping: 1 },
      baseUrl: `http://127.0.0.1:${port}`,
      actorEmail: "tsh.co@tshorg.vn",
      tenantSlug: "ubnd-hoa-xuan",
    });
    assert.equal(res.ok, true);
    assert.equal(receivedActor, "tsh.co@tshorg.vn");
    assert.equal(receivedTenant, "ubnd-hoa-xuan");
    assert.equal(receivedMethod, "POST");
  } finally {
    server.close();
  }
});

test("apiRequest & formatHttpErrorMessage surface Vietnamese errors for 401, 403, 400, 409, 413", async () => {
  assert.match(formatHttpErrorMessage(401), /401|xác thực/i);
  assert.match(formatHttpErrorMessage(403), /403|quyền/i);
  assert.match(formatHttpErrorMessage(400), /400|không hợp lệ/i);
  assert.match(formatHttpErrorMessage(409), /409|trùng lặp|xung đột/i);
  assert.match(formatHttpErrorMessage(413), /413|10 MB|vượt quá/i);

  const server = http.createServer((_req, res) => {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ detail: "Chỉ Chủ sở hữu mới có quyền" }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;

  try {
    await assert.rejects(
      async () => {
        await apiRequest("/api/m07/users", {
          baseUrl: `http://127.0.0.1:${port}`,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 403);
        assert.match(err.message, /Chỉ Chủ sở hữu mới có quyền/);
        return true;
      },
    );
  } finally {
    server.close();
  }
});

test("uploadSessionFile passes ?department_id= and auth headers", async () => {
  let receivedUrl = "";
  let receivedActor = "";
  let receivedTenant = "";
  const server = http.createServer((req, res) => {
    receivedUrl = String(req.url ?? "");
    receivedActor = String(req.headers["x-actor-email"] ?? "");
    receivedTenant = String(req.headers["x-tenant-slug"] ?? "");
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          session_id: "sid-1",
          created_at: "",
          files: [],
          messages: [],
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;

  try {
    const sample = new File(["Nội dung thử nghiệm"], "test.txt", {
      type: "text/plain",
    });
    await uploadSessionFile(
      "sid-1",
      sample,
      "NNMT",
      "canbo.nnmt@ubnd.vn",
      "ubnd-hoa-xuan",
      `http://127.0.0.1:${port}`,
    );
    assert.equal(receivedUrl, "/api/m05/sessions/sid-1/upload?department_id=NNMT");
    assert.equal(receivedActor, "canbo.nnmt@ubnd.vn");
    assert.equal(receivedTenant, "ubnd-hoa-xuan");
  } finally {
    server.close();
  }
});

test("session manager rotates session ID cleanly on wipe", () => {
  const mgr = createMemorySessionManager();
  const first = mgr.getOrInitSessionId();
  const second = mgr.rotateSessionId();
  assert.notEqual(first, second);
  assert.equal(mgr.getOrInitSessionId(), second);
});

test("resolveClientApiBase & resolveServerApiBase handle env precedence, Node runtime safety, and trailing slashes", () => {
  const prevApi = process.env.API_BASE_URL;
  const prevVite = process.env.VITE_API_BASE_URL;
  try {
    delete process.env.API_BASE_URL;
    delete process.env.VITE_API_BASE_URL;
    assert.equal(resolveClientApiBase(), "");
    assert.equal(resolveServerApiBase(), "http://127.0.0.1:8000");

    process.env.VITE_API_BASE_URL = " https://api.ubnd.vn/// ";
    assert.equal(resolveClientApiBase(), "https://api.ubnd.vn");
    assert.equal(resolveServerApiBase(), "https://api.ubnd.vn");

    process.env.API_BASE_URL = "http://127.0.0.1:18000/";
    assert.equal(resolveServerApiBase(), "http://127.0.0.1:18000");
  } finally {
    if (prevApi === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = prevApi;
    if (prevVite === undefined) delete process.env.VITE_API_BASE_URL;
    else process.env.VITE_API_BASE_URL = prevVite;
  }
});

test("apiRequest and uploadSessionFile default to VITE_API_BASE_URL when baseUrl is omitted", async () => {
  const receivedPaths: string[] = [];
  const server = http.createServer((req, res) => {
    receivedPaths.push(String(req.url ?? ""));
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ session_id: "s1", created_at: "", files: [], messages: [] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const prevVite = process.env.VITE_API_BASE_URL;
  process.env.VITE_API_BASE_URL = `http://127.0.0.1:${port}///`;

  try {
    await apiRequest("/api/health");
    const blob = new File([Buffer.from("noi dung")], "hoso.txt", { type: "text/plain" });
    await uploadSessionFile("s1", blob, "VP", "tsh.co@tshorg.vn", "default");
    assert.deepEqual(receivedPaths, [
      "/api/health",
      "/api/m05/sessions/s1/upload?department_id=VP",
    ]);
  } finally {
    if (prevVite === undefined) delete process.env.VITE_API_BASE_URL;
    else process.env.VITE_API_BASE_URL = prevVite;
    server.close();
  }
});

test("home route uses resolveServerApiBase and fetchBackendHello honors VITE_API_BASE_URL without hardcoded empty baseUrl", async () => {
  const homeFile = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../app/routes/home.tsx",
  );
  const homeSrc = fs.readFileSync(homeFile, "utf-8");
  assert.match(homeSrc, /resolveServerApiBase\(\)/);
  assert.doesNotMatch(homeSrc, /baseUrl:\s*""/);

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Xin chào!",
        service: "ubnd-ai-backend",
        version: "1.0.0",
        timestamp: "2026-11-19T00:00:00Z",
      }),
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const prevVite = process.env.VITE_API_BASE_URL;
  process.env.VITE_API_BASE_URL = `http://127.0.0.1:${port}/`;

  try {
    const ping = await fetchBackendHello({ name: "UBND" });
    assert.equal(ping.connected, true);
  } finally {
    if (prevVite === undefined) delete process.env.VITE_API_BASE_URL;
    else process.env.VITE_API_BASE_URL = prevVite;
    server.close();
  }
});

test("proxyApiRequest forwards GET, POST JSON, multipart upload, auth headers, and upstream 413 status", async () => {
  const seen: Array<{ method: string; url: string; actor: string; tenant: string; bodyLen: number }> = [];
  const upstream = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const buf = Buffer.concat(chunks);
      seen.push({
        method: String(req.method ?? ""),
        url: String(req.url ?? ""),
        actor: String(req.headers["x-actor-email"] ?? ""),
        tenant: String(req.headers["x-tenant-slug"] ?? ""),
        bodyLen: buf.byteLength,
      });
      if ((req.url ?? "").startsWith("/api/oversize")) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ detail: "Quá 10 MB" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ proxied: true, bytes: buf.byteLength }));
    });
  });
  await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
  const port = (upstream.address() as { port: number }).port;
  const prevApi = process.env.API_BASE_URL;
  process.env.API_BASE_URL = `http://127.0.0.1:${port}/`;

  try {
    const getRes = await proxyApiRequest(
      new Request("https://ubnd-ai-frontend.vercel.app/api/m04/documents?department_id=VP", {
        headers: {
          "X-Actor-Email": "tsh.co@tshorg.vn",
          "X-Tenant-Slug": "ubnd-hoa-xuan",
        },
      }),
    );
    assert.equal(getRes.status, 200);
    assert.deepEqual(await getRes.json(), { proxied: true, bytes: 0 });

    const form = new FormData();
    form.append("file", new File([Buffer.from("pdf-binary-bytes")], "hs.pdf", { type: "application/pdf" }));
    const upRes = await proxyApiRequest(
      new Request("https://ubnd-ai-frontend.vercel.app/api/m05/sessions/s1/upload?department_id=KT", {
        method: "POST",
        headers: {
          "X-Actor-Email": "canbo.kt@ubnd.vn",
          "X-Tenant-Slug": "default",
        },
        body: form,
      }),
    );
    assert.equal(upRes.status, 200);
    const upJson = (await upRes.json()) as { bytes: number };
    assert.ok(upJson.bytes > 16);

    const errRes = await proxyApiRequest(
      new Request("https://ubnd-ai-frontend.vercel.app/api/oversize", { method: "POST", body: "x" }),
    );
    assert.equal(errRes.status, 413);
    assert.deepEqual(await errRes.json(), { detail: "Quá 10 MB" });

    assert.equal(seen[0]?.url, "/api/m04/documents?department_id=VP");
    assert.equal(seen[0]?.actor, "tsh.co@tshorg.vn");
    assert.equal(seen[0]?.tenant, "ubnd-hoa-xuan");
    assert.equal(seen[1]?.method, "POST");
  } finally {
    if (prevApi === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = prevApi;
    upstream.close();
  }
});

test("proxyApiRequest blocks self-proxy loops and returns 502 JSON when backend is unreachable", async () => {
  const loopRes = await proxyApiRequest(
    new Request("https://ubnd-ai-frontend.vercel.app/api/health", {
      headers: { "X-UBND-Proxy-Hop": "1" },
    }),
  );
  assert.equal(loopRes.status, 502);
  const loopJson = (await loopRes.json()) as { detail: string };
  assert.match(loopJson.detail, /vòng lặp|API_BASE_URL/i);

  const prevApi = process.env.API_BASE_URL;
  process.env.API_BASE_URL = "http://127.0.0.1:1";
  try {
    const downRes = await proxyApiRequest(
      new Request("https://ubnd-ai-frontend.vercel.app/api/health"),
    );
    assert.equal(downRes.status, 502);
    const downJson = (await downRes.json()) as { detail: string };
    assert.match(downJson.detail, /502|Backend/i);
  } finally {
    if (prevApi === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = prevApi;
  }
});

test("fetchBackendHello supports configurable cold-start timeoutMs and vercel.json disables framework preset", async () => {
  const slowServer = http.createServer((_req, res) => {
    setTimeout(() => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "OK sau cold start",
          service: "ubnd-ai-backend",
          version: "1.0.0",
          timestamp: "2026-11-19T00:00:00Z",
        }),
      );
    }, 140);
  });
  await new Promise<void>((r) => slowServer.listen(0, "127.0.0.1", r));
  const port = (slowServer.address() as { port: number }).port;

  try {
    const timedOut = await fetchBackendHello({
      baseUrl: `http://127.0.0.1:${port}`,
      timeoutMs: 40,
    });
    assert.equal(timedOut.connected, false);

    const okDefault = await fetchBackendHello({
      baseUrl: `http://127.0.0.1:${port}`,
    });
    assert.equal(okDefault.connected, true);
  } finally {
    slowServer.close();
  }

  const vercelPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../vercel.json",
  );
  const vercelCfg = JSON.parse(fs.readFileSync(vercelPath, "utf-8")) as {
    framework: unknown;
    outputDirectory: string;
    functions?: Record<string, { includeFiles?: string; maxDuration?: number }>;
  };
  assert.equal(vercelCfg.framework, null);
  assert.equal(vercelCfg.outputDirectory, "build/client");
  assert.equal(vercelCfg.functions?.["api/ssr.js"]?.maxDuration, 60);
  assert.equal(vercelCfg.functions?.["api/ssr.js"]?.includeFiles, "build/server/**");
});
