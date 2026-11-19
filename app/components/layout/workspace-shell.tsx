import { useEffect, useState, ViewTransition } from "react";
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
  MessageSquareText,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { CivicCrest } from "~/components/workspace/civic-crest";
import { cn } from "~/lib/utils";

interface NavItemConfig {
  id: string;
  label: string;
  pathname: string;
  tab?: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  group: "core" | "doc_request" | "m07_admin";
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    id: "m01",
    label: "Tư vấn công việc",
    pathname: "/",
    icon: MessageSquareText,
    group: "core",
  },
  {
    id: "m02",
    label: "Kiến thức mở rộng",
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

    const matchedInTenant = users.find(
      (u) => u.email.toLowerCase() === activeEmail.toLowerCase(),
    );
    if (!matchedInTenant && users.length > 0) {
      activeEmail = users[0].email;
      setActiveActorEmail(activeEmail);
    }

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
      scope_summary:
        "Tổng hợp, văn thư, tư pháp - hộ tịch, tiếp công dân và kiểm soát TTHC",
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

  function renderNavLink(item: NavItemConfig, variant: "desktop" | "mobile") {
    const Icon = item.icon;
    const active = isItemActive(item);
    return (
      <Link
        key={item.id}
        to={buildHref(item.pathname, item.tab)}
        viewTransition
        aria-current={active ? "page" : undefined}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "relative flex min-h-[40px] items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80",
          active
            ? "bg-[#1B4D89] text-white shadow-2xs"
            : "text-slate-300 hover:bg-[#152C4A] hover:text-white",
        )}
      >
        {active &&
          (variant === "desktop" ? (
            <ViewTransition
              name="sidebar-active-pill"
              share="nav-active-pill"
              default="none"
            >
              <span
                aria-hidden="true"
                className="absolute left-0 inset-y-1.5 w-1 rounded-r-full bg-[#F59E0B]"
              />
            </ViewTransition>
          ) : (
            <span
              aria-hidden="true"
              className="absolute left-0 inset-y-1.5 w-1 rounded-r-full bg-[#F59E0B]"
            />
          ))}
        <Icon aria-hidden="true" className="relative z-10 h-4 w-4 shrink-0" />
        <span className="relative z-10 truncate">{item.label}</span>
      </Link>
    );
  }

  function renderSidebar(variant: "desktop" | "mobile") {
    return (
      <div className="flex h-full w-[272px] flex-col bg-[#0C1E35] border-t-2 border-t-[#D97706] text-slate-100 select-none">
        {/* Brand + Commune Operating Header */}
        <div className="px-4 pt-4 pb-3.5 border-b border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <CivicCrest />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold tracking-tight text-white truncate">
                Trợ lý AI Hành chính
              </p>
              <p
                className="text-xs text-amber-200/95 font-medium truncate"
                title={communeName}
              >
                {communeName}
              </p>
            </div>
            {variant === "mobile" && (
              <SheetClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Đóng trình đơn điều hướng"
                  className="h-11 w-11 shrink-0 text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              </SheetClose>
            )}
          </div>

          {/* Active Tenant Switcher */}
          <div className="rounded-lg border border-white/10 bg-[#091628] px-2.5 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-200 truncate">
                <Building2 aria-hidden="true" className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                {isClonedTenant
                  ? `Đơn vị độc lập (${activeTenantSlug})`
                  : "Đơn vị trung tâm"}
              </span>
              {isClonedTenant && showM07Admin && (
                <button
                  type="button"
                  onClick={() => switchTenant("default")}
                  className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-200 hover:bg-amber-500/30 whitespace-nowrap"
                >
                  <RotateCcw aria-hidden="true" className="h-2.5 w-2.5" />
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
                  className="h-8 w-full border-white/15 bg-[#0C1E35] text-xs text-slate-100"
                >
                  <SelectValue placeholder="Chọn đơn vị xã, phường…" />
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
            <p className="text-[11px] font-semibold text-slate-300">
              Phòng chuyên môn
            </p>
            {deptLocked && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-amber-300">
                <Lock aria-hidden="true" className="h-2.5 w-2.5" />
                Khóa theo phòng
              </span>
            )}
          </div>
          <div className="rounded-lg border border-white/12 bg-[#132946] p-2.5 space-y-2">
            <Select
              value={currentDept.id}
              onValueChange={handleDepartmentChange}
              disabled={deptLocked}
            >
              <SelectTrigger
                aria-label="Chọn không gian phòng chuyên môn"
                className="h-9 w-full border-white/15 bg-[#0C1E35] text-xs font-medium text-slate-100 disabled:opacity-80"
              >
                <SelectValue placeholder="Chọn phòng ban…" />
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
              <p className="rounded bg-amber-500/15 border border-amber-400/30 px-2 py-1 text-[10.5px] font-medium text-amber-200">
                Giới hạn theo phân quyền phòng ({currentUser.department_id})
              </p>
            )}

            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-5 shrink-0 items-center rounded bg-[#1B4D89] px-1.5 text-[10px] font-bold text-white">
                {currentDept.code}
              </span>
              <p className="text-[11px] leading-snug text-slate-300 line-clamp-2">
                {currentDept.scope_summary}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav
          aria-label="Danh mục phân hệ nghiệp vụ"
          className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
        >
          {NAV_ITEMS.filter((i) => i.group === "core").map((item) =>
            renderNavLink(item, variant),
          )}

          <div className="pt-3 pb-1 px-2">
            <p className="text-[11px] font-semibold text-slate-400">
              Nguồn pháp quy
            </p>
          </div>

          {NAV_ITEMS.filter((i) => i.group === "doc_request").map((item) =>
            renderNavLink(item, variant),
          )}

          {showM07Admin && (
            <>
              <div className="pt-3 pb-1 px-2">
                <p className="text-[11px] font-semibold text-slate-400">
                  Quản trị hệ thống
                </p>
              </div>

              {NAV_ITEMS.filter((i) => i.group === "m07_admin").map((item) =>
                renderNavLink(item, variant),
              )}
            </>
          )}
        </nav>

        {/* Active Account / Role Switcher Footer */}
        <div className="border-t border-white/10 p-3 space-y-2 bg-[#081322]">
          <div className="flex items-center gap-2.5">
            <div
              aria-hidden="true"
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                currentUser.role === "owner" ? "bg-[#B45309]" : "bg-[#1B4D89]",
              )}
            >
              {currentUser.email.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-100 truncate" translate="no">
                {currentUser.email}
              </p>
              <p className="text-[11px] text-slate-300 truncate">
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
                className="h-8 w-full border-white/15 bg-[#0C1E35] text-xs text-slate-200"
              >
                <SelectValue placeholder="Đổi tài khoản làm việc…" />
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
  }

  return (
    <div className="flex min-h-screen w-full bg-[#F6F7F9] text-slate-900">
      {/* Keyboard Skip Link */}
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-[#0C1E35] focus:px-4 focus:py-2.5 focus:text-xs focus:font-semibold focus:text-white focus:shadow-lg focus:ring-2 focus:ring-[#D97706]"
      >
        Chuyển tới nội dung chính
      </a>

      {/* Desktop Fixed Sidebar */}
      <aside
        style={{ viewTransitionName: "persistent-nav" }}
        className="hidden lg:block w-[272px] shrink-0 sticky top-0 h-screen"
      >
        {renderSidebar("desktop")}
      </aside>

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between gap-3 border-b border-slate-200/90 bg-white/95 backdrop-blur-xs px-4 lg:px-7">
          <div className="flex items-center gap-3 min-w-0">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Mở trình đơn điều hướng"
                  className="lg:hidden h-10 w-10 shrink-0 border-slate-300"
                >
                  <Menu aria-hidden="true" className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                showCloseButton={false}
                className="p-0 w-[272px] border-r-0 overscroll-contain"
              >
                <SheetTitle className="sr-only">
                  Trình đơn điều hướng Bộ Trợ lý AI UBND
                </SheetTitle>
                {renderSidebar("mobile")}
              </SheetContent>
            </Sheet>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-semibold text-[#1B4D89] truncate">
                  {communeName}
                </p>
                {isClonedTenant && (
                  <Badge className="bg-emerald-700 text-white text-[10.5px] px-1.5 py-0">
                    Bản độc lập
                  </Badge>
                )}
                {deptLocked && (
                  <Badge
                    variant="outline"
                    className="hidden sm:inline-flex border-amber-300 bg-amber-50 text-amber-900 text-[10.5px] px-1.5 py-0"
                  >
                    Phòng {currentUser.department_id}
                  </Badge>
                )}
              </div>
              <h1 className="text-base lg:text-lg font-bold tracking-tight text-slate-900 truncate">
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
                <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                Quay về đơn vị gốc
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
              onClick={() => navigate(buildHref("/xu-ly-tai-lieu"))}
            >
              <Upload aria-hidden="true" className="h-3.5 w-3.5" />
              Tải tài liệu phiên
            </Button>
            <Button
              size="sm"
              className="bg-[#1B4D89] hover:bg-[#153E70] text-white gap-1.5"
              onClick={() => navigate(buildHref("/soan-thao-kiem-tra"))}
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              Soạn & kiểm tra NĐ30
            </Button>
          </div>
        </header>

        {/* Active Module Workspace */}
        <main
          id="main-workspace"
          tabIndex={-1}
          className="flex-1 p-4 lg:p-6 min-w-0 scroll-mt-20 focus:outline-none"
        >
          <Outlet context={outletContext} />
        </main>

        {/* Verbatim Legal Accountability Footer */}
        <footer className="border-t border-slate-200 bg-white px-4 lg:px-7 py-2.5 text-center text-xs text-slate-600">
          <span className="font-semibold text-slate-900">Nguyên tắc sử dụng: </span>
          {LEGAL_DISCLAIMER_TEXT}
        </footer>
      </div>
    </div>
  );
}
