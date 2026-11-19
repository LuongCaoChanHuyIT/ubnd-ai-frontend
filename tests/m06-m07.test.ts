import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_TABS,
  canAccessM07Admin,
  formatPriorityLabel,
  formatTaskStatusLabel,
  isDepartmentLockedForRole,
  normalizeAdminTab,
  normalizeM04Tab,
  resolveDefaultM06FilterDept,
  resolveEffectiveDepartmentForUser,
  resolvePostActorSwitchTarget,
} from "../app/lib/m06-m07-helpers.ts";

test("normalizeAdminTab maps sidebar query params to the 5 Module 07 tabs", () => {
  assert.equal(ADMIN_TABS.length, 5);
  assert.equal(normalizeAdminTab(null), "phan-quyen");
  assert.equal(normalizeAdminTab("instruction"), "instruction");
  assert.equal(normalizeAdminTab("api"), "api");
  assert.equal(normalizeAdminTab("nhat-ky"), "nhat-ky");
  assert.equal(normalizeAdminTab("nhan-ban"), "nhan-ban");
  assert.equal(normalizeAdminTab("unknown"), "phan-quyen");
});

test("normalizeM04Tab accepts both de_nghi and legacy de-nghi query values", () => {
  assert.equal(normalizeM04Tab("de_nghi"), "de_nghi");
  assert.equal(normalizeM04Tab("de-nghi"), "de_nghi");
  assert.equal(normalizeM04Tab(null), "danh_muc");
  assert.equal(normalizeM04Tab("other"), "danh_muc");
});

test("RBAC helpers lock department selector and hide Module 07 admin menu for officers", () => {
  assert.equal(isDepartmentLockedForRole("officer"), true);
  assert.equal(isDepartmentLockedForRole("owner"), false);
  assert.equal(canAccessM07Admin("officer"), false);
  assert.equal(canAccessM07Admin("owner"), true);

  assert.equal(
    resolveEffectiveDepartmentForUser("VP", {
      role: "officer",
      department_id: "NNMT",
    }),
    "NNMT",
  );
  assert.equal(
    resolveEffectiveDepartmentForUser("KT", {
      role: "owner",
      department_id: "VP",
    }),
    "KT",
  );
});

test("resolvePostActorSwitchTarget redirects officer away from /quan-tri-he-thong to their department", () => {
  const fromM07 = resolvePostActorSwitchTarget(
    "/quan-tri-he-thong",
    "dept=VP&tab=nhan-ban",
    { role: "officer", department_id: "NNMT" },
  );
  assert.equal(fromM07, "/?dept=NNMT");

  const fromM04 = resolvePostActorSwitchTarget(
    "/nguon-van-ban",
    "dept=VP&tab=de_nghi",
    { role: "officer", department_id: "VHXH" },
  );
  assert.equal(fromM04, "/nguon-van-ban?dept=VHXH&tab=de_nghi");
});

test("resolveDefaultM06FilterDept defaults to active URL department and locks officers", () => {
  assert.equal(resolveDefaultM06FilterDept("KT", null, "owner"), "KT");
  assert.equal(resolveDefaultM06FilterDept("KT", "ALL", "owner"), "ALL");
  assert.equal(resolveDefaultM06FilterDept("NNMT", "ALL", "officer"), "NNMT");
  assert.equal(resolveDefaultM06FilterDept("NNMT", "VP", "officer"), "NNMT");
});

test("formatTaskStatusLabel and formatPriorityLabel render Vietnamese administrative labels", () => {
  assert.equal(formatTaskStatusLabel("dang_thuc_hien"), "Đang thực hiện");
  assert.equal(formatTaskStatusLabel("sap_den_han"), "Sắp đến hạn");
  assert.equal(formatTaskStatusLabel("hoan_thanh"), "Hoàn thành");
  assert.equal(formatPriorityLabel("khan"), "Khẩn");
});
