import test from "node:test";
import assert from "node:assert/strict";
import { ASSISTANT_MODES, buildM03HandoffUrl } from "../app/lib/m01-m02-helpers.ts";

test("ASSISTANT_MODES defines all 3 TSH modes with Vietnamese badges", () => {
  assert.deepEqual(
    ASSISTANT_MODES.map((m) => m.id),
    ["soan_thao", "nghiep_vu", "tham_dinh"],
  );
  assert.deepEqual(
    ASSISTANT_MODES.map((m) => m.badge),
    ["SOẠN THẢO", "NGHIỆP VỤ", "THẨM ĐỊNH"],
  );
});

test("buildM03HandoffUrl encodes department, title, and option pros into M03 query string", () => {
  const href = buildM03HandoffUrl("NNMT", "Quản lý trật tự xây dựng", {
    code: "Phương án C",
    title: "Thí điểm theo cụm dân cư",
    summary: "Kiểm tra thực địa định kỳ",
    pros: ["Giảm vi phạm mới", "Rõ trách nhiệm"],
    cons: ["Cần nhân lực"],
    feasibility: "Khuyến nghị áp dụng",
  });
  assert.match(href, /^\/soan-thao-kiem-tra\?/);
  const params = new URLSearchParams(href.split("?")[1]);
  assert.equal(params.get("dept"), "NNMT");
  assert.equal(params.get("docType"), "Kế hoạch");
  assert.ok((params.get("title") ?? "").includes("Quản lý trật tự xây dựng"));
  assert.ok((params.get("points") ?? "").includes("Giảm vi phạm mới"));
});

