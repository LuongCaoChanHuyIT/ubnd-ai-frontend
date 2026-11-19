import { startTransition, useEffect, useState, ViewTransition } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router";
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Copy,
  Download,
  FileCheck2,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { Route } from "./+types/m03-drafting";
import {
  apiRequest,
  normalizeDepartmentId,
  type AuditReport,
  type AuthorityMode,
  type WorkspaceOutletContext,
} from "~/lib/api";
import {
  ADMIN_DOC_TYPES,
  AUTHORITY_MODES,
  applyAuthoritySignerOverride,
  buildM06TaskHandoffUrl,
  formatAuditStatusLabel,
} from "~/lib/m03-m05-helpers";
import {
  EmptyStatePanel,
  ModuleHeader,
} from "~/components/workspace/module-surface";
import { DocumentPaperSheet } from "~/components/workspace/nd30-paper";
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
import { Progress } from "~/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Mô-đun 03 · Soạn thảo & Kiểm tra văn bản — UBND Xã, Phường" }];
}

export default function Module03DraftingRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const outlet = useOutletContext<WorkspaceOutletContext | undefined>();
  const rawDept = normalizeDepartmentId(searchParams.get("dept"));
  const deptId =
    outlet?.currentUser?.role === "officer"
      ? outlet.currentUser.department_id
      : rawDept;

  const [docType, setDocType] = useState<string>(
    searchParams.get("docType") ?? "Kế hoạch",
  );
  const [authorityMode, setAuthorityMode] = useState<AuthorityMode>("auto");
  const [recipient, setRecipient] = useState<string>(
    "Các bộ phận chuyên môn trực thuộc UBND",
  );
  const [title, setTitle] = useState<string>(
    searchParams.get("title") ??
      "Triển khai chuẩn hóa giải quyết thủ tục hành chính quý IV/2026",
  );
  const [keyPoints, setKeyPoints] = useState<string>(
    searchParams.get("points") ??
      "Rà soát quy trình tiếp nhận hồ sơ tại Bộ phận Một cửa; Tăng cường số hóa hồ sơ theo Nghị định 61/2018/NĐ-CP và Nghị định 107/2021/NĐ-CP; Phân công rõ đầu mối phụ trách từng lĩnh vực",
  );
  const [draftText, setDraftText] = useState<string>("");
  const [previewVersion, setPreviewVersion] = useState<number>(0);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [busyDraft, setBusyDraft] = useState(false);
  const [busyAudit, setBusyAudit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTenantSlug = outlet?.activeTenantSlug ?? "default";
  const activeUserEmail = outlet?.currentUser?.email ?? "";

  useEffect(() => {
    setDraftText("");
    setAuditReport(null);
    setError(null);
  }, [activeTenantSlug, activeUserEmail]);

  useEffect(() => {
    const dt = searchParams.get("docType");
    const t = searchParams.get("title");
    const pts = searchParams.get("points");
    if (dt) setDocType(dt);
    if (t) setTitle(t);
    if (pts) setKeyPoints(pts);
  }, [searchParams]);

  function handleAuthorityChange(nextMode: AuthorityMode) {
    setAuthorityMode(nextMode);
    if (draftText.trim() && nextMode !== "auto") {
      setDraftText((prev) => applyAuthoritySignerOverride(prev, nextMode));
    }
  }

  async function handleGenerateDraft() {
    if (!title.trim() || busyDraft) return;
    setBusyDraft(true);
    setError(null);
    try {
      const res = await apiRequest<{ draft_text: string }>("/api/m03/draft", {
        method: "POST",
        body: {
          department_id: deptId,
          doc_type: docType,
          title: title.trim(),
          key_points: keyPoints.trim(),
          recipient: recipient.trim() || "Các bộ phận chuyên môn trực thuộc UBND",
          authority_mode: authorityMode,
        },
      });
      const finalDraft = res.draft_text;
      setDraftText(finalDraft);
      setPreviewVersion((v) => v + 1);

      const audit = await apiRequest<AuditReport>("/api/m03/audit", {
        method: "POST",
        body: {
          department_id: deptId,
          doc_type: docType,
          draft_text: finalDraft,
        },
      });
      startTransition(() => {
        setAuditReport(audit);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể sinh dự thảo");
    } finally {
      setBusyDraft(false);
    }
  }

  async function handleAuditOnly() {
    if (!draftText.trim() || busyAudit) return;
    setBusyAudit(true);
    setError(null);
    try {
      const audit = await apiRequest<AuditReport>("/api/m03/audit", {
        method: "POST",
        body: {
          department_id: deptId,
          doc_type: docType,
          draft_text: draftText,
        },
      });
      startTransition(() => {
        setAuditReport(audit);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể kiểm tra văn bản");
    } finally {
      setBusyAudit(false);
    }
  }

  async function handleCopy() {
    if (!draftText) return;
    await navigator.clipboard.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleDownload() {
    if (!draftText) return;
    const blob = new Blob([draftText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Du_thao_${docType.replace(/\s+/g, "_")}_${deptId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleHandoffToM06() {
    navigate(
      buildM06TaskHandoffUrl({
        deptId,
        title: `Triển khai ${docType}: ${title.trim()}`,
        desc: keyPoints.trim(),
        ref: `Dự thảo ${docType} (${deptId})`,
      }),
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <ModuleHeader.Root>
        <ModuleHeader.Content>
          <ModuleHeader.Eyebrow>
            Mô-đun 03 · Soạn thảo & Kiểm chuẩn thể thức · Phòng {deptId}
          </ModuleHeader.Eyebrow>
          <ModuleHeader.Title>
            Soạn mới & Chuẩn hóa theo Nghị định 30/2020/NĐ-CP
          </ModuleHeader.Title>
          <ModuleHeader.Description>
            Hình thành dự thảo văn bản hành chính trên trang giấy A4 chuẩn NĐ
            30/2020/NĐ-CP và tự động rà soát 05 tiêu chí trước khi trình ký.
          </ModuleHeader.Description>
        </ModuleHeader.Content>

        <ModuleHeader.Actions>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!draftText}
            onClick={() => void handleCopy()}
            className="gap-1.5 text-xs bg-white whitespace-nowrap"
          >
            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
            {copied ? "Đã sao chép" : "Sao chép"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!draftText}
            onClick={handleDownload}
            className="gap-1.5 text-xs bg-white whitespace-nowrap"
          >
            <Download aria-hidden="true" className="h-3.5 w-3.5" />
            Tải dự thảo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!title.trim()}
            onClick={handleHandoffToM06}
            className="gap-1.5 text-xs border-[#1B4D89]/30 bg-[#EEF4FB] text-[#1B4D89] hover:bg-[#1B4D89]/15 whitespace-nowrap"
          >
            <CheckSquare aria-hidden="true" className="h-3.5 w-3.5" />
            Chuyển giao việc (Mô-đun 06)
          </Button>
        </ModuleHeader.Actions>
      </ModuleHeader.Root>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left Column: Administrative Drafting Editor & ND30 Paper Sheet */}
        <Card className="xl:col-span-7 border-slate-200 shadow-2xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg">
              Thông tin thể thức & Nội dung dự thảo ({deptId})
            </CardTitle>
            <CardDescription className="text-xs">
              Chọn loại văn bản, thẩm quyền ký ban hành và nhập trích yếu để hình
              thành dự thảo hoặc dán nội dung có sẵn để kiểm tra 05 tiêu chí.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5 min-w-0">
                <label className="block text-xs font-semibold text-slate-700">
                  Loại văn bản hành chính
                </label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger
                    aria-label="Loại văn bản hành chính"
                    className="w-full min-w-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADMIN_DOC_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 min-w-0">
                <label className="block text-xs font-semibold text-slate-700">
                  Thẩm quyền ký ban hành
                </label>
                <Select
                  value={authorityMode}
                  onValueChange={(v) => handleAuthorityChange(v as AuthorityMode)}
                >
                  <SelectTrigger
                    aria-label="Thẩm quyền ký ban hành"
                    className="w-full min-w-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTHORITY_MODES.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2 space-y-1.5 min-w-0">
                <label
                  htmlFor="m03-title-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Trích yếu nội dung văn bản
                </label>
                <Input
                  id="m03-title-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Về việc…"
                />
              </div>

              <div className="space-y-1.5 min-w-0">
                <label
                  htmlFor="m03-recipient-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Nơi nhận chính
                </label>
                <Input
                  id="m03-recipient-input"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Các bộ phận…"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="m03-keypoints-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Các ý chính cần đưa vào dự thảo (phân tách bằng dấu chấm phẩy hoặc xuống dòng)
              </label>
              <Textarea
                id="m03-keypoints-input"
                rows={2}
                value={keyPoints}
                onChange={(e) => setKeyPoints(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                disabled={busyDraft || !title.trim()}
                onClick={() => void handleGenerateDraft()}
                className="bg-[#1B4D89] hover:bg-[#163E70] text-white gap-2"
              >
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                {busyDraft
                  ? "Đang soạn & chấm điểm…"
                  : "Soạn dự thảo chuẩn NĐ 30/2020/NĐ-CP"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={busyAudit || !draftText.trim()}
                onClick={() => void handleAuditOnly()}
                className="gap-2"
              >
                <FileCheck2 aria-hidden="true" className="h-4 w-4" />
                {busyAudit ? "Đang kiểm tra…" : "Kiểm tra lại dự thảo đang sửa"}
              </Button>
            </div>

            {error && (
              <p role="alert" className="text-xs font-medium text-rose-700">
                {error}
              </p>
            )}

            <DocumentPaperSheet
              value={draftText}
              onChange={setDraftText}
              previewVersion={previewVersion}
              placeholder="Bấm 'Soạn dự thảo chuẩn NĐ 30/2020/NĐ-CP' hoặc dán trực tiếp nội dung dự thảo cần kiểm tra thể thức, căn cứ, thẩm quyền vào đây…"
              emptyHint="Sau khi sinh dự thảo, anh/chị có thể chuyển giữa 'Trang giấy NĐ30' (hiển thị khổ giấy công văn Noto Serif) và 'Soạn văn bản gốc' để chỉnh sửa."
            />
          </CardContent>
        </Card>

        {/* Right Column: 5-Criteria Audit Panel */}
        <Card className="xl:col-span-5 border-slate-200 shadow-2xs h-fit">
          <CardHeader className="pb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#B45309]">
              RÀ SOÁT CHẤT LƯỢNG TRƯỚC KHI TRÌNH KÝ
            </p>
            <CardTitle className="text-base sm:text-lg">
              Bảng kiểm 05 tiêu chí văn bản hành chính
            </CardTitle>
            <CardDescription className="text-xs">
              Kiểm tra tự động: Bố cục thể thức, Căn cứ pháp lý, Thẩm quyền, Tính logic
              và Chính tả - văn phong.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {!auditReport ? (
              <EmptyStatePanel
                icon={<FileCheck2 aria-hidden="true" className="h-5 w-5" />}
                title="Chưa có kết quả chấm điểm kiểm tra"
                description="Hãy nhấn 'Soạn dự thảo chuẩn NĐ 30/2020/NĐ-CP' hoặc dán văn bản vào khung bên trái rồi nhấn 'Kiểm tra lại dự thảo đang sửa'."
              />
            ) : (
              <ViewTransition enter="slide-up" default="none">
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#E5DEC9] bg-[#FCFBF7] p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">
                        Điểm chuẩn hóa thể thức & nội dung
                      </span>
                      <span className="text-2xl font-extrabold text-[#1B4D89] tabular-nums">
                        {auditReport.score}/100
                      </span>
                    </div>
                    <Progress
                      value={auditReport.score}
                      aria-label="Điểm chuẩn hóa thể thức và nội dung"
                      className="h-2"
                    />
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {auditReport.summary}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {auditReport.criteria.map((c) => {
                      const isPass = c.status === "dat";
                      const isWarn = c.status === "can_ra_soat";
                      return (
                        <div
                          key={c.id}
                          className={cn(
                            "rounded-lg border p-3 space-y-1",
                            isPass && "border-emerald-200 bg-emerald-50/50",
                            isWarn && "border-amber-200 bg-amber-50/60",
                            !isPass && !isWarn && "border-rose-200 bg-rose-50/60",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              {isPass ? (
                                <CheckCircle2
                                  aria-hidden="true"
                                  className="h-4 w-4 text-emerald-600 shrink-0"
                                />
                              ) : isWarn ? (
                                <AlertTriangle
                                  aria-hidden="true"
                                  className="h-4 w-4 text-amber-600 shrink-0"
                                />
                              ) : (
                                <XCircle
                                  aria-hidden="true"
                                  className="h-4 w-4 text-rose-600 shrink-0"
                                />
                              )}
                              {c.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-semibold shrink-0",
                                isPass && "border-emerald-300 text-emerald-800 bg-white",
                                isWarn && "border-amber-300 text-amber-800 bg-white",
                                !isPass &&
                                  !isWarn &&
                                  "border-rose-300 text-rose-800 bg-white",
                              )}
                            >
                              {formatAuditStatusLabel(c.status)}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed pl-5">
                            {c.detail}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ViewTransition>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
