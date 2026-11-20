import { redirect, type ShouldRevalidateFunctionArgs } from "react-router";
import type { Route } from "./+types/workspace-layout";
import {
  ApiError,
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
import {
  AUTH_TOKEN_COOKIE_NAME,
  TENANT_COOKIE_NAME,
  parseServerCookies,
} from "~/lib/session";
import { WorkspaceShell } from "~/components/layout/workspace-shell";

const FALLBACK_DEPARTMENTS: Department[] = [
  {
    id: "VP",
    code: "VP",
    name: "Văn phòng HĐND & UBND",
    scope_summary:
      "Tổng hợp, văn thư, tư pháp - hộ tịch, tiếp công dân và kiểm soát TTHC",
    instruction: "",
    updated_at: "",
  },
  {
    id: "KT",
    code: "KT",
    name: "Kinh tế",
    scope_summary:
      "Tài chính - ngân sách xã, kế hoạch đầu tư công, thương mại - dịch vụ",
    instruction: "",
    updated_at: "",
  },
  {
    id: "VHXH",
    code: "VHXH",
    name: "Văn hóa - Xã hội",
    scope_summary:
      "Chính sách người có công, bảo trợ xã hội, giáo dục, y tế cơ sở",
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

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  if (formMethod) return defaultShouldRevalidate;
  // Explicit revalidator.revalidate() has identical href -> must revalidate (e.g., switchTenant)
  if (currentUrl.href === nextUrl.href) return true;
  // Same pathname + same ?dept= means pure in-page tab/search/filter param update -> skip layout roundtrip
  if (
    currentUrl.pathname === nextUrl.pathname &&
    (currentUrl.searchParams.get("dept") ?? "VP") ===
      (nextUrl.searchParams.get("dept") ?? "VP")
  ) {
    return false;
  }
  return defaultShouldRevalidate;
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const nextTarget = `${url.pathname}${url.search}`;
  const loginRedirectUrl =
    nextTarget && nextTarget !== "/"
      ? `/dang-nhap?next=${encodeURIComponent(nextTarget)}`
      : "/dang-nhap";

  const { authToken } = parseServerCookies(request.headers.get("cookie"));
  if (!authToken) {
    return redirect(loginRedirectUrl);
  }

  const rawDeptParam = url.searchParams.get("dept");
  const requestedDeptId = normalizeDepartmentId(rawDeptParam);
  const baseUrl = resolveServerApiBase();
  const authHeaders = extractServerAuthHeaders(request);

  // Parallelize /api/auth/me and /api/bootstrap to eliminate sequential SSR waterfall
  const [meSettled, bootSettled] = await Promise.allSettled([
    apiRequest<{
      user: RbacUser;
      tenant_slug: string;
      commune_name: string;
    }>("/api/auth/me", {
      baseUrl,
      headers: authHeaders,
    }),
    apiRequest<BootstrapPayload>("/api/bootstrap", {
      baseUrl,
      headers: authHeaders,
    }),
  ]);

  let verifiedUser: RbacUser | null = null;
  let meStatus = 0;
  if (meSettled.status === "fulfilled") {
    verifiedUser = meSettled.value.user;
  } else {
    const err = meSettled.reason;
    meStatus = err instanceof ApiError ? err.status : 502;
  }

  // Fail closed on ANY /api/auth/me failure — never fall back to unsigned X-Actor-Email or Owner
  if (!verifiedUser) {
    const clearHeaders = new Headers();
    clearHeaders.append(
      "Set-Cookie",
      `${AUTH_TOKEN_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`,
    );
    if (meStatus === 400 || meStatus === 404) {
      clearHeaders.append(
        "Set-Cookie",
        `${TENANT_COOKIE_NAME}=default; Path=/; Max-Age=604800; SameSite=Lax`,
      );
    }
    return redirect(loginRedirectUrl, { headers: clearHeaders });
  }

  const bootstrap: BootstrapPayload | null =
    bootSettled.status === "fulfilled" ? bootSettled.value : null;

  const bootstrapUsers: RbacUser[] = bootstrap?.demo_accounts?.length
    ? bootstrap.demo_accounts.map((acc, idx) => ({
        id: acc.id ?? idx + 1,
        email: acc.email,
        full_name: acc.full_name,
        position: acc.position,
        role: acc.role,
        department_id: acc.department_id,
        private_repo_access: acc.private_repo_access,
        can_manage_docs: acc.can_manage_docs ?? acc.role === "owner",
        can_approve_doc_requests:
          acc.can_approve_doc_requests ?? acc.role === "owner",
        can_manage_tasks: acc.can_manage_tasks ?? true,
        active: true,
        created_at: "",
      }))
    : [verifiedUser];

  const effectiveDeptId = resolveEffectiveDepartmentForUser(
    requestedDeptId,
    verifiedUser,
  );

  // Lock officer URL ?dept= parameter to their assigned department
  if (
    verifiedUser.role === "officer" &&
    (rawDeptParam ?? "").toUpperCase() !== verifiedUser.department_id
  ) {
    const redirectUrl = new URL(request.url);
    redirectUrl.searchParams.set("dept", verifiedUser.department_id);
    redirectUrl.searchParams.delete("filterDept");
    return redirect(
      `${redirectUrl.pathname}?${redirectUrl.searchParams.toString()}`,
    );
  }

  const mergedUsers = bootstrapUsers.some(
    (u) => u.email.toLowerCase() === verifiedUser.email.toLowerCase(),
  )
    ? bootstrapUsers.map((u) =>
        u.email.toLowerCase() === verifiedUser.email.toLowerCase()
          ? verifiedUser
          : u,
      )
    : [verifiedUser, ...bootstrapUsers];

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
    users: mergedUsers,
    currentDeptId: effectiveDeptId,
    resolvedActorEmail: verifiedUser.email,
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
