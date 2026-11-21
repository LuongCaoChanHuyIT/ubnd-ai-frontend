import { useEffect, useRef, useState } from "react";
import { redirect, useNavigate, useNavigation, useSearchParams } from "react-router";
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { Route } from "./+types/login";
import {
  apiRequest,
  LEGAL_DISCLAIMER_TEXT,
  loginWithPassword,
  resolveServerApiBase,
  type AuthAccountsPayload,
  type RbacUser,
  type TenantSummary,
} from "~/lib/api";
import { parseServerCookies } from "~/lib/session";
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
import { CivicCrest } from "~/components/workspace/civic-crest";
import { cn } from "~/lib/utils";

const DEMO_DEFAULT_PASSWORD = "Ubnd@2026";

const FALLBACK_ACCOUNTS: RbacUser[] = [
  {
    id: 1,
    email: "tsh.co@tshorg.vn",
    full_name: "Quản trị viên Hệ thống (TSH)",
    position: "Chủ sở hữu hệ thống",
    role: "owner",
    department_id: "VP",
    private_repo_access: true,
    can_manage_docs: true,
    can_approve_doc_requests: true,
    can_manage_tasks: true,
    active: true,
    created_at: "",
  },
  {
    id: 2,
    email: "canbo.vp@ubnd.vn",
    full_name: "Nguyễn Minh Tuấn",
    position: "Công chức Văn phòng - Thống kê (Văn thư)",
    role: "officer",
    department_id: "VP",
    private_repo_access: true,
    can_manage_docs: true,
    can_approve_doc_requests: true,
    can_manage_tasks: true,
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
    can_manage_docs: false,
    can_approve_doc_requests: false,
    can_manage_tasks: true,
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
    can_manage_docs: false,
    can_approve_doc_requests: false,
    can_manage_tasks: false,
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
    private_repo_access: false,
    can_manage_docs: false,
    can_approve_doc_requests: false,
    can_manage_tasks: true,
    active: true,
    created_at: "",
  },
];

export function meta({}: Route.MetaArgs) {
  return [{ title: "Đăng nhập hệ thống · Trợ lý AI Hành chính UBND Xã, Phường" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { tenantSlug, authToken } = parseServerCookies(
    request.headers.get("cookie"),
  );
  const baseUrl = resolveServerApiBase();

  if (authToken) {
    try {
      await apiRequest("/api/auth/me", {
        baseUrl,
        headers: {
          Authorization: `Bearer ${authToken}`,
          "X-Tenant-Slug": tenantSlug,
        },
      });
      const url = new URL(request.url);
      const rawNext = url.searchParams.get("next") ?? "/";
      const safeNext =
        rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
      return redirect(safeNext);
    } catch {
      // Token expired or invalid -> render login form
    }
  }

  try {
    const accounts = await apiRequest<AuthAccountsPayload>(
      `/api/auth/accounts?tenant_slug=${encodeURIComponent(tenantSlug)}`,
      { baseUrl },
    );
    return {
      communeName: accounts.commune_name,
      activeTenantSlug: accounts.active_tenant_slug,
      availableTenants: accounts.available_tenants,
      demoAccounts: accounts.demo_accounts.length
        ? accounts.demo_accounts
        : FALLBACK_ACCOUNTS,
    };
  } catch {
    return {
      communeName: "UBND xã, phường trung tâm",
      activeTenantSlug: "default",
      availableTenants: [
        { slug: "default", commune_name: "UBND xã, phường trung tâm" },
      ] satisfies TenantSummary[],
      demoAccounts: FALLBACK_ACCOUNTS,
    };
  }
}

export default function LoginRoute({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();

  const [tenantSlug, setTenantSlug] = useState(loaderData.activeTenantSlug);
  const lastFetchedTenantRef = useRef(loaderData.activeTenantSlug);
  const [accounts, setAccounts] = useState<RbacUser[]>(loaderData.demoAccounts);
  const [communeName, setCommuneName] = useState(loaderData.communeName);
  const [email, setEmail] = useState(
    loaderData.demoAccounts[0]?.email ?? "tsh.co@tshorg.vn",
  );
  const [password, setPassword] = useState(DEMO_DEFAULT_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isSubmitting = busy || navigation.state !== "idle";

  useEffect(() => {
    if (tenantSlug === lastFetchedTenantRef.current) {
      return;
    }
    let cancelled = false;
    void apiRequest<AuthAccountsPayload>(
      `/api/auth/accounts?tenant_slug=${encodeURIComponent(tenantSlug)}`,
    )
      .then((res) => {
        if (cancelled) return;
        lastFetchedTenantRef.current = tenantSlug;
        setCommuneName(res.commune_name);
        if (res.demo_accounts.length > 0) {
          setAccounts(res.demo_accounts);
        }
      })
      .catch(() => {
        // Keep SSR fallback list
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  function resolveDestination(user: RbacUser): string {
    const rawNext = searchParams.get("next") ?? "";
    if (rawNext.startsWith("/") && !rawNext.startsWith("//")) {
      return rawNext;
    }
    return `/?dept=${encodeURIComponent(user.department_id)}`;
  }

  async function submitCredentials(targetEmail: string, targetPassword: string) {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await loginWithPassword({
        email: targetEmail,
        password: targetPassword,
        tenantSlug,
      });
      navigate(resolveDestination(res.user), { replace: true });
    } catch (err) {
      setBusy(false);
      setErrorMsg(
        err instanceof Error ? err.message : "Không thể đăng nhập vào hệ thống.",
      );
    }
  }

  async function handleFormSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!email.trim() || !password) return;
    await submitCredentials(email, password);
  }

  return (
    <div className="min-h-screen w-full bg-[#F6F7F9] text-slate-900 grid grid-cols-1 lg:grid-cols-12">
      {/* Left Sovereign Navy Brand Panel */}
      <aside className="lg:col-span-5 bg-[#0C1E35] border-t-4 border-t-[#D97706] text-slate-100 p-6 sm:p-10 flex flex-col justify-between gap-8">
        <div className="space-y-6">
          <div className="flex items-center gap-3.5">
            <CivicCrest />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                Cổng xác thực nội bộ · Zero-Trust RBAC
              </p>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Trợ lý AI Hành chính Cấp Xã, Phường
              </h1>
            </div>
          </div>

          <div className="rounded-xl border border-white/12 bg-[#132946] p-4 space-y-2.5">
            <p className="text-xs font-semibold text-amber-200 flex items-center gap-1.5">
              <Building2 aria-hidden="true" className="h-4 w-4 text-amber-400" />
              Đơn vị vận hành: {communeName}
            </p>
            <p className="text-xs text-slate-200 leading-relaxed">
              Không gian làm việc số tách biệt theo 4 bộ phận chuyên môn (VP, KT,
              VHXH, NNMT), kiểm soát phân quyền chi tiết từng chức năng và bảo mật
              tài liệu phiên trên bộ nhớ tạm (RAM).
            </p>
          </div>

          <ul className="space-y-3 text-xs text-slate-200">
            <li className="flex items-start gap-2.5">
              <CheckCircle2
                aria-hidden="true"
                className="h-4 w-4 text-amber-400 shrink-0 mt-0.5"
              />
              <span>
                <strong>Phân quyền sâu theo chức năng:</strong> Tách riêng quyền Quản
                lý Kho văn bản chính thức, Duyệt đề nghị cập nhật, Giao việc và Kho dữ
                liệu riêng bộ phận.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2
                aria-hidden="true"
                className="h-4 w-4 text-amber-400 shrink-0 mt-0.5"
              />
              <span>
                <strong>Xem văn bản & tệp trực tiếp:</strong> Xem trực tiếp tệp PDF,
                DOCX, văn bản pháp quy và mở đường dẫn nguồn gốc ngay trong phiên.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2
                aria-hidden="true"
                className="h-4 w-4 text-amber-400 shrink-0 mt-0.5"
              />
              <span>
                <strong>Tra cứu tiếng Việt có dấu & không dấu:</strong> Nhận diện
                chính xác số hiệu, lĩnh vực nghiệp vụ (Nghị định 30, đất đai, hộ tịch,
                ngân sách…).
              </span>
            </li>
          </ul>
        </div>

        <p className="text-[11px] text-slate-300 leading-relaxed border-t border-white/10 pt-4">
          {LEGAL_DISCLAIMER_TEXT}
        </p>
      </aside>

      {/* Right Authentication Form + Quick Demo Accounts */}
      <main className="lg:col-span-7 p-5 sm:p-10 flex items-center justify-center">
        <div className="w-full max-w-2xl space-y-5">
          <Card className="border-slate-200 shadow-xs bg-white">
            <CardHeader className="space-y-1.5">
              <CardTitle className="text-lg sm:text-xl text-slate-900 flex items-center gap-2">
                <Lock aria-hidden="true" className="h-5 w-5 text-[#1B4D89]" />
                Đăng nhập tài khoản công vụ
              </CardTitle>
              <CardDescription className="text-xs text-slate-600">
                Nhập email công vụ và mật khẩu để truy cập đúng phòng chuyên môn được
                phân quyền.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorMsg && (
                <div role="alert" aria-live="polite">
                  <Alert variant="destructive" className="py-2.5">
                    <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
                  </Alert>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-3.5">
                {loaderData.availableTenants.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Đơn vị UBND xã / phường
                    </label>
                    <Select value={tenantSlug} onValueChange={setTenantSlug}>
                      <SelectTrigger
                        aria-label="Chọn đơn vị UBND xã phường"
                        className="w-full"
                      >
                        <SelectValue>
                          {communeName} ({tenantSlug})
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {loaderData.availableTenants.map((t) => (
                          <SelectItem key={t.slug} value={t.slug} className="text-xs">
                            {t.commune_name} ({t.slug})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="login-email"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Email cán bộ
                    </label>
                    <Input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="canbo.vp@ubnd.vn"
                      autoComplete="username"
                      spellCheck={false}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Mật khẩu
                    </label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Nhập mật khẩu…"
                        autoComplete="current-password"
                        spellCheck={false}
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-800"
                      >
                        {showPassword ? (
                          <EyeOff aria-hidden="true" className="h-4 w-4" />
                        ) : (
                          <Eye aria-hidden="true" className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#1B4D89] hover:bg-[#163E70] text-white gap-2 h-10"
                >
                  <LogIn aria-hidden="true" className="h-4 w-4" />
                  {isSubmitting
                    ? "Đang xác thực phiên…"
                    : "Đăng nhập vào không gian làm việc"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Quick-fill Demo Personas for RBAC Evaluation */}
          {accounts.length > 0 && (
            <Card className="border-slate-200 bg-white shadow-2xs">
              <CardHeader className="pb-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-sm flex items-center gap-1.5 text-slate-900">
                    <UserCheck
                      aria-hidden="true"
                      className="h-4 w-4 text-[#1B4D89]"
                    />
                    Tài khoản mẫu phục vụ kiểm thử phân quyền nhanh
                  </CardTitle>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    <KeyRound aria-hidden="true" className="h-3 w-3 mr-1" />
                    Mật khẩu mẫu: {DEMO_DEFAULT_PASSWORD}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Bấm <strong>Đăng nhập nhanh</strong> trên từng hồ sơ để trải nghiệm
                  sự khác biệt về quyền Quản lý Kho văn bản, Duyệt đề nghị, Giao việc
                  và Kho dữ liệu riêng.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {accounts.map((acc) => {
                  const isSelected =
                    acc.email.toLowerCase() === email.trim().toLowerCase();
                  return (
                    <div
                      key={acc.email}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border p-3 text-xs transition-colors",
                        isSelected
                          ? "border-[#1B4D89] bg-[#EEF4FB]/70"
                          : "border-slate-200 bg-slate-50/60 hover:bg-slate-50",
                      )}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900" translate="no">
                            {acc.email}
                          </span>
                          <Badge
                            className={
                              acc.role === "owner"
                                ? "bg-[#0C1E35] text-white text-[10px]"
                                : "bg-[#1B4D89] text-white text-[10px]"
                            }
                          >
                            {acc.role === "owner"
                              ? "Chủ sở hữu"
                              : `Phòng ${acc.department_id}`}
                          </Badge>
                        </div>
                        <p className="text-slate-600">
                          {acc.full_name} · {acc.position}
                        </p>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {(acc.role === "owner" || acc.can_manage_docs) && (
                            <Badge
                              variant="outline"
                              className="border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px]"
                            >
                              <ShieldCheck
                                aria-hidden="true"
                                className="h-2.5 w-2.5 mr-0.5"
                              />
                              Quản lý Kho VB
                            </Badge>
                          )}
                          {(acc.role === "owner" || acc.can_approve_doc_requests) && (
                            <Badge
                              variant="outline"
                              className="border-blue-300 bg-blue-50 text-blue-800 text-[10px]"
                            >
                              Duyệt đề nghị VB
                            </Badge>
                          )}
                          {acc.role === "owner" || acc.can_manage_tasks !== false ? (
                            <Badge variant="outline" className="text-[10px]">
                              Giao & nhắc việc
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-50 text-amber-800 text-[10px]"
                            >
                              Chỉ cập nhật tiến độ
                            </Badge>
                          )}
                          {acc.role === "owner" || acc.private_repo_access ? (
                            <Badge variant="outline" className="text-[10px]">
                              Kho riêng {acc.department_id}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-50 text-amber-800 text-[10px]"
                            >
                              Giới hạn Kho riêng
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isSubmitting}
                          onClick={() => {
                            setEmail(acc.email);
                            setPassword(DEMO_DEFAULT_PASSWORD);
                          }}
                          className="h-8 text-xs"
                        >
                          Điền mẫu
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSubmitting}
                          onClick={() => {
                            setEmail(acc.email);
                            setPassword(DEMO_DEFAULT_PASSWORD);
                            void submitCredentials(acc.email, DEMO_DEFAULT_PASSWORD);
                          }}
                          className="h-8 text-xs bg-[#1B4D89] hover:bg-[#163E70] text-white"
                        >
                          Đăng nhập nhanh
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
