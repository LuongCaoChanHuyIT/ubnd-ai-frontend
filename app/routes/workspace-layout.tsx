import { redirect } from "react-router";
import type { Route } from "./+types/workspace-layout";
import {
  apiRequest,
  extractServerAuthHeaders,
  normalizeDepartmentId,
  resolveServerApiBase,
  type BootstrapPayload,
  type Department,
  type RbacUser,
  type TenantSummary,
} from "~/lib/api";
import { resolveEffectiveDepartmentForUser } from "~/lib/m06-m07-helpers";
import { WorkspaceShell } from "~/components/layout/workspace-shell";

const FALLBACK_DEPARTMENTS: Department[] = [
  {
    id: "VP",
    code: "VP",
    name: "Văn phòng HĐND & UBND",
    scope_summary: "Tổng hợp, văn thư, tư pháp - hộ tịch, tiếp công dân và kiểm soát TTHC",
    instruction: "",
    updated_at: "",
  },
  {
    id: "KT",
    code: "KT",
    name: "Kinh tế",
    scope_summary: "Tài chính - ngân sách xã, kế hoạch đầu tư công, thương mại - dịch vụ",
    instruction: "",
    updated_at: "",
  },
  {
    id: "VHXH",
    code: "VHXH",
    name: "Văn hóa - Xã hội",
    scope_summary: "Chính sách người có công, bảo trợ xã hội, giáo dục, y tế cơ sở",
    instruction: "",
    updated_at: "",
  },
  {
    id: "NNMT",
    code: "NNMT",
    name: "Nông nghiệp và Môi trường",
    scope_summary: "Địa chính - đất đai, trật tự xây dựng, tài nguyên môi trường",
    instruction: "",
    updated_at: "",
  },
];

const FALLBACK_ACCOUNTS: RbacUser[] = [
  {
    id: 1,
    email: "tsh.co@tshorg.vn",
    full_name: "Chủ sở hữu hệ thống",
    position: "Quản trị viên",
    role: "owner",
    department_id: "VP",
    private_repo_access: true,
    active: true,
    created_at: "",
  },
  {
    id: 2,
    email: "canbo.vp@ubnd.vn",
    full_name: "Nguyễn Minh Tuấn",
    position: "Công chức Văn phòng - Thống kê",
    role: "officer",
    department_id: "VP",
    private_repo_access: true,
    active: true,
    created_at: "",
  },
  {
    id: 3,
    email: "canbo.kt@ubnd.vn",
    full_name: "Trần Thị Mai",
    position: "Công chức Tài chính - Kế toán",
    role: "officer",
    department_id: "KT",
    private_repo_access: true,
    active: true,
    created_at: "",
  },
  {
    id: 4,
    email: "canbo.vhxh@ubnd.vn",
    full_name: "Lê Hoàng Nam",
    position: "Công chức Văn hóa - Xã hội",
    role: "officer",
    department_id: "VHXH",
    private_repo_access: true,
    active: true,
    created_at: "",
  },
  {
    id: 5,
    email: "canbo.nnmt@ubnd.vn",
    full_name: "Phạm Quốc Bảo",
    position: "Công chức Địa chính - Môi trường",
    role: "officer",
    department_id: "NNMT",
    private_repo_access: true,
    active: true,
    created_at: "",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const rawDeptParam = url.searchParams.get("dept");
  const requestedDeptId = normalizeDepartmentId(rawDeptParam);
  const baseUrl = resolveServerApiBase();
  const authHeaders = extractServerAuthHeaders(request);

  let bootstrap: BootstrapPayload | null = null;
  try {
    bootstrap = await apiRequest<BootstrapPayload>("/api/bootstrap", {
      baseUrl,
      headers: authHeaders,
    });
  } catch {
    if (authHeaders["X-Tenant-Slug"] !== "default") {
      try {
        bootstrap = await apiRequest<BootstrapPayload>("/api/bootstrap", {
          baseUrl,
          headers: {
            ...authHeaders,
            "X-Tenant-Slug": "default",
          },
        });
      } catch {
        bootstrap = null;
      }
    }
  }

  const users: RbacUser[] = bootstrap?.demo_accounts?.length
    ? bootstrap.demo_accounts.map((acc, idx) => ({
        id: idx + 1,
        email: acc.email,
        full_name: acc.full_name,
        position: acc.position,
        role: acc.role,
        department_id: acc.department_id,
        private_repo_access: acc.private_repo_access,
        active: true,
        created_at: "",
      }))
    : FALLBACK_ACCOUNTS;

  const requestedEmail = (authHeaders["X-Actor-Email"] ?? "").toLowerCase();
  const matchedUser =
    users.find((u) => u.email.toLowerCase() === requestedEmail) ?? users[0];

  const effectiveDeptId = resolveEffectiveDepartmentForUser(
    requestedDeptId,
    matchedUser,
  );

  // Lock officer URL ?dept= parameter to their assigned department
  if (
    matchedUser.role === "officer" &&
    (rawDeptParam ?? "").toUpperCase() !== matchedUser.department_id
  ) {
    const redirectUrl = new URL(request.url);
    redirectUrl.searchParams.set("dept", matchedUser.department_id);
    redirectUrl.searchParams.delete("filterDept");
    return redirect(`${redirectUrl.pathname}?${redirectUrl.searchParams.toString()}`);
  }

  return {
    communeName: bootstrap?.commune_name ?? "UBND xã, phường trung tâm",
    activeTenantSlug: bootstrap?.active_tenant_slug ?? "default",
    availableTenants:
      bootstrap?.available_tenants ??
      ([
        { slug: "default", commune_name: "UBND xã, phường trung tâm" },
      ] satisfies TenantSummary[]),
    departments: bootstrap?.departments?.length
      ? bootstrap.departments
      : FALLBACK_DEPARTMENTS,
    users,
    currentDeptId: effectiveDeptId,
    resolvedActorEmail: matchedUser.email,
  };
}

export default function WorkspaceLayoutRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <WorkspaceShell
      communeName={loaderData.communeName}
      activeTenantSlug={loaderData.activeTenantSlug}
      availableTenants={loaderData.availableTenants}
      departments={loaderData.departments}
      users={loaderData.users}
      currentDeptId={loaderData.currentDeptId}
      resolvedActorEmail={loaderData.resolvedActorEmail}
    />
  );
}
