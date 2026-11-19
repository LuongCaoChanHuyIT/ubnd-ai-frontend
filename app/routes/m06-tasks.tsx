import { useEffect, useState } from "react";
import {
  useOutletContext,
  useRevalidator,
  useSearchParams,
} from "react-router";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Clock,
  Lock,
  Plus,
  TrendingUp,
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
  formatPriorityLabel,
  formatTaskStatusLabel,
  resolveDefaultM06FilterDept,
} from "~/lib/m06-m07-helpers";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
  const deptId = isOwner
    ? rawDept
    : (outlet?.currentUser?.department_id ?? rawDept);

  const [createOpen, setCreateOpen] = useState(false);
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
      setCreateOpen(true);

      const cleaned = new URLSearchParams(searchParams);
      cleaned.delete("newTask");
      cleaned.delete("title");
      cleaned.delete("desc");
      cleaned.delete("ref");
      setSearchParams(cleaned, { replace: true });
    }
  }, [deptId, searchParams, setSearchParams]);

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

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            MÔ-ĐUN 06 · ĐIỀU HÀNH & THEO DÕI NHIỆM VỤ (
            {activeFilter === "ALL" ? "TOÀN UBND" : `PHÒNG ${activeFilter}`})
          </p>
          <h2 className="text-xl font-bold text-slate-900">
            Giao việc, nhắc việc và tổng hợp tiến độ các bộ phận chuyên môn
          </h2>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
              <Plus className="h-4 w-4" />
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
                <label className="block text-xs font-semibold text-slate-700">
                  Tên nhiệm vụ cần thực hiện
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tiêu đề nhiệm vụ cụ thể..."
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Yêu cầu chi tiết & Sản phẩm đầu ra
                </label>
                <Textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả rõ kết quả cần trình hoặc hồ sơ cần xác minh..."
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
                    <SelectTrigger className="w-full min-w-0">
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
                    <SelectTrigger className="w-full min-w-0">
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
                  <label className="block text-xs font-semibold text-slate-700">
                    Cán bộ phụ trách thực hiện
                  </label>
                  <Input
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    placeholder="Họ và tên cán bộ..."
                    required
                  />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <label className="block text-xs font-semibold text-slate-700">
                    Hạn hoàn thành
                  </label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Số hiệu văn bản / Nguồn căn cứ giao việc
                </label>
                <Input
                  value={refDoc}
                  onChange={(e) => setRefDoc(e.target.value)}
                  placeholder="VD: 399/2026/NĐ-CP hoặc Dự thảo Kế hoạch..."
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
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {busy ? "Đang lưu..." : "Xác nhận giao việc"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 4 KPI Summary Cards matching 100% the currently displayed dataset */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-slate-500">
              Tổng nhiệm vụ hiển thị
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-extrabold text-slate-900">{kpis.total}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-slate-500">
              Đang thực hiện
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-extrabold text-indigo-700">
              {kpis.in_progress}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-slate-500">
              Sắp đến hạn / Cần đôn đốc
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-extrabold text-amber-600">
              {kpis.due_soon}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-slate-500">
              Đã hoàn thành
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-extrabold text-emerald-700">
              {kpis.completed}
            </p>
          </CardContent>
        </Card>
      </div>

      {feedback && (
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
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            {feedback.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Filter Pills + Tasks Table */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="pt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {isOwner ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={activeFilter === deptId ? "default" : "outline"}
                  onClick={() => setDeptFilter(deptId)}
                  className="text-xs h-8 whitespace-nowrap"
                >
                  Phòng hiện tại ({deptId})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeFilter === "ALL" ? "default" : "outline"}
                  onClick={() => setDeptFilter("ALL")}
                  className="text-xs h-8 whitespace-nowrap"
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
                      className="text-xs h-8 whitespace-nowrap"
                    >
                      Phòng {item.label}
                    </Button>
                  ))}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
                <Lock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                Phòng {deptId} · Đã khóa theo phân quyền phòng
              </div>
            )}

            <span className="text-xs text-slate-500">
              Hiển thị <strong>{tasks.length}</strong> nhiệm vụ
            </span>
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
                {tasks.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-xs text-slate-500 whitespace-normal"
                    >
                      Chưa có nhiệm vụ nào trong phạm vi bộ phận đang chọn.
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((t) => (
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
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {t.description}
                          </p>
                        )}
                        {t.ref_doc_number && (
                          <p className="text-[11px] text-blue-600 mt-0.5">
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
                        <p className="text-[11px] text-slate-500">
                          Hạn: {t.due_date}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap align-top">
                        <div className="space-y-1 min-w-[125px]">
                          <div className="flex items-center justify-between text-[11px] gap-2">
                            <span className="font-medium text-slate-700">
                              {formatTaskStatusLabel(t.status)}
                            </span>
                            <span className="font-bold text-blue-700">
                              {t.progress}%
                            </span>
                          </div>
                          <Progress value={t.progress} className="h-1.5" />
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
                              className="h-7 px-2 text-[11px] whitespace-nowrap"
                            >
                              +25%
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => void handlePatchTask(t, { remind: true })}
                            className="h-7 px-2 text-[11px] gap-1 text-amber-700 border-amber-200 hover:bg-amber-50 whitespace-nowrap"
                          >
                            <BellRing className="h-3 w-3" />
                            Nhắc ({t.reminder_count})
                          </Button>
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
