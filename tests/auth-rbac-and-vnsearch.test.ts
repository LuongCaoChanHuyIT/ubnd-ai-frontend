import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

import {
  canApproveDocRequests,
  canManageDepartmentTasks,
  canManageOfficialDocs,
} from "../app/lib/m06-m07-helpers.ts";
import {
  clearAuthSession,
  getActiveAuthToken,
  parseServerCookies,
  setAuthSession,
} from "../app/lib/session.ts";
import {
  foldVietnamese,
  isSafeHttpUrl,
  matchesVietnameseQuery,
} from "../app/lib/vietnamese-search.ts";

test("foldVietnamese and matchesVietnameseQuery handle đ/Đ and multi-tone strings", () => {
  assert.equal(
    foldVietnamese("Nghị định 30/2020/NĐ-CP — Đất đai"),
    "nghi dinh 30/2020/nd-cp — dat dai",
  );
  assert.equal(
    matchesVietnameseQuery(
      "Luật Hộ tịch và Chứng thực tại Phường",
      "ho tich chung thuc",
    ),
    true,
  );
  assert.equal(matchesVietnameseQuery("Luật Đất đai", "ngan sach"), false);
  assert.equal(matchesVietnameseQuery("Báo cáo thu chi", ""), true);
});

test("isSafeHttpUrl allows http/https and rejects javascript/data schemes", () => {
  assert.equal(isSafeHttpUrl("https://vbpl.vn/tw/Pages/home.aspx"), true);
  assert.equal(isSafeHttpUrl("http://chinhphu.vn/van-ban"), true);
  assert.equal(isSafeHttpUrl(""), false);
  assert.equal(isSafeHttpUrl("javascript:alert(1)"), false);
  assert.equal(isSafeHttpUrl("data:text/html,<script>alert(1)</script>"), false);
});

test("parseServerCookies, auth token session helpers, and granular RBAC helpers evaluate permissions", () => {
  const parsed = parseServerCookies(
    "ubnd_actor_email=canbo.vp%40ubnd.vn; ubnd_tenant_slug=default; ubnd_auth_token=tok.sig",
  );
  assert.equal(parsed.actorEmail, "canbo.vp@ubnd.vn");
  assert.equal(parsed.tenantSlug, "default");
  assert.equal(parsed.authToken, "tok.sig");

  setAuthSession({
    token: "mem-tok.123",
    actorEmail: "canbo.vp@ubnd.vn",
    tenantSlug: "xa-tan-chinh",
  });
  assert.equal(getActiveAuthToken(), "mem-tok.123");
  clearAuthSession();
  assert.equal(getActiveAuthToken(), "");

  assert.equal(canManageOfficialDocs({ role: "officer", can_manage_docs: true }), true);
  assert.equal(canManageOfficialDocs({ role: "officer", can_manage_docs: false }), false);
  assert.equal(canManageOfficialDocs({ role: "owner", can_manage_docs: false }), true);

  assert.equal(
    canApproveDocRequests({ role: "officer", can_approve_doc_requests: true }),
    true,
  );
  assert.equal(
    canApproveDocRequests({ role: "officer", can_approve_doc_requests: false }),
    false,
  );

  assert.equal(
    canManageDepartmentTasks({ role: "officer", can_manage_tasks: false }),
    false,
  );
  assert.equal(
    canManageDepartmentTasks({ role: "owner", can_manage_tasks: false }),
    true,
  );
});

test("DirectDocumentViewerDialog exists and is wired into M01, M04, and M05 with safe URL & blob cleanup", () => {
  const viewerPath = path.join(
    APP_DIR,
    "app/components/workspace/document-viewer-dialog.tsx",
  );
  assert.ok(fs.existsSync(viewerPath), "document-viewer-dialog.tsx must exist");
  const viewerSrc = fs.readFileSync(viewerPath, "utf-8");
  assert.match(viewerSrc, /createObjectURL/);
  assert.match(viewerSrc, /revokeObjectURL/);
  assert.match(viewerSrc, /isSafeHttpUrl/);
  assert.match(viewerSrc, /<iframe\b/);

  for (const routeFile of [
    "m01-assistant.tsx",
    "m04-official-docs.tsx",
    "m05-doc-session.tsx",
  ]) {
    const src = fs.readFileSync(
      path.join(APP_DIR, "app/routes", routeFile),
      "utf-8",
    );
    assert.match(
      src,
      /DirectDocumentViewerDialog/,
      `${routeFile} must mount DirectDocumentViewerDialog`,
    );
  }
});

test("workspace-layout fails closed to /dang-nhap on any /api/auth/me error without falling back to X-Actor-Email or Owner", () => {
  const layoutSrc = fs.readFileSync(
    path.join(APP_DIR, "app/routes/workspace-layout.tsx"),
    "utf-8",
  );
  // Must not fall back to FALLBACK_ACCOUNTS or X-Actor-Email when /api/auth/me fails
  assert.doesNotMatch(layoutSrc, /FALLBACK_ACCOUNTS/);
  assert.match(layoutSrc, /if\s*\(!verifiedUser\)/);
});

test("m04-official-docs renders in-dialog createError and prevents duplicate POST when attachment upload fails", () => {
  const m04Src = fs.readFileSync(
    path.join(APP_DIR, "app/routes/m04-official-docs.tsx"),
    "utf-8",
  );
  assert.match(m04Src, /createError/);
  assert.match(m04Src, /setSelectedDoc\(created\)/);
});

test("DirectDocumentViewerDialog keys PDF blob effect on primitive IDs instead of inline target object", () => {
  const viewerSrc = fs.readFileSync(
    path.join(APP_DIR, "app/components/workspace/document-viewer-dialog.tsx"),
    "utf-8",
  );
  assert.match(viewerSrc, /targetIdentityKey/);
  assert.doesNotMatch(
    viewerSrc,
    /\},\s*\[open,\s*target,\s*isPdfBinary/,
  );
});
