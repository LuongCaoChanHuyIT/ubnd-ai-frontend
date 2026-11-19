import { useEffect, useState } from "react";
import {
  Form,
  useOutletContext,
  useRevalidator,
  useSearchParams,
} from "react-router";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Eye,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  XCircle,
} from "lucide-react";
import type { Route } from "./+types/m04-official-docs";
import {
  ApiError,
  apiRequest,
  extractServerAuthHeaders,
  normalizeDepartmentId,
  resolveServerApiBase,
  type DocTier,
  type DocUpdateRequest,
  type DocUpdateReviewResponse,
  type OfficialDoc,
  type WorkspaceOutletContext,
} from "~/lib/api";
import { formatTierLabel } from "~/lib/m03-m05-helpers";
import { normalizeM04Tab } from "~/lib/m06-m07-helpers";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Mô-đun 04 · Nguồn văn bản chính thức — UBND Xã, Phường" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const deptId = normalizeDepartmentId(url.searchParams.get("dept"));
  const q = url.searchParams.get("q") ?? "";
  const tier = url.searchParams.get("tier") ?? "";
  const baseUrl = resolveServerApiBase();
  const headers = extractServerAuthHeaders(request);

  try {
    const params = new URLSearchParams();
    params.set("department_id", deptId);
    if (q) params.set("q", q);
    if (tier) params.set("tier", tier);

    const [docRes, reqRes] = await Promise.all([
      apiRequest<{ documents: OfficialDoc[] }>(
        `/api/m04/documents?${params.toString()}`,
        { baseUrl, headers },
      ),
      apiRequest<{ requests: DocUpdateRequest[] }>("/api/m04/update-requests", {
        baseUrl,
        headers,
      }),
    ]);

    return {
      deptId,
      q,
      tier,
      documents: docRes.documents,
      updateRequests: reqRes.requests,
      loaderError: null as string | null,
    };
  } catch (err) {
    return {
      deptId,
      q,
      tier,
      documents: [] as OfficialDoc[],
      updateRequests: [] as DocUpdateRequest[],
      loaderError:
        err instanceof ApiError
          ? err.message
          : null,
    };
  }
}

export default function Module04OfficialDocsRoute({
  loaderData,
}: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const outlet = useOutletContext<WorkspaceOutletContext | undefined>();

  const rawDept = normalizeDepartmentId(
    searchParams.get("dept") ?? loaderData.deptId,
  );
  const deptId =
    outlet?.currentUser?.role === "officer"
      ? outlet.currentUser.department_id
      : rawDept;

  const isOwner = (outlet?.currentUser?.role ?? "owner") === "owner";
  const hasPrivateRepoAccess =
    isOwner || Boolean(outlet?.currentUser?.private_repo_access ?? true);

  const activeTab = normalizeM04Tab(searchParams.get("tab"));

  const [selectedDoc, setSelectedDoc] = useState<OfficialDoc | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [docNumber, setDocNumber] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docTier, setDocTier] = useState<DocTier>("kho_rieng");
  const [docContent, setDocContent] = useState("");
  const [busyAdd, setBusyAdd] = useState(false);

  const [reqNumber, setReqNumber] = useState("");
  const [reqTitle, setReqTitle] = useState("");
  const [reqTier, setReqTier] = useState<DocTier>("trung_uong");
  const [reqReason, setReqReason] = useState("");
  const [busyReq, setBusyReq] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isOwner) {
      setDocTier("kho_rieng");
    }
  }, [isOwner]);

  useEffect(() => {
    if (loaderData.q && loaderData.documents.length === 1) {
      setSelectedDoc(loaderData.documents[0]);
    }
  }, [loaderData.q, loaderData.documents]);

  function setTabParam(nextTab: string) {
    const normalized = normalizeM04Tab(nextTab);
    const next = new URLSearchParams(searchParams);
    next.set("dept", deptId);
    if (normalized === "de_nghi") next.set("tab", "de_nghi");
    else next.delete("tab");
    setSearchParams(next);
  }

  function setTierFilter(nextTier: string) {
    const next = new URLSearchParams(searchParams);
    next.set("dept", deptId);
    if (nextTier === "all") next.delete("tier");
    else next.set("tier", nextTier);
    setSearchParams(next);
  }

  async function handleCreateDoc(ev: React.FormEvent) {
    ev.preventDefault();
    if (!docNumber.trim() || !docTitle.trim() || !docContent.trim()) return;
    setBusyAdd(true);
    setFeedback(null);
    try {
      await apiRequest("/api/m04/documents", {
        method: "POST",
        body: {
          doc_number: docNumber.trim(),
          title: docTitle.trim(),
          doc_type: "Văn bản nội bộ",
          tier: isOwner ? docTier : "kho_rieng",
          department_id:
            (isOwner ? docTier : "kho_rieng") === "kho_rieng" ? deptId : "ALL",
          issuer: `UBND (${deptId})`,
          issued_date: "2026-11-18",
          summary: docContent.trim().slice(0, 180),
          content: docContent.trim(),
        },
      });
      setDocNumber("");
      setDocTitle("");
      setDocContent("");
      setAddOpen(false);
      setFeedback({
        tone: "ok",
        text: "Đã bổ sung văn bản mới vào kho dữ liệu thành công.",
      });
      revalidator.revalidate();
    } catch (err) {
      setFeedback({
        tone: "err",
        text: err instanceof Error ? err.message : "Không thể thêm văn bản",
      });
    } finally {
      setBusyAdd(false);
    }
  }

  async function handleSubmitUpdateRequest(ev: React.FormEvent) {
    ev.preventDefault();
    if (!reqNumber.trim() || !reqTitle.trim() || !reqReason.trim()) return;
    setBusyReq(true);
    setFeedback(null);
    try {
      await apiRequest("/api/m04/update-requests", {
        method: "POST",
        body: {
          doc_number: reqNumber.trim(),
          title: reqTitle.trim(),
          tier: reqTier,
          department_id: deptId,
          reason: reqReason.trim(),
        },
      });
      setReqNumber("");
      setReqTitle("");
      setReqReason("");
      setFeedback({
        tone: "ok",
        text: "Đã gửi đề nghị cập nhật văn bản thành công; đang chờ Chủ sở hữu phê duyệt.",
      });
      revalidator.revalidate();
    } catch (err) {
      setFeedback({
        tone: "err",
        text: err instanceof Error ? err.message : "Không thể gửi đề nghị",
      });
    } finally {
      setBusyReq(false);
    }
  }

  async function handleReviewRequest(
    reqItem: DocUpdateRequest,
    decision: "da_duyet" | "tu_choi",
  ) {
    setReviewingId(reqItem.id);
    setFeedback(null);
    try {
      await apiRequest<DocUpdateReviewResponse>(
        `/api/m04/update-requests/${reqItem.id}/review`,
        {
          method: "PATCH",
          body:
            decision === "da_duyet"
              ? {
                  status: "da_duyet",
                  issuer:
                    reqItem.tier === "trung_uong"
                      ? "Cơ quan Trung ương"
                      : `UBND (${reqItem.department_id})`,
                  issued_date: "2026-11-18",
                  doc_type: "Văn bản cập nhật",
                  summary: reqItem.reason,
                  content: `${reqItem.title}. Nội dung cập nhật theo đề nghị của phòng ${reqItem.department_id}: ${reqItem.reason}`,
                }
              : {
                  status: "tu_choi",
                },
        },
      );
      setFeedback({
        tone: "ok",
        text:
          decision === "da_duyet"
            ? `Đã phê duyệt đề nghị '${reqItem.doc_number}' và tự động nhập kho văn bản chính thức.`
            : `Đã từ chối đề nghị cập nhật '${reqItem.doc_number}'.`,
      });
      revalidator.revalidate();
    } catch (err) {
      setFeedback({
        tone: "err",
        text:
          err instanceof Error
            ? err.message
            : "Không thể xử lý phê duyệt đề nghị cập nhật",
      });
    } finally {
      setReviewingId(null);
    }
  }

  function renderRequestStatusBadge(r: DocUpdateRequest) {
    if (r.status === "da_duyet") {
      return (
        <Badge className="bg-emerald-600 text-white text-[10px] whitespace-nowrap">
          Đã duyệt & Nhập kho · {r.department_id}
        </Badge>
      );
    }
    if (r.status === "tu_choi") {
      return (
        <Badge
          variant="outline"
          className="border-rose-300 bg-rose-50 text-rose-700 text-[10px] whitespace-nowrap"
        >
          Đã từ chối · {r.department_id}
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-50 text-amber-800 text-[10px] whitespace-nowrap"
      >
        Chờ duyệt · {r.department_id}
      </Badge>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            MÔ-ĐUN 04 · KHO PHÁP LÝ & DỮ LIỆU ĐƠN VỊ ({deptId})
          </p>
          <h2 className="text-xl font-bold text-slate-900">
            Nguồn văn bản chính thức & Kho dữ liệu riêng theo phân quyền
          </h2>
        </div>

        {hasPrivateRepoAccess && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                <Plus className="h-4 w-4" />
                {isOwner
                  ? "Bổ sung văn bản vào kho"
                  : `Bổ sung vào Kho riêng (${deptId})`}
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Bổ sung văn bản vào kho ({deptId})</DialogTitle>
              <DialogDescription>
                {isOwner
                  ? `Quản trị viên có thể bổ sung trực tiếp văn bản Trung ương, Địa phương hoặc Kho dữ liệu riêng phòng ${deptId}.`
                  : `Cán bộ chuyên môn bổ sung tài liệu vào Kho dữ liệu riêng của phòng ${deptId}; với văn bản Trung ương/Địa phương vui lòng gửi Đề nghị cập nhật.`}
              </DialogDescription>
            </DialogHeader>

            {!hasPrivateRepoAccess ? (
              <div className="space-y-3">
                <Alert variant="destructive">
                  <Lock className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Tài khoản hiện tại không được cấp quyền ghi vào Kho dữ liệu
                    riêng của phòng {deptId}. Vui lòng chuyển sang tab{" "}
                    <strong>Đề nghị cập nhật văn bản</strong> để gửi yêu cầu tới Quản
                    trị viên.
                  </AlertDescription>
                </Alert>
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={() => {
                      setAddOpen(false);
                      setTabParam("de_nghi");
                    }}
                  >
                    Mở tab Đề nghị cập nhật
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleCreateDoc} className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Số hiệu văn bản
                  </label>
                  <Input
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder="VD: QC-05/2026/UBND-VP"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Trích yếu văn bản
                  </label>
                  <Input
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="Trích yếu văn bản..."
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Phân tầng nguồn kho
                  </label>
                  <Select
                    value={isOwner ? docTier : "kho_rieng"}
                    onValueChange={(v) => setDocTier(v as DocTier)}
                    disabled={!isOwner}
                  >
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kho_rieng">
                        Kho dữ liệu riêng phòng {deptId}
                      </SelectItem>
                      {isOwner && (
                        <>
                          <SelectItem value="dia_phuong">
                            Văn bản Địa phương (Toàn UBND)
                          </SelectItem>
                          <SelectItem value="trung_uong">
                            Văn bản Trung ương (Toàn UBND)
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nội dung trích lục phục vụ tra cứu AI
                  </label>
                  <Textarea
                    rows={4}
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    placeholder="Nội dung điều khoản cốt lõi phục vụ AI tra cứu..."
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busyAdd}>
                    {busyAdd ? "Đang lưu..." : "Lưu văn bản"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
        )}
      </div>

      {!hasPrivateRepoAccess && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950 py-2.5">
          <Lock className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-xs">
            Tài khoản cán bộ hiện tại đang bị giới hạn quyền truy cập{" "}
            <strong>Kho dữ liệu riêng</strong> của phòng {deptId} — danh mục chỉ hiển
            thị văn bản Trung ương và Địa phương dùng chung.
          </AlertDescription>
        </Alert>
      )}

      {loaderData.loaderError && (
        <Alert variant="destructive" className="py-2.5">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {loaderData.loaderError}
          </AlertDescription>
        </Alert>
      )}

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

      <Tabs value={activeTab} onValueChange={setTabParam}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="danh_muc" className="gap-1.5 text-xs sm:text-sm">
            <BookOpen className="h-3.5 w-3.5" />
            Danh mục văn bản ({loaderData.documents.length})
          </TabsTrigger>
          <TabsTrigger value="de_nghi" className="gap-1.5 text-xs sm:text-sm">
            <RefreshCw className="h-3.5 w-3.5" />
            Đề nghị cập nhật văn bản ({loaderData.updateRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="danh_muc" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="pt-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <Form method="get" className="flex flex-1 gap-2 min-w-0">
                  <input type="hidden" name="dept" value={deptId} />
                  {loaderData.tier && (
                    <input type="hidden" name="tier" value={loaderData.tier} />
                  )}
                  <Input
                    name="q"
                    defaultValue={loaderData.q}
                    placeholder="Tìm theo số hiệu (VD: 30/2020/NĐ-CP, 399/2026/NĐ-CP) hoặc trích yếu..."
                    className="flex-1 min-w-0"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    className="gap-1.5 whitespace-nowrap"
                  >
                    <Search className="h-4 w-4" />
                    Tra cứu
                  </Button>
                </Form>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "all", label: "Tất cả nguồn" },
                    { id: "trung_uong", label: "Trung ương" },
                    { id: "dia_phuong", label: "Địa phương" },
                    { id: "kho_rieng", label: `Kho riêng (${deptId})` },
                  ].map((t) => (
                    <Button
                      key={t.id}
                      type="button"
                      size="sm"
                      variant={
                        (loaderData.tier || "all") === t.id ? "default" : "outline"
                      }
                      onClick={() => setTierFilter(t.id)}
                      className="text-xs h-8 whitespace-nowrap"
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-[140px]">Số hiệu</TableHead>
                      <TableHead>Trích yếu & Tóm tắt</TableHead>
                      <TableHead className="w-[145px]">Nguồn kho</TableHead>
                      <TableHead className="w-[110px]">Phạm vi</TableHead>
                      <TableHead className="w-[90px] text-right">Chi tiết</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loaderData.documents.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-8 text-center text-xs text-slate-500 whitespace-normal"
                        >
                          Không tìm thấy văn bản nào khớp với bộ lọc hiện tại.
                        </TableCell>
                      </TableRow>
                    ) : (
                      loaderData.documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-semibold text-blue-700 text-xs whitespace-nowrap align-top">
                            {doc.doc_number}
                            <div className="text-[11px] font-normal text-slate-400">
                              {doc.issued_date}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-normal min-w-[240px] align-top">
                            <p className="font-semibold text-xs text-slate-900">
                              {doc.title}
                            </p>
                            <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                              {doc.summary}
                            </p>
                          </TableCell>
                          <TableCell className="whitespace-nowrap align-top">
                            <Badge
                              variant="outline"
                              className={
                                doc.tier === "kho_rieng"
                                  ? "border-amber-300 bg-amber-50 text-amber-800 text-[11px]"
                                  : "border-blue-200 bg-blue-50 text-blue-700 text-[11px]"
                              }
                            >
                              {formatTierLabel(doc.tier)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap align-top">
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                              <Shield className="h-3 w-3 text-slate-400 shrink-0" />
                              {doc.department_id === "ALL"
                                ? "Toàn UBND"
                                : `Phòng ${doc.department_id}`}
                            </span>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap align-top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedDoc(doc)}
                              className="h-7 px-2 text-xs gap-1 whitespace-nowrap"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Xem
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="de_nghi"
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-3"
        >
          <Card className="lg:col-span-5 border-slate-200 shadow-xs h-fit">
            <CardHeader>
              <CardTitle className="text-base">
                Gửi đề nghị cập nhật văn bản mới
              </CardTitle>
              <CardDescription className="text-xs">
                Khi phát hiện văn bản mới ban hành hoặc hết hiệu lực, cán bộ gửi đề
                nghị để Quản trị viên phê duyệt và nhập vào nguồn chính thức.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitUpdateRequest} className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Số hiệu văn bản đề nghị
                  </label>
                  <Input
                    value={reqNumber}
                    onChange={(e) => setReqNumber(e.target.value)}
                    placeholder="VD: 12/2026/TT-BNV"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Tên / Trích yếu văn bản
                  </label>
                  <Input
                    value={reqTitle}
                    onChange={(e) => setReqTitle(e.target.value)}
                    placeholder="Tên / Trích yếu văn bản cần cập nhật"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Phân tầng đề xuất
                  </label>
                  <Select
                    value={reqTier}
                    onValueChange={(v) => setReqTier(v as DocTier)}
                  >
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trung_uong">Văn bản Trung ương</SelectItem>
                      <SelectItem value="dia_phuong">Văn bản Địa phương</SelectItem>
                      <SelectItem value="kho_rieng">
                        Kho dữ liệu riêng ({deptId})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Lý do cập nhật / Tóm tắt điểm mới
                  </label>
                  <Textarea
                    rows={3}
                    value={reqReason}
                    onChange={(e) => setReqReason(e.target.value)}
                    placeholder="Lý do cập nhật / thay thế điều khoản nào..."
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busyReq}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {busyReq ? "Đang gửi..." : "Gửi đề nghị cập nhật"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-7 border-slate-200 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base">
                Danh sách đề nghị cập nhật đã ghi nhận ({loaderData.updateRequests.length})
              </CardTitle>
              <CardDescription className="text-xs">
                {isOwner
                  ? "Chủ sở hữu có thể Phê duyệt & Nhập kho trực tiếp hoặc Từ chối từng đề nghị."
                  : `Hiển thị các đề nghị cập nhật của bộ phận ${deptId}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loaderData.updateRequests.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Chưa có đề nghị cập nhật văn bản nào.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {loaderData.updateRequests.map((r) => {
                    const isPending = r.status === "cho_duyet";
                    const isReviewing = reviewingId === r.id;
                    return (
                      <div
                        key={r.id}
                        className="rounded-lg border border-slate-200 p-3.5 text-xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <span className="font-bold text-blue-700">
                            {r.doc_number} — {r.title}
                          </span>
                          {renderRequestStatusBadge(r)}
                        </div>
                        <p className="text-slate-600 leading-relaxed">{r.reason}</p>
                        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                          <p className="text-[11px] text-slate-400">
                            Người đề nghị: {r.requested_by} · {formatTierLabel(r.tier)}
                          </p>

                          {isOwner && isPending && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                disabled={isReviewing}
                                onClick={() => void handleReviewRequest(r, "da_duyet")}
                                className="h-7 px-2.5 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Phê duyệt & Nhập kho
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isReviewing}
                                onClick={() => void handleReviewRequest(r, "tu_choi")}
                                className="h-7 px-2.5 text-[11px] gap-1 border-rose-200 text-rose-700 hover:bg-rose-50 whitespace-nowrap"
                              >
                                <XCircle className="h-3 w-3" />
                                Từ chối
                              </Button>
                            </div>
                          )}
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

      {/* Document Preview Dialog */}
      <Dialog
        open={Boolean(selectedDoc)}
        onOpenChange={(open) => !open && setSelectedDoc(null)}
      >
        <DialogContent className="max-w-2xl">
          {selectedDoc && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedDoc.doc_number} · {selectedDoc.title}
                </DialogTitle>
                <DialogDescription>
                  Cơ quan ban hành: {selectedDoc.issuer} · Ngày ban hành:{" "}
                  {selectedDoc.issued_date} · Phạm vi: {selectedDoc.department_id}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-xs leading-relaxed text-slate-700">
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                  <p className="font-semibold text-slate-900 mb-1">Tóm tắt:</p>
                  <p>{selectedDoc.summary}</p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-slate-200 whitespace-pre-wrap max-h-[340px] overflow-y-auto">
                  <p className="font-semibold text-slate-900 mb-1">
                    Nội dung trích lục phục vụ tra cứu AI:
                  </p>
                  <p>{selectedDoc.content}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
