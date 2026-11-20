import { useDeferredValue, useEffect, useState } from "react";
import {
  useOutletContext,
  useRevalidator,
  useSearchParams,
} from "react-router";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Lock,
  Plus,
  Search,
} from "lucide-react";
import type { Route } from "./+types/m06-tasks";
import {
  apiRequest,
  extractServerAuthHeaders,
  normalizeDepartmentId,
  resolveServerApiBase,
  type DepartmentId,
  type TaskItem,
  type TasksOverview,
  type WorkspaceOutletContext,
} from "~/lib/api";
import {
  canManageDepartmentTasks,
  formatPriorityLabel,
  formatTaskStatusLabel,
  resolveDefaultM06FilterDept,
} from "~/lib/m06-m07-helpers";
import { matchesVietnameseQuery } from "~/lib/vietnamese-search";
import {
  MetricStrip,
  ModuleHeader,
} from "~/components/workspace/module-surface";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Mô-đun 06 · Điều hành công việc — UBND Xã, Phường" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const deptId = normalizeDepartmentId(url.searchParams.get("dept"));
  const rawFilter = url.searchParams.get("filterDept");
  const requestedFilter = resolveDefaultM06FilterDept(deptId, rawFilter, "owner");
  const baseUrl = resolveServerApiBase();
  const headers = extractServerAuthHeaders(request);

  try {
    const query = `?department_id=${encodeURIComponent(requestedFilter)}`;
    const overview = await apiRequest<TasksOverview>(`/api/m06/tasks${query}`, {
      baseUrl,
      headers,
    });
    const effectiveFilter = overview.effective_department ?? requestedFilter;
    return { deptId, filterDept: effectiveFilter, overview };
  } catch {
    return {
      deptId,
      filterDept: requestedFilter,
      overview: {
        kpis: { total: 0, in_progress: 0, due_soon: 0, completed: 0 },
        tasks: [],
        effective_department: requestedFilter,
      } as TasksOverview,
    };
  }
}

export default function Module06TasksRoute({ loaderData }: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const outlet = useOutletContext<WorkspaceOutletContext | undefined>();

  const rawDept = normalizeDepartmentId(
    searchParams.get("dept") ?? loaderData.deptId,
  );
  const isOwner = (outlet?.currentUser?.role ?? "owner") === "owner";
  const canAssignTasks = canManageDepartmentTasks(
    outlet?.currentUser ?? { role: "owner", can_manage_tasks: true },
  );
  const deptId = isOwner
    ? rawDept
    : (outlet?.currentUser?.department_id ?? rawDept);

  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskDept, setTaskDept] = useState<DepartmentId>(deptId);
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("2026-11-28");
  const [priority, setPriority] = useState<TaskItem["priority"]>("cao");
  const [refDoc, setRefDoc] = useState("399/2026/NĐ-CP");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    setTaskDept(deptId);
  }, [deptId]);

  // Auto-open prefilled task dialog when handed off from M01 / M03 / M05
  useEffect(() => {
    if (searchParams.get("newTask") === "1") {
      const incomingTitle = searchParams.get("title") ?? "";
      const incomingDesc = searchParams.get("desc") ?? "";
      const incomingRef = searchParams.get("ref") ?? "399/2026/NĐ-CP";

      if (incomingTitle) setTitle(incomingTitle);
      if (incomingDesc) setDescription(incomingDesc);
      if (incomingRef) setRefDoc(incomingRef);
      setTaskDept(deptId);
      if (canAssignTasks) {
        setCreateOpen(true);
      }

      const cleaned = new URLSearchParams(searchParams);
      cleaned.delete("newTask");
      cleaned.delete("title");
      cleaned.delete("desc");
      cleaned.delete("ref");
      setSearchParams(cleaned, { replace: true });
    }
  }, [canAssignTasks, deptId, searchParams, setSearchParams]);

  function setDeptFilter(nextFilter: DepartmentId | "ALL") {
    if (!isOwner) return;
    const next = new URLSearchParams(searchParams);
    next.set("dept", deptId);
    if (nextFilter === deptId) {
      next.delete("filterDept");
    } else {
      next.set("filterDept", nextFilter);
    }
    setSearchParams(next);
  }

  async function handleCreateTask(ev: React.FormEvent) {
    ev.preventDefault();
    if (!title.trim() || !assignee.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      await apiRequest("/api/m06/tasks", {
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim(),
          department_id: isOwner ? taskDept : deptId,
          assignee: assignee.trim(),
          due_date: dueDate,
          priority,
          ref_doc_number: refDoc.trim(),
        },
      });
      setTitle("");
      setDescription("");
      setAssignee("");
      setCreateOpen(false);
      setFeedback({
        tone: "ok",
        text: "Đã giao nhiệm vụ mới và cập nhật ngay vào bảng điều hành.",
      });
      revalidator.revalidate();
    } catch (err) {
      setFeedback({
        tone: "err",
        text: err instanceof Error ? err.message : "Không thể giao việc",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handlePatchTask(
    task: TaskItem,
    opts: { progress?: number; status?: TaskItem["status"]; remind?: boolean },
  ) {
    setBusy(true);
    setFeedback(null);
    try {
      await apiRequest(`/api/m06/tasks/${task.id}`, {
        method: "PATCH",
        body: opts,
      });
      if (opts.remind) {
        setFeedback({
          tone: "ok",
          text: `Đã gửi thông báo nhắc việc cho cán bộ ${task.assignee}.`,
        });
      }
      revalidator.revalidate();
    } catch (err) {
      setFeedback({
        tone: "err",
        text: err instanceof Error ? err.message : "Lỗi cập nhật tiến độ",
      });
    } finally {
      setBusy(false);
    }
  }

  const { kpis, tasks } = loaderData.overview;
  const activeFilter = isOwner ? loaderData.filterDept : deptId;
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const filteredTasks = tasks.filter((t) =>
    matchesVietnameseQuery(
      `${t.title} ${t.description} ${t.assignee} ${t.ref_doc_number} ${t.department_id}`,
      deferredSearchQuery,
    ),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModuleHeader.Root>
        <ModuleHeader.Content>
          <ModuleHeader.Eyebrow>
            Mô-đun 06 · Điều hành & Theo dõi nhiệm vụ ·{" "}
            {activeFilter === "ALL" ? "Toàn UBND" : `Phòng ${activeFilter}`}
          </ModuleHeader.Eyebrow>
          <ModuleHeader.Title>
            Giao việc, nhắc việc và tổng hợp tiến độ các bộ phận chuyên môn
          </ModuleHeader.Title>
          <ModuleHeader.Description>
            Theo dõi sát tiến độ xử lý công việc, đôn đốc nhiệm vụ sắp đến hạn và
            tiếp nhận bàn giao trực tiếp từ các phân hệ tham mưu, soạn thảo.
          </ModuleHeader.Description>
        </ModuleHeader.Content>

        <ModuleHeader.Actions>
          {canAssignTasks ? (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#1B4D89] hover:bg-[#163E70] text-white gap-1.5">
                <Plus aria-hidden="true" className="h-4 w-4" />
                Giao nhiệm vụ mới
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Giao nhiệm vụ mới cho bộ phận chuyên môn</DialogTitle>
                <DialogDescription>
                  Phân công rõ đầu mối cán bộ, thời hạn hoàn thành và số hiệu văn bản
                  hoặc hồ sơ căn cứ.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTask} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="m06-task-title"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Tên nhiệm vụ cần thực hiện
                  </label>
                  <Input
                    id="m06-task-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nhập tiêu đề nhiệm vụ cụ thể…"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="m06-task-desc"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Yêu cầu chi tiết & Sản phẩm đầu ra
                  </label>
                  <Textarea
                    id="m06-task-desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả rõ kết quả cần trình hoặc hồ sơ cần xác minh…"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5 min-w-0">
                    <label className="block text-xs font-semibold text-slate-700">
                      Bộ phận chủ trì
                    </label>
                    <Select
                      value={isOwner ? taskDept : deptId}
                      onValueChange={(v) => setTaskDept(v as DepartmentId)}
                      disabled={!isOwner}
                    >
                      <SelectTrigger
                        aria-label="Bộ phận chủ trì"
                        className="w-full min-w-0"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VP">Văn phòng HĐND & UBND (VP)</SelectItem>
                        <SelectItem value="KT">Kinh tế (KT)</SelectItem>
                        <SelectItem value="VHXH">Văn hóa - Xã hội (VHXH)</SelectItem>
                        <SelectItem value="NNMT">Nông nghiệp & Môi trường (NNMT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <label className="block text-xs font-semibold text-slate-700">
                      Mức độ ưu tiên
                    </label>
                    <Select
                      value={priority}
                      onValueChange={(v) => setPriority(v as TaskItem["priority"])}
                    >
                      <SelectTrigger
                        aria-label="Mức độ ưu tiên"
                        className="w-full min-w-0"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="thap">Thấp</SelectItem>
                        <SelectItem value="trung_binh">Trung bình</SelectItem>
                        <SelectItem value="cao">Cao</SelectItem>
                        <SelectItem value="khan">Khẩn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5 min-w-0">
                    <label
                      htmlFor="m06-task-assignee"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Cán bộ phụ trách thực hiện
                    </label>
                    <Input
                      id="m06-task-assignee"
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                      placeholder="Họ và tên cán bộ…"
                      required
                    />
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <label
                      htmlFor="m06-task-due"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Hạn hoàn thành
                    </label>
                    <Input
                      id="m06-task-due"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="m06-task-ref"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Số hiệu văn bản / Nguồn căn cứ giao việc
                  </label>
                  <Input
                    id="m06-task-ref"
                    value={refDoc}
                    onChange={(e) => setRefDoc(e.target.value)}
                    placeholder="VD: 399/2026/NĐ-CP hoặc Dự thảo Kế hoạch…"
                  />
                </div>

                <DialogFooter className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    disabled={busy}
                    className="bg-[#1B4D89] hover:bg-[#163E70] text-white"
                  >
                    {busy ? "Đang lưu…" : "Xác nhận giao việc"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-amber-900 text-xs py-1.5 px-3"
            >
              <Lock aria-hidden="true" className="h-3.5 w-3.5 mr-1.5" />
              Chế độ thực thi · Chỉ cập nhật tiến độ
            </Badge>
          )}
        </ModuleHeader.Actions>
      </ModuleHeader.Root>

      {/* 4 KPI Summary Strip matching 100% the currently displayed dataset */}
      <MetricStrip.Root>
        <MetricStrip.Item
          label="Tổng nhiệm vụ hiển thị"
          value={kpis.total}
          hint={activeFilter === "ALL" ? "Toàn bộ 4 phòng chuyên môn" : `Phạm vi phòng ${activeFilter}`}
          tone="cobalt"
        />
        <MetricStrip.Item
          label="Đang thực hiện"
          value={kpis.in_progress}
          hint="Nhiệm vụ đang triển khai"
          tone="neutral"
        />
        <MetricStrip.Item
          label="Sắp đến hạn / Cần đôn đốc"
          value={kpis.due_soon}
          hint="Ưu tiên nhắc tiến độ"
          tone="amber"
        />
        <MetricStrip.Item
          label="Đã hoàn thành"
          value={kpis.completed}
          hint="Đạt 100% khối lượng"
          tone="emerald"
        />
      </MetricStrip.Root>

      {feedback && (
        <div
          role={feedback.tone === "err" ? "alert" : "status"}
          aria-live="polite"
        >
          <Alert
            variant={feedback.tone === "err" ? "destructive" : "default"}
            className={cn(
              "py-2.5",
              feedback.tone === "ok" &&
                "border-emerald-200 bg-emerald-50 text-emerald-900",
            )}
          >
            <AlertDescription className="text-xs flex items-center gap-1.5">
              {feedback.tone === "ok" ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="h-4 w-4 text-emerald-600 shrink-0"
                />
              ) : (
                <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
              )}
              {feedback.text}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Filter Pills + Tasks Table */}
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="pt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {isOwner ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={activeFilter === deptId ? "default" : "outline"}
                  onClick={() => setDeptFilter(deptId)}
                  className={cn(
                    "text-xs h-8 whitespace-nowrap",
                    activeFilter === deptId &&
                      "bg-[#1B4D89] hover:bg-[#163E70] text-white",
                  )}
                >
                  Phòng hiện tại ({deptId})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeFilter === "ALL" ? "default" : "outline"}
                  onClick={() => setDeptFilter("ALL")}
                  className={cn(
                    "text-xs h-8 whitespace-nowrap",
                    activeFilter === "ALL" &&
                      "bg-[#1B4D89] hover:bg-[#163E70] text-white",
                  )}
                >
                  Tất cả 4 bộ phận
                </Button>
                {(
                  [
                    { id: "VP" as DepartmentId, label: "VP" },
                    { id: "KT" as DepartmentId, label: "KT" },
                    { id: "VHXH" as DepartmentId, label: "VHXH" },
                    { id: "NNMT" as DepartmentId, label: "NNMT" },
                  ] as const
                )
                  .filter((item) => item.id !== deptId)
                  .map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      size="sm"
                      variant={activeFilter === item.id ? "default" : "outline"}
                      onClick={() => setDeptFilter(item.id)}
                      className={cn(
                        "text-xs h-8 whitespace-nowrap",
                        activeFilter === item.id &&
                          "bg-[#1B4D89] hover:bg-[#163E70] text-white",
                      )}
                    >
                      Phòng {item.label}
                    </Button>
                  ))}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
                <Lock aria-hidden="true" className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                Phòng {deptId} · Đã khóa theo phân quyền phòng
              </div>
            )}

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="relative w-full sm:w-64">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
                />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm có dấu hoặc không dấu…"
                  aria-label="Tìm kiếm nhiệm vụ có dấu hoặc không dấu"
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <span className="text-xs text-slate-600 tabular-nums">
                Hiển thị <strong>{filteredTasks.length}</strong>/{tasks.length} nhiệm vụ
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Nhiệm vụ & Căn cứ</TableHead>
                  <TableHead className="w-[88px]">Bộ phận</TableHead>
                  <TableHead className="w-[155px]">Phụ trách & Hạn</TableHead>
                  <TableHead className="w-[155px]">Tiến độ</TableHead>
                  <TableHead className="w-[185px] text-right">Điều hành</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-xs text-slate-500 whitespace-normal"
                    >
                      Không có nhiệm vụ nào khớp điều kiện lọc hiện tại.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-normal min-w-[230px] align-top">
                        <div className="flex items-start gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-slate-900">
                            {t.title}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] shrink-0 whitespace-nowrap"
                          >
                            {formatPriorityLabel(t.priority)}
                          </Badge>
                        </div>
                        {t.description && (
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                            {t.description}
                          </p>
                        )}
                        {t.ref_doc_number && (
                          <p className="text-[11px] text-[#1B4D89] mt-0.5">
                            Căn cứ: {t.ref_doc_number}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap align-top">
                        <Badge variant="secondary" className="text-xs">
                          {t.department_id}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap align-top">
                        <p className="font-medium text-slate-900">{t.assignee}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          Hạn: {t.due_date}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap align-top">
                        <div className="space-y-1 min-w-[125px]">
                          <div className="flex items-center justify-between text-[11px] gap-2">
                            <span className="font-medium text-slate-700">
                              {formatTaskStatusLabel(t.status)}
                            </span>
                            <span className="font-bold text-[#1B4D89] tabular-nums">
                              {t.progress}%
                            </span>
                          </div>
                          <Progress
                            value={t.progress}
                            aria-label={`Tiến độ nhiệm vụ ${t.title}`}
                            className="h-1.5"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap align-top">
                        <div className="inline-flex items-center gap-1.5">
                          {t.progress < 100 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void handlePatchTask(t, {
                                  progress: Math.min(100, t.progress + 25),
                                })
                              }
                              className="h-7 px-2 text-[11px] whitespace-nowrap tabular-nums"
                            >
                              +25%
                            </Button>
                          )}
                          {canAssignTasks && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => void handlePatchTask(t, { remind: true })}
                              className="h-7 px-2 text-[11px] gap-1 text-amber-800 border-amber-300 hover:bg-amber-50 whitespace-nowrap tabular-nums"
                            >
                              <BellRing aria-hidden="true" className="h-3 w-3" />
                              Nhắc ({t.reminder_count})
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
