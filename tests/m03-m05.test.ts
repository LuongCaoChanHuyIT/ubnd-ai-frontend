import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_DOC_TYPES,
  AUTHORITY_MODES,
  DEPARTMENT_SAMPLE_DOSSIERS,
  SESSION_PROCESS_TABS,
  applyAuthoritySignerOverride,
  buildM06TaskHandoffUrl,
  formatAuditStatusLabel,
  formatTierLabel,
} from "../app/lib/m03-m05-helpers.ts";

test("ADMIN_DOC_TYPES covers all 6 standard commune administrative document types including Tờ trình", () => {
  assert.ok(ADMIN_DOC_TYPES.includes("Tờ trình"));
  assert.deepEqual(ADMIN_DOC_TYPES, [
    "Công văn",
    "Kế hoạch",
    "Báo cáo",
    "Quyết định",
    "Thông báo",
    "Tờ trình",
  ]);
});

test("AUTHORITY_MODES and applyAuthoritySignerOverride handle collective UBND vs Chairman signer", () => {
  assert.deepEqual(
    AUTHORITY_MODES.map((m) => m.id),
    ["auto", "ubnd", "chu_tich"],
  );
  const rawChairmanDraft =
    "Nơi nhận:                              KT. CHỦ TỊCH\n- Lưu: VT, VP.\n                                       PHÓ CHỦ TỊCH";
  const ubndApplied = applyAuthoritySignerOverride(rawChairmanDraft, "ubnd");
  assert.match(ubndApplied, /TM\. ỦY BAN NHÂN DÂN/);

  const rawCollectiveDraft =
    "QUYẾT ĐỊNH\nVề việc khen thưởng\n\nỦY BAN NHÂN DÂN PHƯỜNG TRUNG TÂM\n\nCăn cứ Luật Tổ chức chính quyền địa phương;\n\nNơi nhận:                              TM. ỦY BAN NHÂN DÂN\n- Các Phó Chủ tịch UBND phường;        CHỦ TỊCH\n- Lưu: VT, VP.";
  const chairmanApplied = applyAuthoritySignerOverride(rawCollectiveDraft, "chu_tich");
  assert.doesNotMatch(chairmanApplied, /TM\. ỦY BAN NHÂN DÂN/);
  assert.match(chairmanApplied, /CHỦ TỊCH ỦY BAN NHÂN DÂN PHƯỜNG TRUNG TÂM/);
  assert.match(chairmanApplied, /- Các Phó Chủ tịch UBND phường;/);
  assert.match(chairmanApplied, /CHỦ TỊCH/);
});

test("DEPARTMENT_SAMPLE_DOSSIERS provides 2 realistic conflicting files per department across VP, KT, VHXH, NNMT", () => {
  for (const deptId of ["VP", "KT", "VHXH", "NNMT"] as const) {
    const dossier = DEPARTMENT_SAMPLE_DOSSIERS[deptId];
    assert.equal(dossier.files.length, 2, `Expected 2 files for ${deptId}`);
    assert.ok(dossier.files[0].filename.endsWith(".txt"));
    assert.ok(dossier.files[1].filename.endsWith(".txt"));
    assert.notEqual(dossier.files[0].content, dossier.files[1].content);
  }
  // Domain-specific discrepancy checks
  assert.match(DEPARTMENT_SAMPLE_DOSSIERS.KT.files[0].content, /85\.000\.000/);
  assert.match(DEPARTMENT_SAMPLE_DOSSIERS.KT.files[1].content, /92\.500\.000/);
  assert.match(DEPARTMENT_SAMPLE_DOSSIERS.NNMT.files[0].content, /120 m2/);
  assert.match(DEPARTMENT_SAMPLE_DOSSIERS.NNMT.files[1].content, /145 m2/);
});

test("buildM06TaskHandoffUrl encodes prefilled task dialog query params for Module 06", () => {
  const url = buildM06TaskHandoffUrl({
    deptId: "KT",
    title: "Rà soát hồ sơ quyết toán nhà văn hóa",
    desc: "Đối chiếu chênh lệch 85.000.000 đồng và 92.500.000 đồng",
    ref: "Hồ sơ phiên M05 (KT)",
  });
  assert.match(url, /^\/dieu-hanh-cong-viec\?/);
  const qs = new URLSearchParams(url.split("?")[1]);
  assert.equal(qs.get("dept"), "KT");
  assert.equal(qs.get("newTask"), "1");
  assert.match(qs.get("title") ?? "", /Rà soát hồ sơ quyết toán/);
  assert.match(qs.get("desc") ?? "", /92\.500\.000/);
  assert.equal(qs.get("ref"), "Hồ sơ phiên M05 (KT)");
});

test("formatTierLabel and formatAuditStatusLabel map backend codes to Vietnamese labels", () => {
  assert.equal(formatTierLabel("trung_uong"), "Văn bản Trung ương");
  assert.equal(formatTierLabel("dia_phuong"), "Văn bản Địa phương");
  assert.equal(formatTierLabel("kho_rieng"), "Kho dữ liệu riêng");
  assert.equal(formatAuditStatusLabel("dat"), "Đạt chuẩn");
  assert.equal(formatAuditStatusLabel("can_ra_soat"), "Cần rà soát");
  assert.equal(formatAuditStatusLabel("khong_dat"), "Không đạt");
  assert.equal(SESSION_PROCESS_TABS.length, 4);
});
