import { useEffect, useState } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useRevalidator,
  useSearchParams,
} from "react-router";
import {
  BookOpen,
  Building2,
  CheckSquare,
  Copy,
  FileCheck2,
  FileUp,
  History,
  Link2,
  Lock,
  Menu,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  LEGAL_DISCLAIMER_TEXT,
  type Department,
  type DepartmentId,
  type RbacUser,
  type TenantSummary,
  type WorkspaceOutletContext,
} from "~/lib/api";
import {
  canAccessM07Admin,
  isDepartmentLockedForRole,
  normalizeM04Tab,
  resolveEffectiveDepartmentForUser,
  resolvePostActorSwitchTarget,
} from "~/lib/m06-m07-helpers";
import {
  DEFAULT_ACTOR_EMAIL,
  ensureBrowserIdentityCookies,
  setActiveActorEmail,
  setActiveTenantSlug,
} from "~/lib/session";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { cn } from "~/lib/utils";

interface NavItemConfig {
  id: string;
  label: string;
  pathname: string;
  tab?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "core" | "doc_request" | "m07_admin";
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: "m01", label: "Tư vấn công việc", pathname: "/", icon: Plus, group: "core" },
  {
    id: "m02",
    label: "AI hỗ trợ kiến thức mở rộng",
    pathname: "/kien-thuc-mo-rong",
    icon: Sparkles,
    group: "core",
  },
  {
    id: "m03",
    label: "Soạn thảo & kiểm tra",
    pathname: "/soan-thao-kiem-tra",
    icon: FileCheck2,
    group: "core",
  },
  {
    id: "m04",
    label: "Nguồn văn bản chính thức",
    pathname: "/nguon-van-ban",
    icon: BookOpen,
    group: "core",
  },
  {
    id: "m05",
    label: "Tải & xử lý tài liệu",
    pathname: "/xu-ly-tai-lieu",
    icon: FileUp,
    group: "core",
  },
  {
    id: "m06",
    label: "Điều hành công việc",
    pathname: "/dieu-hanh-cong-viec",
    icon: CheckSquare,
    group: "core",
  },
  {
    id: "m04-req",
    label: "Đề nghị cập nhật văn bản",
    pathname: "/nguon-van-ban",
    tab: "de_nghi",
    icon: RefreshCw,
    group: "doc_request",
  },
  {
    id: "m07-inst",
    label: "Instruction của phòng",
    pathname: "/quan-tri-he-thong",
    tab: "instruction",
    icon: SlidersHorizontal,
    group: "m07_admin",
  },
  {
    id: "m07-api",
    label: "Cổng API đấu nối",
    pathname: "/quan-tri-he-thong",
    tab: "api",
    icon: Link2,
    group: "m07_admin",
  },
  {
    id: "m07-rbac",
    label: "Phân quyền email",
    pathname: "/quan-tri-he-thong",
    tab: "phan-quyen",
    icon: ShieldCheck,
    group: "m07_admin",
  },
  {
    id: "m07-logs",
    label: "Nhật ký hệ thống",
    pathname: "/quan-tri-he-thong",
    tab: "nhat-ky",
    icon: History,
    group: "m07_admin",
  },
  {
    id: "m07-clone",
    label: "Nhân bản AI",
    pathname: "/quan-tri-he-thong",
    tab: "nhan-ban",
    icon: Copy,
    group: "m07_admin",
  },
];

export interface WorkspaceShellProps {
  communeName: string;
  activeTenantSlug: string;
  availableTenants: TenantSummary[];
  departments: Department[];
  users: RbacUser[];
  currentDeptId: DepartmentId;
  resolvedActorEmail: string;
}

export function WorkspaceShell({
  communeName,
  activeTenantSlug,
  availableTenants,
  departments,
  users,
  currentDeptId,
  resolvedActorEmail,
}: WorkspaceShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const [actorEmail, setActorEmailState] = useState(resolvedActorEmail);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const synced = ensureBrowserIdentityCookies();
    let activeEmail = synced.actorEmail;

    // Self-heal if cookie had an email from another tenant not registered here
    const matchedInTenant = users.find(
      (u) => u.email.toLowerCase() === activeEmail.toLowerCase(),
    );
    if (!matchedInTenant && users.length > 0) {
      activeEmail = users[0].email;
      setActiveActorEmail(activeEmail);
    }

    // Also self-heal if SSR fell back to "default" due to stale tenant cookie
    if (synced.tenantSlug !== activeTenantSlug) {
      setActiveTenantSlug(activeTenantSlug);
    }

    setActorEmailState(activeEmail);

    if (activeEmail.toLowerCase() !== resolvedActorEmail.toLowerCase()) {
      revalidator.revalidate();
    }

    const onActorChanged = (ev: Event) => {
      const next = (ev as CustomEvent<string>).detail;
      if (next) {
        setActorEmailState(next);
      }
    };
    window.addEventListener("ubnd-actor-changed", onActorChanged);
    return () => window.removeEventListener("ubnd-actor-changed", onActorChanged);
  }, [activeTenantSlug, resolvedActorEmail, users]);

  const currentUser =
    users.find((u) => u.email.toLowerCase() === actorEmail.toLowerCase()) ??
    users[0] ?? {
      id: 0,
      email: actorEmail,
      full_name: "Chủ sở hữu hệ thống",
      position: "Quản trị viên",
      role: "owner" as const,
      department_id: currentDeptId,
      private_repo_access: true,
      active: true,
      created_at: "",
    };

  const effectiveDeptId = resolveEffectiveDepartmentForUser(
    currentDeptId,
    currentUser,
  );
  const deptLocked = isDepartmentLockedForRole(currentUser.role);
  const showM07Admin = canAccessM07Admin(currentUser.role);
  const isClonedTenant = activeTenantSlug !== "default";

  const currentDept =
    departments.find((d) => d.id === effectiveDeptId) ??
    departments[0] ?? {
      id: "VP" as DepartmentId,
      code: "VP",
      name: "Văn phòng HĐND & UBND",
      scope_summary: "Tổng hợp, văn thư, tư pháp - hộ tịch, tiếp công dân và kiểm soát TTHC",
      instruction: "",
      updated_at: "",
    };

  const activeTabParam = searchParams.get("tab") ?? "";

  function buildHref(pathname: string, tab?: string, deptOverride?: DepartmentId) {
    const params = new URLSearchParams();
    params.set("dept", deptOverride ?? effectiveDeptId);
    if (tab) {
      params.set("tab", tab);
    }
    return `${pathname}?${params.toString()}`;
  }

  function isItemActive(item: NavItemConfig): boolean {
    if (location.pathname !== item.pathname) {
      return false;
    }
    if (item.pathname === "/nguon-van-ban") {
      const m04Tab = normalizeM04Tab(activeTabParam);
      if (item.tab === "de_nghi") return m04Tab === "de_nghi";
      return m04Tab !== "de_nghi";
    }
    if (item.pathname === "/quan-tri-he-thong") {
      const effectiveTab = activeTabParam || "phan-quyen";
      return item.tab === effectiveTab;
    }
    return true;
  }

  function handleDepartmentChange(nextDept: string) {
    if (deptLocked) return;
    const dept = nextDept as DepartmentId;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("dept", dept);
    if (location.pathname === "/dieu-hanh-cong-viec" && !nextParams.get("filterDept")) {
      // Let M06 follow the newly chosen department by default
      nextParams.delete("filterDept");
    }
    navigate(`${location.pathname}?${nextParams.toString()}`);
  }

  function handleActorSwitch(nextEmail: string) {
    setActiveActorEmail(nextEmail);
    setActorEmailState(nextEmail);
    const matched = users.find(
      (u) => u.email.toLowerCase() === nextEmail.toLowerCase(),
    );
    if (matched) {
      const targetUrl = resolvePostActorSwitchTarget(
        location.pathname,
        searchParams.toString(),
        matched,
      );
      navigate(targetUrl);
    }
    revalidator.revalidate();
  }

  function switchTenant(nextSlug: string, preferredAdminEmail?: string) {
    const cleanSlug = (nextSlug || "default").trim().toLowerCase();
    setActiveTenantSlug(cleanSlug);
    const nextEmail =
      cleanSlug === "default"
        ? DEFAULT_ACTOR_EMAIL
        : (preferredAdminEmail?.trim().toLowerCase() || DEFAULT_ACTOR_EMAIL);
    setActiveActorEmail(nextEmail);
    setActorEmailState(nextEmail);
    revalidator.revalidate();
  }

  const outletContext: WorkspaceOutletContext = {
    communeName,
    activeTenantSlug,
    availableTenants,
    departments,
    currentUser,
    switchTenant,
  };

  const sidebarContent = (
    <div className="flex h-full w-[268px] flex-col bg-[#0F172A] text-slate-100 select-none">
      {/* Brand + Commune Operating Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-800/80 space-y-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 font-bold text-xs tracking-wide text-white shadow-sm">
            AI
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold tracking-wide text-white truncate">
              TRỢ LÝ CÁN BỘ
            </p>
            <p className="text-[11px] text-blue-300 font-medium truncate" title={communeName}>
              {communeName}
            </p>
          </div>
        </div>

        {/* Active Tenant Badge & Quick Switcher for Owner */}
        <div className="rounded-md border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 space-y-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-300 truncate">
              <Building2 className="h-3 w-3 text-blue-400 shrink-0" />
              {isClonedTenant ? `Bản độc lập (${activeTenantSlug})` : "Đơn vị gốc (Mặc định)"}
            </span>
            {isClonedTenant && showM07Admin && (
              <button
                type="button"
                onClick={() => switchTenant("default")}
                className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/30 whitespace-nowrap"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Đơn vị gốc
              </button>
            )}
          </div>

          {showM07Admin && availableTenants.length > 1 && (
            <Select
              value={activeTenantSlug}
              onValueChange={(slug) => switchTenant(slug)}
            >
              <SelectTrigger
                aria-label="Chuyển đổi đơn vị hành chính vận hành"
                size="sm"
                className="h-7 w-full border-slate-700 bg-[#0F172A] text-[11px] text-slate-200"
              >
                <SelectValue placeholder="Chọn đơn vị xã/phường" />
              </SelectTrigger>
              <SelectContent>
                {availableTenants.map((t) => (
                  <SelectItem key={t.slug} value={t.slug} className="text-xs">
                    {t.commune_name} ({t.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Department Workspace Selector */}
      <div className="px-3.5 pt-3 pb-2">
        <div className="flex items-center justify-between px-1 pb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            KHÔNG GIAN LÀM VIỆC
          </p>
          {deptLocked && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300">
              <Lock className="h-2.5 w-2.5" />
              Khóa theo phòng
            </span>
          )}
        </div>
        <div className="rounded-lg border border-slate-700/80 bg-[#1E293B] p-2.5 space-y-2">
          <Select
            value={currentDept.id}
            onValueChange={handleDepartmentChange}
            disabled={deptLocked}
          >
            <SelectTrigger
              aria-label="Chọn không gian phòng chuyên môn"
              className="h-8 w-full border-slate-600 bg-[#0F172A] text-xs font-medium text-slate-100 focus:ring-blue-500 disabled:opacity-80"
            >
              <SelectValue placeholder="Chọn phòng ban" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id} className="text-xs">
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {deptLocked && (
            <p className="rounded bg-amber-500/15 border border-amber-500/30 px-2 py-1 text-[10.5px] font-medium text-amber-200">
              Đã khóa theo phân quyền phòng ({currentUser.department_id})
            </p>
          )}

          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-5 shrink-0 items-center rounded bg-blue-600/25 px-1.5 text-[10px] font-bold text-blue-300">
              {currentDept.code}
            </span>
            <p className="text-[11px] leading-snug text-slate-300 line-clamp-2">
              {currentDept.scope_summary}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {NAV_ITEMS.filter((i) => i.group === "core").map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item);
          return (
            <Link
              key={item.id}
              to={buildHref(item.pathname, item.tab)}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-2.5 pb-1 px-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Cập nhật văn bản
          </p>
        </div>

        {NAV_ITEMS.filter((i) => i.group === "doc_request").map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item);
          return (
            <Link
              key={item.id}
              to={buildHref(item.pathname, item.tab)}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "bg-blue-600/90 text-white"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-85" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        {showM07Admin && (
          <>
            <div className="pt-2.5 pb-1 px-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Quản trị hệ thống (Mô-đun 07)
              </p>
            </div>

            {NAV_ITEMS.filter((i) => i.group === "m07_admin").map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item);
              return (
                <Link
                  key={item.id}
                  to={buildHref(item.pathname, item.tab)}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
                    active
                      ? "bg-blue-600/90 text-white"
                      : "text-slate-300 hover:bg-slate-800/70 hover:text-white",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-85" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Active Account / Role Switcher Footer */}
      <div className="border-t border-slate-800 p-3 space-y-2 bg-[#0B1220]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {currentUser.email.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-100 truncate">
              {currentUser.email}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {currentUser.role === "owner"
                ? "Chủ sở hữu · Toàn quyền"
                : `Cán bộ phòng ${currentUser.department_id}`}
            </p>
          </div>
        </div>
        {users.length > 0 && (
          <Select value={currentUser.email} onValueChange={handleActorSwitch}>
            <SelectTrigger
              aria-label="Chuyển tài khoản phiên làm việc"
              size="sm"
              className="h-7 w-full border-slate-700 bg-slate-900 text-[11px] text-slate-300"
            >
              <SelectValue placeholder="Đổi tài khoản làm việc" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.email} value={u.email} className="text-xs">
                  {u.email} ({u.role === "owner" ? "Chủ sở hữu" : u.department_id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-[#F1F5F9] text-slate-900">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-[268px] shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 lg:px-7">
          <div className="flex items-center gap-3 min-w-0">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden shrink-0">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[268px] border-r-0">
                {sidebarContent}
              </SheetContent>
            </Sheet>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-blue-700 truncate">
                  {communeName}
                </p>
                {isClonedTenant && (
                  <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">
                    Bản nhân bản độc lập
                  </Badge>
                )}
                {deptLocked && (
                  <Badge
                    variant="outline"
                    className="hidden sm:inline-flex border-amber-300 bg-amber-50 text-amber-800 text-[10px] px-1.5 py-0"
                  >
                    Phòng {currentUser.department_id}
                  </Badge>
                )}
              </div>
              <h1 className="text-base lg:text-lg font-bold text-slate-900 truncate">
                {currentDept.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isClonedTenant && showM07Admin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => switchTenant("default")}
                className="hidden md:inline-flex gap-1.5 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Quay về đơn vị gốc
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex gap-1.5 border-slate-300 text-slate-700"
              onClick={() => navigate(buildHref("/xu-ly-tai-lieu"))}
            >
              <Upload className="h-3.5 w-3.5" />
              Tải tài liệu tham khảo
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              onClick={() => navigate(buildHref("/soan-thao-kiem-tra"))}
            >
              <Plus className="h-3.5 w-3.5" />
              Kiểm tra văn bản
            </Button>
          </div>
        </header>

        {/* Active Module Workspace */}
        <main className="flex-1 p-4 lg:p-6 min-w-0">
          <Outlet context={outletContext} />
        </main>

        {/* Verbatim Legal Accountability Footer */}
        <footer className="border-t border-slate-200 bg-white/90 px-4 lg:px-7 py-2.5 text-center text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Nguyên tắc sử dụng: </span>
          {LEGAL_DISCLAIMER_TEXT}
        </footer>
      </div>
    </div>
  );
}
