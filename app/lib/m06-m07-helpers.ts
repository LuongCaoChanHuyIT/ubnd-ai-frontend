import type { DepartmentId, TaskItem, TaskStatus } from "./api.ts";

export type AdminTabId =
  | "phan-quyen"
  | "instruction"
  | "api"
  | "nhat-ky"
  | "nhan-ban";

export const ADMIN_TABS: readonly { id: AdminTabId; label: string }[] = [
  { id: "phan-quyen", label: "Phân quyền email" },
  { id: "instruction", label: "Instruction của phòng" },
  { id: "api", label: "Cổng API đấu nối" },
  { id: "nhat-ky", label: "Nhật ký hệ thống" },
  { id: "nhan-ban", label: "Nhân bản AI" },
] as const;

export function normalizeAdminTab(raw: string | null | undefined): AdminTabId {
  if (
    raw === "instruction" ||
    raw === "api" ||
    raw === "nhat-ky" ||
    raw === "nhan-ban"
  ) {
    return raw;
  }
  return "phan-quyen";
}

export function normalizeM04Tab(
  raw: string | null | undefined,
): "danh_muc" | "de_nghi" {
  if (raw === "de_nghi" || raw === "de-nghi") {
    return "de_nghi";
  }
  return "danh_muc";
}

export function isDepartmentLockedForRole(role: "owner" | "officer"): boolean {
  return role === "officer";
}

export function canAccessM07Admin(role: "owner" | "officer"): boolean {
  return role === "owner";
}

export function resolveEffectiveDepartmentForUser(
  requestedDept: DepartmentId,
  user: { role: "owner" | "officer"; department_id: DepartmentId },
): DepartmentId {
  if (user.role === "officer") {
    return user.department_id;
  }
  return requestedDept;
}

export function resolvePostActorSwitchTarget(
  pathname: string,
  currentSearch: string,
  nextUser: { role: "owner" | "officer"; department_id: DepartmentId },
): string {
  const params = new URLSearchParams(currentSearch);
  if (nextUser.role === "officer") {
    if (pathname === "/quan-tri-he-thong") {
      return `/?dept=${nextUser.department_id}`;
    }
    params.set("dept", nextUser.department_id);
    params.delete("filterDept");
    return `${pathname}?${params.toString()}`;
  }
  if (!params.get("dept")) {
    params.set("dept", nextUser.department_id);
  }
  return `${pathname}?${params.toString()}`;
}

export function resolveDefaultM06FilterDept(
  activeUrlDept: DepartmentId,
  rawFilterDept: string | null | undefined,
  role: "owner" | "officer",
): DepartmentId | "ALL" {
  if (role === "officer") {
    return activeUrlDept;
  }
  const upper = (rawFilterDept ?? "").trim().toUpperCase();
  if (upper === "ALL") return "ALL";
  if (upper === "VP" || upper === "KT" || upper === "VHXH" || upper === "NNMT") {
    return upper;
  }
  return activeUrlDept;
}

export function formatTaskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case "cho_xu_ly":
      return "Chờ xử lý";
    case "dang_thuc_hien":
      return "Đang thực hiện";
    case "sap_den_han":
      return "Sắp đến hạn";
    case "hoan_thanh":
      return "Hoàn thành";
  }
}

export function formatPriorityLabel(priority: TaskItem["priority"]): string {
  switch (priority) {
    case "thap":
      return "Thấp";
    case "trung_binh":
      return "Trung bình";
    case "cao":
      return "Cao";
    case "khan":
      return "Khẩn";
  }
}
