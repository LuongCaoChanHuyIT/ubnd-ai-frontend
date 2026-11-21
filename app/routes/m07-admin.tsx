import { useDeferredValue, useEffect, useState } from "react";
import {
  Link,
  useOutletContext,
  useRevalidator,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  History,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { Route } from "./+types/m07-admin";
import {
  ApiError,
  apiRequest,
  extractServerAuthHeaders,
  GEMINI_MODEL_PRESETS,
  normalizeDepartmentId,
  probeApiConnector,
  resolveServerApiBase,
  type ApiConnector,
  type AuditLogEntry,
  type ClonedTenant,
  type ConnectorProbeResponse,
  type Department,
  type DepartmentId,
  type RbacUser,
  type WorkspaceOutletContext,
} from "~/lib/api";
import {
  ADMIN_TABS,
  normalizeAdminTab,
  type AdminTabId,
} from "~/lib/m06-m07-helpers";
import { matchesVietnameseQuery } from "~/lib/vietnamese-search";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ModuleHeader } from "~/components/workspace/module-surface";
import { cn } from "~/lib/utils";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";

export function meta({ }: Route.MetaArgs) {
  return [{ title: "Mô-đun 07 · Phân quyền & Quản trị hệ thống — UBND Xã, Phường" }];
}

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  if (formMethod) return defaultShouldRevalidate;
  if (currentUrl.href === nextUrl.href) return true;
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
  const deptId = normalizeDepartmentId(url.searchParams.get("dept"));
  const baseUrl = resolveServerApiBase();
  const headers = extractServerAuthHeaders(request);

  try {
    const [deptRes, userRes, connRes, logRes, tenantRes] = await Promise.all([
      apiRequest<{ departments: Department[] }>("/api/departments", {
        baseUrl,
        headers,
      }),
      apiRequest<{ users: RbacUser[] }>("/api/m07/users", {
        baseUrl,
        headers,
      }),
      apiRequest<{ connectors: ApiConnector[] }>("/api/m07/api-connectors", {
        baseUrl,
        headers,
      }),
      apiRequest<{ logs: AuditLogEntry[] }>("/api/m07/audit-logs?limit=40", {
        baseUrl,
        headers,
      }),
      apiRequest<{ tenants: ClonedTenant[] }>("/api/m07/tenants", {
        baseUrl,
        headers,
      }),
    ]);
    return {
      deptId,
      forbidden: false,
      departments: deptRes.departments,
      users: userRes.users,
      connectors: connRes.connectors,
      logs: logRes.logs,
      tenants: tenantRes.tenants,
    };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
      return {
        deptId,
        forbidden: true,
        departments: [] as Department[],
        users: [] as RbacUser[],
        connectors: [] as ApiConnector[],
        logs: [] as AuditLogEntry[],
        tenants: [] as ClonedTenant[],
      };
    }
    return {
      deptId,
      forbidden: false,
      departments: [] as Department[],
      users: [] as RbacUser[],
      connectors: [] as ApiConnector[],
      logs: [] as AuditLogEntry[],
      tenants: [] as ClonedTenant[],
    };
  }
}

export default function Module07AdminRoute({ loaderData }: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const outlet = useOutletContext<WorkspaceOutletContext | undefined>();

  const rawDept = normalizeDepartmentId(
    searchParams.get("dept") ?? loaderData.deptId,
  );
  const isOfficer = outlet?.currentUser?.role === "officer";
  const deptId = isOfficer
    ? outlet.currentUser.department_id
    : rawDept;

  const activeTenantSlug = outlet?.activeTenantSlug ?? "default";
  const communeNameDisplay = outlet?.communeName ?? "UBND xã, phường trung tâm";

  const activeTab = normalizeAdminTab(searchParams.get("tab"));

  const [banner, setBanner] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  // RBAC form state
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPosition, setNewPosition] = useState("Công chức chuyên môn");
  const [newUserDept, setNewUserDept] = useState<DepartmentId>(deptId);
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newPrivateAccess, setNewPrivateAccess] = useState(true);
  const [newManageDocs, setNewManageDocs] = useState(false);
  const [newApproveDocs, setNewApproveDocs] = useState(false);
  const [newManageTasks, setNewManageTasks] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const deferredUserSearch = useDeferredValue(userSearch);
  const deferredLogSearch = useDeferredValue(logSearch);
  const [pwdDialogUser, setPwdDialogUser] = useState<RbacUser | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState("");

  // Instruction editor state
  const [instDeptId, setInstDeptId] = useState<DepartmentId>(deptId);
  const matchedDept = loaderData.departments.find((d) => d.id === instDeptId);
  const [instText, setInstText] = useState(matchedDept?.instruction ?? "");

  useEffect(() => {
    setInstDeptId(deptId);
  }, [deptId]);

  useEffect(() => {
    const d = loaderData.departments.find((item) => item.id === instDeptId);
    if (d) setInstText(d.instruction ?? "");
  }, [instDeptId, loaderData.departments]);

  function normalizeConnectorProvider(raw: string | undefined): string {
    const p = (raw ?? "").trim().toLowerCase();
    if (p === "openai" || p === "openai-compatible") return "openai-compatible";
    return "google-gemini";
  }

  // API Connector state
  const firstConnector = loaderData.connectors[0];
  const [connProvider, setConnProvider] = useState(
    normalizeConnectorProvider(firstConnector?.provider),
  );
  const [connName, setConnName] = useState(
    firstConnector?.name ?? "Google Gemini 4 (Interactions API v1)",
  );
  const [connUrl, setConnUrl] = useState(
    firstConnector?.base_url ?? "https://generativelanguage.googleapis.com",
  );
  const [connModel, setConnModel] = useState(
    firstConnector?.model_name ?? "gemini-4-hydrogen",
  );
  const [connKey, setConnKey] = useState("");
  const [connActive, setConnActive] = useState(firstConnector?.active ?? false);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ConnectorProbeResponse | null>(
    null,
  );

  useEffect(() => {
    setConnKey("");
    setProbeResult(null);
    if (firstConnector) {
      setConnProvider(normalizeConnectorProvider(firstConnector.provider));
      setConnName(firstConnector.name);
      setConnUrl(firstConnector.base_url);
      setConnModel(firstConnector.model_name);
      setConnActive(firstConnector.active);
    }
  }, [firstConnector, activeTenantSlug]);

  // Clone Tenant state
  const [communeName, setCommuneName] = useState("UBND Phường Hòa Xuân");
  const [communeAdmin, setCommuneAdmin] = useState("admin.hoaxuan@ubnd.gov.vn");

  // Graceful 403 / Officer guard card
  if (loaderData.forbidden || isOfficer) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <Card className="border-amber-200 bg-white shadow-2xs">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Lock aria-hidden="true" className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg text-slate-900">
              Giới hạn quyền truy cập Quản trị hệ thống
            </CardTitle>
            <CardDescription className="text-sm text-slate-600 leading-relaxed">
              Khu vực Quản trị hệ thống (Mô-đun 07) chỉ dành cho tài khoản Quản trị
              viên cấp cao (Owner). Vui lòng quay về không gian chuyên môn của phòng.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <Button asChild className="bg-[#1B4D89] hover:bg-[#163E70] text-white gap-2">
              <Link to={`/?dept=${deptId}`}>
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Quay về Trợ lý nghiệp vụ (Mô-đun 01 · Phòng {deptId})
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  function handleTabChange(next: string) {
    const tab = normalizeAdminTab(next);
    const params = new URLSearchParams(searchParams);
    params.set("dept", deptId);
    params.set("tab", tab);
    setSearchParams(params, { preventScrollReset: true });
    setBanner(null);
  }

  async function handleAddUser(ev: React.FormEvent) {
    ev.preventDefault();
    if (!newEmail.trim() || !newName.trim()) return;
    setBusy(true);
    setBanner(null);
    try {
      await apiRequest("/api/m07/users", {
        method: "POST",
        body: {
          email: newEmail.trim(),
          full_name: newName.trim(),
          position: newPosition.trim(),
          role: "officer",
          department_id: newUserDept,
          private_repo_access: newPrivateAccess,
          can_manage_docs: newManageDocs,
          can_approve_doc_requests: newApproveDocs,
          can_manage_tasks: newManageTasks,
          password: newUserPassword.trim(),
        },
      });
      setNewEmail("");
      setNewName("");
      setNewUserPassword("");
      setBanner({
        tone: "ok",
        text: "Đã phân quyền tài khoản cán bộ mới thành công.",
      });
      revalidator.revalidate();
    } catch (err) {
      setBanner({
        tone: "err",
        text: err instanceof Error ? err.message : "Lỗi phân quyền tài khoản",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handlePatchUserPermission(
    userId: number,
    patchBody: Record<string, unknown>,
    successMsg: string,
  ) {
    setBusy(true);
    setBanner(null);
    try {
      await apiRequest(`/api/m07/users/${userId}`, {
        method: "PATCH",
        body: patchBody,
      });
      setBanner({
        tone: "ok",
        text: successMsg,
      });
      revalidator.revalidate();
    } catch (err) {
      setBanner({
        tone: "err",
        text: err instanceof Error ? err.message : "Không thể cập nhật phân quyền",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleResetUserPassword(ev: React.FormEvent) {
    ev.preventDefault();
    if (!pwdDialogUser || resetPasswordVal.trim().length < 6) return;
    await handlePatchUserPermission(
      pwdDialogUser.id,
      { new_password: resetPasswordVal.trim() },
      `Đã đặt lại mật khẩu cho tài khoản ${pwdDialogUser.email}.`,
    );
    setPwdDialogUser(null);
    setResetPasswordVal("");
  }

  async function handleDeleteUser(userId: number) {
    setBusy(true);
    setBanner(null);
    try {
      await apiRequest(`/api/m07/users/${userId}`, {
        method: "DELETE",
      });
      setBanner({ tone: "ok", text: "Đã thu hồi quyền truy cập tài khoản." });
      revalidator.revalidate();
    } catch (err) {
      setBanner({
        tone: "err",
        text: err instanceof Error ? err.message : "Không thể thu hồi quyền",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveInstruction(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setBanner(null);
    try {
      await apiRequest(`/api/m07/departments/${instDeptId}/instruction`, {
        method: "PUT",
        body: { instruction: instText },
      });
      setBanner({
        tone: "ok",
        text: `Đã lưu Instruction nghiệp vụ cho phòng ${instDeptId} (${communeNameDisplay}).`,
      });
      revalidator.revalidate();
    } catch (err) {
      setBanner({
        tone: "err",
        text: err instanceof Error ? err.message : "Không thể cập nhật Instruction",
      });
    } finally {
      setBusy(false);
    }
  }

  function handleProviderChange(nextProvider: string) {
    setConnProvider(nextProvider);
    setProbeResult(null);
    if (nextProvider === "google-gemini") {
      setConnName("Google Gemini 4 (Interactions API v1)");
      setConnUrl("https://generativelanguage.googleapis.com");
      if (!GEMINI_MODEL_PRESETS.some((p) => p.id === connModel)) {
        setConnModel("gemini-4-hydrogen");
      }
    } else if (connUrl.includes("generativelanguage.googleapis.com")) {
      setConnName("Cổng LLM Nội bộ / OpenAI-Compatible");
      setConnUrl("https://api.openai.com/v1");
      setConnModel("gpt-4o-mini");
    }
  }

  async function handleSaveConnector(ev: React.FormEvent) {
    ev.preventDefault();
    if (!firstConnector) return;
    setBusy(true);
    setBanner(null);
    try {
      await apiRequest(`/api/m07/api-connectors/${firstConnector.id}`, {
        method: "PUT",
        body: {
          name: connName,
          provider: connProvider,
          base_url: connUrl,
          model_name: connModel,
          api_key: connKey.trim() || null,
          active: connActive,
        },
      });
      setConnKey("");
      setBanner({
        tone: "ok",
        text: "Đã cập nhật cấu hình Cổng API đấu nối (khóa bí mật được che an toàn).",
      });
      revalidator.revalidate();
    } catch (err) {
      setBanner({
        tone: "err",
        text: err instanceof Error ? err.message : "Không thể lưu Cổng API",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleProbeConnector() {
    if (!firstConnector) return;
    setProbing(true);
    setProbeResult(null);
    setBanner(null);
    try {
      const res = await probeApiConnector(firstConnector.id, {
        provider: connProvider,
        base_url: connUrl,
        model_name: connModel,
        api_key: connKey.trim() || null,
      });
      setProbeResult(res);
    } catch (err) {
      setBanner({
        tone: "err",
        text:
          err instanceof Error ? err.message : "Không thể kiểm tra kết nối AI",
      });
    } finally {
      setProbing(false);
    }
  }

  async function handleCloneTenant(ev: React.FormEvent) {
    ev.preventDefault();
    if (!communeName.trim() || !communeAdmin.trim()) return;
    setBusy(true);
    setBanner(null);
    try {
      const created = await apiRequest<ClonedTenant>("/api/m07/clone-tenant", {
        method: "POST",
        body: {
          commune_name: communeName.trim(),
          admin_email: communeAdmin.trim(),
        },
      });
      setBanner({
        tone: "ok",
        text: `Đã nhân bản thành công hệ thống AI độc lập '${created.commune_name}' (mã định danh: ${created.slug}). Bấm 'Chuyển sang vận hành đơn vị này' để làm việc trực tiếp trên CSDL mới.`,
      });
      revalidator.revalidate();
    } catch (err) {
      setBanner({
        tone: "err",
        text: err instanceof Error ? err.message : "Không thể nhân bản hệ thống",
      });
    } finally {
      setBusy(false);
    }
  }

  function handleActivateTenant(tenant: ClonedTenant) {
    outlet?.switchTenant(tenant.slug, tenant.admin_email);
    setBanner({
      tone: "ok",
      text: `Đã chuyển sang vận hành trực tiếp hệ thống độc lập của '${tenant.commune_name}' (${tenant.slug}).`,
    });
  }

  function handleReturnRootTenant() {
    outlet?.switchTenant("default");
    setBanner({
      tone: "ok",
      text: "Đã quay về vận hành đơn vị gốc (default).",
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <ModuleHeader.Root>
        <ModuleHeader.Content>
          <ModuleHeader.Eyebrow>
            Mô-đun 07 · Quản trị, Phân quyền & Nhân bản hệ thống · {communeNameDisplay}
          </ModuleHeader.Eyebrow>
          <ModuleHeader.Title>
            Tổ chức tài khoản theo 4 nhóm nghiệp vụ & Triển khai độc lập cho từng xã, phường
          </ModuleHeader.Title>
          <ModuleHeader.Description>
            Phân quyền email công vụ, cấu hình Instruction chuyên môn cho từng phòng,
            đấu nối LLM Gateway và nhân bản cơ sở dữ liệu độc lập.
          </ModuleHeader.Description>
        </ModuleHeader.Content>

        {activeTenantSlug !== "default" && (
          <ModuleHeader.Actions>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReturnRootTenant}
              className="gap-1.5 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs whitespace-nowrap"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              Quay về đơn vị gốc
            </Button>
          </ModuleHeader.Actions>
        )}
      </ModuleHeader.Root>

      {/* 4 Specialized Department Group Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {loaderData.departments.map((d) => {
          const count = loaderData.users.filter(
            (u) => u.department_id === d.id,
          ).length;
          return (
            <Card key={d.id} className="border-slate-200 shadow-2xs border-t-2 border-t-[#1B4D89]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="font-bold">
                    {d.code}
                  </Badge>
                  <span className="text-xs font-semibold text-[#1B4D89] tabular-nums">
                    {count} tài khoản
                  </span>
                </div>
                <CardTitle className="text-sm pt-1">{d.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[11px] text-slate-600 line-clamp-2">
                  {d.scope_summary}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {banner && (
        <div
          role={banner.tone === "err" ? "alert" : "status"}
          aria-live="polite"
        >
          <Alert
            variant={banner.tone === "err" ? "destructive" : "default"}
            className={
              banner.tone === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 py-2.5"
                : "py-2.5"
            }
          >
            <AlertDescription className="text-xs flex items-center gap-1.5">
              {banner.tone === "ok" ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="h-4 w-4 text-emerald-600 shrink-0"
                />
              ) : (
                <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
              )}
              {banner.text}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => handleTabChange(v as AdminTabId)}
      >
        <TabsList className="flex flex-wrap h-auto">
          {ADMIN_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab 1: Phân quyền email */}
        <TabsContent
          value="phan-quyen"
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-3"
        >
          <Card className="lg:col-span-4 border-slate-200 shadow-2xs h-fit">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-1.5">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 text-[#1B4D89]" />
                Cấp quyền email cán bộ
              </CardTitle>
              <CardDescription className="text-xs">
                Chỉ Chủ sở hữu hệ thống mới có quyền thêm hoặc thu hồi tài khoản tại{" "}
                <strong>{communeNameDisplay}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddUser} className="space-y-3">
                <div className="space-y-1">
                  <label
                    htmlFor="m07-user-email"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Email công vụ
                  </label>
                  <Input
                    id="m07-user-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="VD: canbo.tp@ubnd.vn"
                    spellCheck={false}
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="m07-user-name"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Họ và tên cán bộ
                  </label>
                  <Input
                    id="m07-user-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Họ và tên cán bộ…"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="m07-user-position"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Chức danh / Vị trí
                  </label>
                  <Input
                    id="m07-user-position"
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    placeholder="Chức danh / Vị trí…"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Phòng chuyên môn
                  </label>
                  <Select
                    value={newUserDept}
                    onValueChange={(v) => setNewUserDept(v as DepartmentId)}
                  >
                    <SelectTrigger
                      aria-label="Phòng chuyên môn"
                      className="w-full min-w-0"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VP">Văn phòng HĐND & UBND</SelectItem>
                      <SelectItem value="KT">Kinh tế</SelectItem>
                      <SelectItem value="VHXH">Văn hóa - Xã hội</SelectItem>
                      <SelectItem value="NNMT">Nông nghiệp & Môi trường</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="m07-user-password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Mật khẩu khởi tạo (để trống dùng mật khẩu mẫu)
                  </label>
                  <Input
                    id="m07-user-password"
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự…"
                    spellCheck={false}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2 rounded-lg border border-slate-200 p-2.5 text-xs">
                  <p className="font-semibold text-slate-800">
                    Phân quyền chức năng chi tiết
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span id="m07-manage-docs-label">
                      Quản lý Kho văn bản chính thức
                    </span>
                    <Switch
                      aria-labelledby="m07-manage-docs-label"
                      checked={newManageDocs}
                      onCheckedChange={setNewManageDocs}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span id="m07-approve-docs-label">
                      Phê duyệt đề nghị cập nhật VB
                    </span>
                    <Switch
                      aria-labelledby="m07-approve-docs-label"
                      checked={newApproveDocs}
                      onCheckedChange={setNewApproveDocs}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span id="m07-manage-tasks-label">
                      Giao việc & đôn đốc nhiệm vụ
                    </span>
                    <Switch
                      aria-labelledby="m07-manage-tasks-label"
                      checked={newManageTasks}
                      onCheckedChange={setNewManageTasks}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span id="m07-private-repo-label">
                      Khai thác Kho dữ liệu riêng phòng
                    </span>
                    <Switch
                      aria-labelledby="m07-private-repo-label"
                      checked={newPrivateAccess}
                      onCheckedChange={setNewPrivateAccess}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-[#1B4D89] hover:bg-[#163E70] text-white gap-1.5"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Thêm tài khoản cán bộ
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-8 border-slate-200 shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base tabular-nums">
                  Danh sách tài khoản & Ma trận phân quyền ({loaderData.users.length})
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Bấm trực tiếp lên từng nhãn chức năng để bật/tắt quyền riêng cho công chức.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-60">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
                />
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Tìm cán bộ (không dấu)…"
                  aria-label="Tìm kiếm tài khoản cán bộ có dấu hoặc không dấu"
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-slate-200 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Email & Họ tên</TableHead>
                      <TableHead className="w-[75px]">Phòng</TableHead>
                      <TableHead>Quyền chức năng (Bấm để bật/tắt)</TableHead>
                      <TableHead className="w-[95px]">Trạng thái</TableHead>
                      <TableHead className="w-[115px] text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loaderData.users
                      .filter((u) =>
                        matchesVietnameseQuery(
                          `${u.email} ${u.full_name} ${u.position} ${u.department_id}`,
                          deferredUserSearch,
                        ),
                      )
                      .map((u) => {
                        const isSelfRow =
                          u.email.toLowerCase() ===
                          (outlet?.currentUser?.email ?? "").toLowerCase();
                        return (
                          <TableRow key={u.id}>
                            <TableCell className="text-xs whitespace-normal min-w-[185px] align-top">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-semibold text-slate-900" translate="no">
                                  {u.email}
                                </p>
                                <Badge
                                  className={
                                    u.role === "owner"
                                      ? "bg-[#0C1E35] text-white text-[10px]"
                                      : "bg-slate-200 text-slate-800 text-[10px]"
                                  }
                                >
                                  {u.role === "owner" ? "Chủ sở hữu" : "Cán bộ"}
                                </Badge>
                              </div>
                              <p className="text-slate-600 mt-0.5">
                                {u.full_name} · {u.position}
                              </p>
                            </TableCell>
                            <TableCell className="whitespace-nowrap align-top">
                              <Badge variant="secondary" className="text-xs">
                                {u.department_id}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs whitespace-normal min-w-[235px] align-top">
                              {u.role === "owner" ? (
                                <span className="font-medium text-emerald-700">
                                  Toàn quyền hệ thống (Owner)
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {(
                                    [
                                      {
                                        key: "can_manage_docs",
                                        label: "Kho VB chính thức",
                                        on: Boolean(u.can_manage_docs),
                                      },
                                      {
                                        key: "can_approve_doc_requests",
                                        label: "Duyệt đề nghị VB",
                                        on: Boolean(u.can_approve_doc_requests),
                                      },
                                      {
                                        key: "can_manage_tasks",
                                        label: "Giao việc",
                                        on: u.can_manage_tasks !== false,
                                      },
                                      {
                                        key: "private_repo_access",
                                        label: "Kho riêng",
                                        on: Boolean(u.private_repo_access),
                                      },
                                    ] as const
                                  ).map((perm) => (
                                    <button
                                      key={perm.key}
                                      type="button"
                                      disabled={busy}
                                      onClick={() =>
                                        void handlePatchUserPermission(
                                          u.id,
                                          { [perm.key]: !perm.on },
                                          `Đã ${!perm.on ? "cấp" : "thu hồi"} quyền '${perm.label}' cho ${u.email}.`,
                                        )
                                      }
                                      className={cn(
                                        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                                        perm.on
                                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                          : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200",
                                      )}
                                    >
                                      {perm.on ? "✓ " : "✕ "}
                                      {perm.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap align-top">
                              <button
                                type="button"
                                disabled={busy || isSelfRow}
                                onClick={() =>
                                  void handlePatchUserPermission(
                                    u.id,
                                    { active: !u.active },
                                    `Đã ${!u.active ? "mở khóa" : "tạm khóa"} tài khoản ${u.email}.`,
                                  )
                                }
                                title={
                                  isSelfRow
                                    ? "Không thể tự khóa tài khoản đang đăng nhập"
                                    : "Bấm để khóa hoặc mở khóa đăng nhập"
                                }
                                className={cn(
                                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-60",
                                  u.active
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                    : "border-rose-300 bg-rose-50 text-rose-800",
                                )}
                              >
                                {u.active ? "Hoạt động" : "Tạm khóa"}
                              </button>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap align-top">
                              <div className="inline-flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  aria-label={`Đặt lại mật khẩu ${u.email}`}
                                  title={`Đặt lại mật khẩu ${u.email}`}
                                  onClick={() => {
                                    setPwdDialogUser(u);
                                    setResetPasswordVal("");
                                  }}
                                  className="h-7 px-2 text-slate-700 hover:text-[#1B4D89]"
                                >
                                  <KeyRound aria-hidden="true" className="h-3.5 w-3.5" />
                                </Button>
                                {!isSelfRow && u.role !== "owner" && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={busy}
                                    aria-label={`Thu hồi tài khoản ${u.email}`}
                                    title={`Thu hồi tài khoản ${u.email}`}
                                    onClick={() => void handleDeleteUser(u.id)}
                                    className="h-7 px-2 text-rose-600 hover:text-rose-700"
                                  >
                                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Dialog
            open={pwdDialogUser !== null}
            onOpenChange={(open) => {
              if (!open) {
                setPwdDialogUser(null);
                setResetPasswordVal("");
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Đặt lại mật khẩu đăng nhập</DialogTitle>
                <DialogDescription>
                  Cấp mật khẩu mới cho tài khoản{" "}
                  <strong>{pwdDialogUser?.email}</strong>.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleResetUserPassword} className="space-y-3">
                <div className="space-y-1">
                  <label
                    htmlFor="m07-reset-pwd-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Mật khẩu mới (tối thiểu 6 ký tự)
                  </label>
                  <Input
                    id="m07-reset-pwd-input"
                    type="password"
                    value={resetPasswordVal}
                    onChange={(e) => setResetPasswordVal(e.target.value)}
                    placeholder="Nhập mật khẩu mới…"
                    spellCheck={false}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPwdDialogUser(null)}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    disabled={busy || resetPasswordVal.trim().length < 6}
                    className="bg-[#1B4D89] hover:bg-[#163E70] text-white"
                  >
                    Lưu mật khẩu mới
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Tab 2: Instruction của phòng */}
        <TabsContent value="instruction" className="pt-3">
          <Card className="border-slate-200 shadow-2xs max-w-3xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-1.5">
                <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-[#1B4D89]" />
                Cấu hình Instruction chuyên biệt cho từng phòng
              </CardTitle>
              <CardDescription className="text-xs">
                Chỉ dẫn này được gắn trực tiếp vào ngữ cảnh của Trợ lý AI khi cán bộ
                làm việc trong không gian phòng tương ứng của{" "}
                <strong>{communeNameDisplay}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveInstruction} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Chọn phòng chuyên môn
                  </label>
                  <Select
                    value={instDeptId}
                    onValueChange={(v) => setInstDeptId(v as DepartmentId)}
                  >
                    <SelectTrigger
                      aria-label="Chọn phòng chuyên môn"
                      className="w-full min-w-0"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {loaderData.departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="m07-instruction-text"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Nội dung Instruction hệ thống của phòng {instDeptId}
                  </label>
                  <Textarea
                    id="m07-instruction-text"
                    rows={6}
                    value={instText}
                    onChange={(e) => setInstText(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={busy}
                  className="bg-[#1B4D89] hover:bg-[#163E70] text-white gap-1.5"
                >
                  <Save aria-hidden="true" className="h-4 w-4" />
                  Lưu Instruction của phòng {instDeptId}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Cổng API đấu nối */}
        <TabsContent value="api" className="pt-3">
          <Card className="border-slate-200 shadow-2xs max-w-3xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-1.5">
                <KeyRound aria-hidden="true" className="h-4 w-4 text-[#1B4D89]" />
                Cổng API đấu nối mô hình ngôn ngữ (Google Gemini 4 &amp; LLM Gateway)
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Tích hợp trực tiếp dòng mô hình <strong>Google Gemini 4</strong>{" "}
                qua chuẩn <code>Interactions API v1</code> với chế độ bảo mật không
                lưu trữ dữ liệu công vụ (<code>store=False</code>) và tự động chuyển
                tầng thông minh khi vượt hạn mức.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-[#1B4D89]/25 bg-[#EEF4FB]/70 p-3.5 text-xs text-slate-800 space-y-1.5">
                <p className="font-semibold text-[#0C1E35] flex items-center gap-1.5">
                  <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-[#1B4D89]" />
                  Hướng dẫn kết nối an toàn bằng tài khoản Google / Gemini cá nhân
                </p>
                <p className="leading-relaxed text-slate-700">
                  Hệ thống tuyệt đối <strong>không yêu cầu và không lưu mật khẩu Gmail</strong>.
                  Để sử dụng tài khoản Google của anh/chị, hãy mở Google AI Studio tạo
                  khóa <code>GEMINI_API_KEY</code> (dạng <code>AIzaSy…</code>), dán vào
                  ô bên dưới, bật công tắc kích hoạt và bấm{" "}
                  <strong>Kiểm tra kết nối AI</strong>.
                </p>
                <div className="pt-0.5">
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#1B4D89] hover:underline"
                  >
                    Lấy khóa GEMINI_API_KEY chính thức tại Google AI Studio
                    <ExternalLink aria-hidden="true" className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <form onSubmit={handleSaveConnector} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 min-w-0">
                    <label className="block text-xs font-semibold text-slate-700">
                      Nhà cung cấp AI (Provider)
                    </label>
                    <Select
                      value={connProvider}
                      onValueChange={handleProviderChange}
                    >
                      <SelectTrigger
                        aria-label="Chọn nhà cung cấp mô hình AI"
                        className="w-full min-w-0"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="google-gemini">
                          Google Gemini 4 (Interactions API v1 — Khuyến nghị)
                        </SelectItem>
                        <SelectItem value="openai-compatible">
                          OpenAI-Compatible / Cổng nội bộ
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <label
                      htmlFor="m07-conn-name"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Tên hiển thị cổng kết nối
                    </label>
                    <Input
                      id="m07-conn-name"
                      value={connName}
                      onChange={(e) => setConnName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 min-w-0">
                    <label
                      htmlFor="m07-conn-model"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Mô hình ngôn ngữ (Model)
                    </label>
                    {connProvider === "google-gemini" ? (
                      <Select value={connModel} onValueChange={setConnModel}>
                        <SelectTrigger
                          id="m07-conn-model"
                          aria-label="Chọn thế hệ mô hình Google Gemini 4"
                          className="w-full min-w-0"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GEMINI_MODEL_PRESETS.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="m07-conn-model"
                        value={connModel}
                        onChange={(e) => setConnModel(e.target.value)}
                        spellCheck={false}
                        autoComplete="off"
                      />
                    )}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <label
                      htmlFor="m07-conn-url"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Địa chỉ máy chủ API (Base URL)
                    </label>
                    <Input
                      id="m07-conn-url"
                      value={connUrl}
                      onChange={(e) => setConnUrl(e.target.value)}
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </div>
                </div>

                {connProvider === "google-gemini" && (
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {GEMINI_MODEL_PRESETS.find((p) => p.id === connModel)
                      ?.description ??
                      "Tự động chuyển tầng dự phòng Carbon → Argon → Hydrogen → 3.5 Flash-Lite khi gặp giới hạn hạn mức."}
                  </p>
                )}

                <div className="space-y-1">
                  <label
                    htmlFor="m07-conn-key"
                    className="text-xs font-semibold text-slate-700 flex items-center justify-between flex-wrap gap-1"
                  >
                    <span>API Secret Key (chỉ nhập khi muốn cấp mới hoặc thay đổi)</span>
                    <Badge variant="outline" className="font-mono text-[11px]">
                      Hiện tại:{" "}
                      {firstConnector?.api_key_masked || "Chưa thiết lập khóa"}
                    </Badge>
                  </label>
                  <Input
                    id="m07-conn-key"
                    type="password"
                    value={connKey}
                    onChange={(e) => setConnKey(e.target.value)}
                    placeholder={
                      connProvider === "google-gemini" ? "AIzaSy…" : "sk-…"
                    }
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs gap-3">
                  <div id="m07-conn-active-label">
                    <p className="font-semibold text-slate-900">
                      Kích hoạt tổng hợp thông minh bằng LLM trực tiếp (M01, M02, M03, M05)
                    </p>
                    <p className="text-slate-600">
                      Khi tắt hoặc chưa có khóa, hệ thống tự động dùng bộ quy tắc hành chính chuẩn nội bộ.
                    </p>
                  </div>
                  <Switch
                    aria-labelledby="m07-conn-active-label"
                    checked={connActive}
                    onCheckedChange={setConnActive}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <Button
                    type="submit"
                    disabled={busy || probing}
                    className="bg-[#1B4D89] hover:bg-[#163E70] text-white gap-1.5"
                  >
                    <Save aria-hidden="true" className="h-4 w-4" />
                    Lưu cấu hình Cổng API
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || probing || !firstConnector}
                    onClick={() => void handleProbeConnector()}
                    className="border-[#1B4D89]/30 text-[#1B4D89] hover:bg-[#EEF4FB] gap-1.5"
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className={cn("h-4 w-4", probing && "animate-spin")}
                    />
                    {probing ? "Đang kiểm tra…" : "Kiểm tra kết nối AI"}
                  </Button>
                </div>
              </form>

              {probeResult && (
                <div
                  role="status"
                  aria-live="polite"
                  className={cn(
                    "rounded-lg border p-3.5 text-xs space-y-1.5",
                    probeResult.ok
                      ? "border-emerald-200 bg-emerald-50/90 text-emerald-950"
                      : "border-rose-200 bg-rose-50/90 text-rose-950",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold flex items-center gap-1.5">
                      {probeResult.ok ? (
                        <CheckCircle2
                          aria-hidden="true"
                          className="h-4 w-4 text-emerald-700"
                        />
                      ) : (
                        <AlertTriangle
                          aria-hidden="true"
                          className="h-4 w-4 text-rose-700"
                        />
                      )}
                      {probeResult.detail}
                    </span>
                    <Badge
                      variant="outline"
                      className="font-mono text-[11px] bg-white/80 tabular-nums"
                    >
                      {probeResult.resolved_model} · {probeResult.latency_ms} ms
                    </Badge>
                  </div>
                  {probeResult.sample_reply && (
                    <p className="text-slate-700 bg-white/80 rounded border border-emerald-200/70 px-2.5 py-1.5 italic">
                      “{probeResult.sample_reply}”
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Nhật ký hệ thống */}
        <TabsContent value="nhat-ky" className="pt-3">
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-1.5 tabular-nums">
                  <History aria-hidden="true" className="h-4 w-4 text-[#1B4D89]" />
                  Nhật ký hoạt động hệ thống ({loaderData.logs.length} bản ghi gần nhất)
                </CardTitle>
                <CardDescription className="text-xs">
                  Ghi nhận thao tác nghiệp vụ tại <strong>{communeNameDisplay}</strong>{" "}
                  mà không lưu trữ nội dung tài liệu tạm của phiên.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-56">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
                  />
                  <Input
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Lọc nhật ký (không dấu)…"
                    aria-label="Lọc nhật ký hệ thống có dấu hoặc không dấu"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => revalidator.revalidate()}
                  className="gap-1.5 text-xs whitespace-nowrap"
                >
                  <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                  Làm mới
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-slate-200 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-[155px]">Thời gian</TableHead>
                      <TableHead className="w-[175px]">Tài khoản</TableHead>
                      <TableHead className="w-[95px]">Mô-đun</TableHead>
                      <TableHead className="w-[140px]">Hành động</TableHead>
                      <TableHead>Chi tiết</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loaderData.logs
                      .filter((log) =>
                        matchesVietnameseQuery(
                          `${log.actor_email} ${log.module_code} ${log.department_id} ${log.action} ${log.detail}`,
                          deferredLogSearch,
                        ),
                      )
                      .map((log) => (
                        <TableRow key={log.id} className="text-xs">
                          <TableCell className="text-slate-600 font-mono text-[11px] whitespace-nowrap align-top tabular-nums">
                            {log.created_at.slice(0, 19).replace("T", " ")}
                          </TableCell>
                          <TableCell className="font-medium whitespace-nowrap align-top">
                            {log.actor_email}
                          </TableCell>
                          <TableCell className="whitespace-nowrap align-top">
                            <Badge variant="outline" className="text-[10px]">
                              {log.module_code} · {log.department_id}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-[#1B4D89] whitespace-nowrap align-top">
                            {log.action}
                          </TableCell>
                          <TableCell className="text-slate-700 whitespace-normal min-w-[220px] align-top">
                            {log.detail}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Nhân bản AI (Multi-Tenant Provisioning & Live Switch) */}
        <TabsContent
          value="nhan-ban"
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-3"
        >
          <Card className="lg:col-span-5 border-slate-200 shadow-2xs h-fit">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-1.5">
                <Copy aria-hidden="true" className="h-4 w-4 text-[#1B4D89]" />
                Nhân bản hệ thống AI độc lập
              </CardTitle>
              <CardDescription className="text-xs">
                Khởi tạo ngay một hệ thống độc lập mới (CSDL riêng, 4 không gian phòng
                ban và Chủ sở hữu riêng) cho từng xã, phường.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCloneTenant} className="space-y-3">
                <div className="space-y-1">
                  <label
                    htmlFor="m07-clone-commune"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Tên đơn vị UBND xã / phường mới
                  </label>
                  <Input
                    id="m07-clone-commune"
                    value={communeName}
                    onChange={(e) => setCommuneName(e.target.value)}
                    placeholder="VD: UBND Phường Bến Nghé"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="m07-clone-admin"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Email Chủ sở hữu đơn vị mới
                  </label>
                  <Input
                    id="m07-clone-admin"
                    type="email"
                    value={communeAdmin}
                    onChange={(e) => setCommuneAdmin(e.target.value)}
                    placeholder="admin@tenphuong.gov.vn"
                    spellCheck={false}
                    autoComplete="off"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-[#1B4D89] hover:bg-[#163E70] text-white gap-1.5"
                >
                  <Copy aria-hidden="true" className="h-4 w-4" />
                  {busy ? "Đang khởi tạo…" : "Nhân bản hệ thống độc lập"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-7 border-slate-200 shadow-2xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base tabular-nums">
                    Các đơn vị xã, phường đã nhân bản ({loaderData.tenants.length})
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Bấm 1 chạm để chuyển toàn bộ phiên quản trị sang vận hành trực tiếp
                    trên cơ sở dữ liệu độc lập của từng xã/phường.
                  </CardDescription>
                </div>

                {activeTenantSlug === "default" ? (
                  <Badge
                    variant="outline"
                    className="border-[#1B4D89]/30 bg-[#EEF4FB] text-[#1B4D89] text-[11px] whitespace-nowrap"
                  >
                    <Building2 aria-hidden="true" className="h-3 w-3 mr-1" />
                    Đang ở đơn vị gốc (default)
                  </Badge>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleReturnRootTenant}
                    className="h-7 text-xs gap-1 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 whitespace-nowrap"
                  >
                    <RotateCcw aria-hidden="true" className="h-3 w-3" />
                    Quay về đơn vị gốc
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loaderData.tenants.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">
                  Chưa có bản nhân bản xã/phường nào. Hãy nhập tên đơn vị ở cột bên
                  trái để khởi tạo.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {loaderData.tenants.map((t) => {
                    const isOperating = activeTenantSlug === t.slug;
                    return (
                      <div
                        key={t.id}
                        className={
                          isOperating
                            ? "rounded-lg border-2 border-emerald-500 bg-emerald-50/50 p-3.5 text-xs space-y-2"
                            : "rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-2"
                        }
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-slate-900 text-sm">
                              {t.commune_name}
                            </span>
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px] border-slate-300 bg-white"
                            >
                              {t.slug}
                            </Badge>
                          </div>

                          {isOperating ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] whitespace-nowrap">
                              Đang vận hành
                            </Badge>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600">
                          <div>
                            <p>
                              Chủ sở hữu: <strong>{t.admin_email}</strong>
                            </p>
                            <p className="font-mono text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Database
                                aria-hidden="true"
                                className="h-3 w-3 text-[#1B4D89] shrink-0"
                              />
                              Kho lưu trữ cô lập: {t.storage_label || `tenants/${t.slug}.db`}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isOperating ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleReturnRootTenant}
                                className="h-7 px-2.5 text-xs gap-1 border-amber-300 bg-white text-amber-900 hover:bg-amber-50 whitespace-nowrap"
                              >
                                <RotateCcw aria-hidden="true" className="h-3 w-3" />
                                Quay về đơn vị gốc
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleActivateTenant(t)}
                                className="h-7 px-2.5 text-xs gap-1.5 bg-[#1B4D89] hover:bg-[#163E70] text-white whitespace-nowrap"
                              >
                                <ArrowRightLeft aria-hidden="true" className="h-3 w-3" />
                                Chuyển sang vận hành đơn vị này
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
