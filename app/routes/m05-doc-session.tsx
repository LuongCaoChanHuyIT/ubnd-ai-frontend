import { startTransition, useEffect, useRef, useState, ViewTransition } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router";
import {
  AlertTriangle,
  CheckSquare,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import type { Route } from "./+types/m05-doc-session";
import {
  apiRequest,
  getSessionState,
  normalizeDepartmentId,
  uploadSessionFile,
  wipeSessionState,
  type SessionFileItem,
  type SessionProcessAction,
  type SessionProcessResult,
  type SessionState,
  type WorkspaceOutletContext,
} from "~/lib/api";
import {
  DEPARTMENT_SAMPLE_DOSSIERS,
  SESSION_PROCESS_TABS,
  buildM06TaskHandoffUrl,
} from "~/lib/m03-m05-helpers";
import {
  getActiveActorEmail,
  getActiveTenantSlug,
  getOrInitSessionId,
  rotateSessionId,
} from "~/lib/session";
import {
  EmptyStatePanel,
  ModuleHeader,
} from "~/components/workspace/module-surface";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { FormattedMarkdown } from "~/components/ui/formatted-markdown";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Mô-đun 05 · Tải & Xử lý tài liệu phiên — UBND Xã, Phường" }];
}

export default function Module05DocSessionRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const outlet = useOutletContext<WorkspaceOutletContext | undefined>();

  const rawDept = normalizeDepartmentId(searchParams.get("dept"));
  const deptId =
    outlet?.currentUser?.role === "officer"
      ? outlet.currentUser.department_id
      : rawDept;

  const activeActorEmail =
    outlet?.currentUser?.email ??
    (typeof window !== "undefined" ? getActiveActorEmail() : "tsh.co@tshorg.vn");
  const activeTenantSlug =
    outlet?.activeTenantSlug ??
    (typeof window !== "undefined" ? getActiveTenantSlug() : "default");

  const [sessionId, setSessionId] = useState("");
  const [files, setFiles] = useState<SessionFileItem[]>([]);
  const [activeAction, setActiveAction] =
    useState<SessionProcessAction>("doi_chieu");
  const [result, setResult] = useState<SessionProcessResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [banner, setBanner] = useState<{
    tone: "info" | "error";
    text: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const sampleDossier = DEPARTMENT_SAMPLE_DOSSIERS[deptId];

  useEffect(() => {
    let cancelled = false;
    const sid = getOrInitSessionId(deptId, activeActorEmail, activeTenantSlug);
    setSessionId(sid);
    setResult(null);
    setBanner(null);

    void getSessionState(sid, deptId)
      .then((state) => {
        if (!cancelled) {
          setFiles(state.files);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFiles([]);
        }
      });

    const onRotated = (ev: Event) => {
      const nextSid = (ev as CustomEvent<string>).detail;
      if (nextSid && !cancelled) {
        setSessionId(nextSid);
        setFiles([]);
        setResult(null);
      }
    };
    window.addEventListener("ubnd-session-changed", onRotated);
    return () => {
      cancelled = true;
      window.removeEventListener("ubnd-session-changed", onRotated);
    };
  }, [deptId, activeActorEmail, activeTenantSlug]);

  async function uploadSelectedFiles(selected: File[]) {
    if (!selected.length) return;
    setBusy(true);
    setBanner(null);
    const activeSid =
      sessionId || getOrInitSessionId(deptId, activeActorEmail, activeTenantSlug);

    try {
      let latest: SessionState | null = null;
      for (const f of selected) {
        latest = await uploadSessionFile(activeSid, f, deptId);
      }
      if (latest) {
        setFiles(latest.files);
        setBanner({
          tone: "info",
          text: `Đã tải lên ${selected.length} tệp vào bộ nhớ phiên phòng ${deptId}.`,
        });
      }
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Không thể tải tệp lên",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleFilesChosen(ev: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(ev.target.files ?? []);
    ev.target.value = "";
    await uploadSelectedFiles(selected);
  }

  async function handleLoadSampleDossier() {
    setBusy(true);
    setBanner(null);
    let activeSid =
      sessionId || getOrInitSessionId(deptId, activeActorEmail, activeTenantSlug);
    try {
      if (files.length > 0) {
        await wipeSessionState(activeSid, "M05", deptId);
        activeSid = rotateSessionId(deptId, activeActorEmail, activeTenantSlug);
        setSessionId(activeSid);
      }

      const [sample1, sample2] = sampleDossier.files;
      const f1 = new File([sample1.content], sample1.filename, {
        type: "text/plain",
      });
      const f2 = new File([sample2.content], sample2.filename, {
        type: "text/plain",
      });

      await uploadSessionFile(activeSid, f1, deptId);
      const state = await uploadSessionFile(activeSid, f2, deptId);
      setFiles(state.files);

      const proc = await apiRequest<SessionProcessResult>(
        `/api/m05/sessions/${encodeURIComponent(activeSid)}/process`,
        {
          method: "POST",
          body: { action: "doi_chieu", department_id: deptId },
        },
      );
      setActiveAction("doi_chieu");
      startTransition(() => {
        setResult(proc);
      });
      setBanner({
        tone: "info",
        text: `Đã nạp bộ hồ sơ mẫu phòng ${deptId} (${sampleDossier.label}) và chạy đối chiếu sai lệch tự động.`,
      });
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Lỗi nạp hồ sơ mẫu",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRunProcess(action: SessionProcessAction) {
    setActiveAction(action);
    setBusy(true);
    setBanner(null);
    const activeSid =
      sessionId || getOrInitSessionId(deptId, activeActorEmail, activeTenantSlug);
    try {
      const proc = await apiRequest<SessionProcessResult>(
        `/api/m05/sessions/${encodeURIComponent(activeSid)}/process`,
        {
          method: "POST",
          body: { action, department_id: deptId },
        },
      );
      startTransition(() => {
        setResult(proc);
      });
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Lỗi xử lý tài liệu",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleWipe() {
    const activeSid =
      sessionId || getOrInitSessionId(deptId, activeActorEmail, activeTenantSlug);
    setBusy(true);
    try {
      await wipeSessionState(activeSid, "M05", deptId);
      const nextSid = rotateSessionId(deptId, activeActorEmail, activeTenantSlug);
      setSessionId(nextSid);
      setFiles([]);
      setResult(null);
      setBanner({
        tone: "info",
        text: "Đã kết thúc phiên và xóa sạch 100% dữ liệu tài liệu tạm trên bộ nhớ RAM.",
      });
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Không thể xóa phiên",
      });
    } finally {
      setBusy(false);
    }
  }

  function handleHandoffToM06() {
    if (!result) return;
    const fileNames = files.map((f) => f.filename).join(", ");
    const highlightText =
      result.highlights.length > 0
        ? result.highlights.join("; ")
        : result.result_markdown.replace(/[#*`|]/g, "").slice(0, 260);
    navigate(
      buildM06TaskHandoffUrl({
        deptId,
        title: `Xử lý & xác minh hồ sơ phòng ${deptId}: ${sampleDossier.label}`,
        desc: `Tệp đối chiếu (${files.length}): ${fileNames}. Nội dung lưu ý: ${highlightText}`,
        ref: `Phiên tài liệu M05 (${deptId})`,
      }),
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".txt,.md,.csv,.json,.docx,.pdf"
        className="hidden"
        onChange={handleFilesChosen}
      />

      <ModuleHeader.Root>
        <ModuleHeader.Content>
          <ModuleHeader.Eyebrow>
            Mô-đun 05 · Tài liệu phiên & Đối chiếu hồ sơ · Phòng {deptId}
          </ModuleHeader.Eyebrow>
          <ModuleHeader.Title>
            Tải tài liệu tạm thời & Đối chiếu sai lệch hồ sơ
          </ModuleHeader.Title>
          <ModuleHeader.Description>
            Tài liệu phiên được cô lập trên bộ nhớ RAM theo phòng {deptId} và tự
            động đồng bộ sang Trợ lý AI (Mô-đun 01).
          </ModuleHeader.Description>
        </ModuleHeader.Content>

        <ModuleHeader.Actions>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void handleWipe()}
            className="gap-1.5 text-xs border-rose-200 bg-rose-50/80 text-rose-700 hover:bg-rose-100 whitespace-nowrap"
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            Kết thúc phiên - Xóa bộ nhớ
          </Button>
        </ModuleHeader.Actions>
      </ModuleHeader.Root>

      <Alert className="border-[#1B4D89]/25 bg-[#EEF4FB]/70 text-slate-900">
        <ShieldAlert aria-hidden="true" className="h-4 w-4 text-[#1B4D89]" />
        <AlertTitle className="text-sm font-bold text-[#0C1E35] tabular-nums">
          Cam kết bảo mật tài liệu phiên phòng {deptId} ({files.length} tệp đang mở)
        </AlertTitle>
        <AlertDescription className="text-xs text-slate-700">
          Hỗ trợ <code>.txt</code>, <code>.md</code>, <code>.csv</code>,{" "}
          <code>.json</code>, <code>.docx</code>, <code>.pdf</code> (tối đa 10 MB/tệp).
          Khi kết thúc phiên, toàn bộ văn bản trích xuất được xóa ngay lập tức.
        </AlertDescription>
      </Alert>

      {banner && (
        <div
          role={banner.tone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          <Alert
            variant={banner.tone === "error" ? "destructive" : "default"}
            className={
              banner.tone === "info"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 py-2.5"
                : "py-2.5"
            }
          >
            <AlertDescription className="text-xs">{banner.text}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Upload Dropzone & Session Files List */}
        <Card className="lg:col-span-5 border-slate-200 shadow-2xs h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Danh sách tệp hồ sơ trong phiên ({deptId})
            </CardTitle>
            <CardDescription className="text-xs">
              Mẫu chuyên ngành phòng {deptId}: <strong>{sampleDossier.label}</strong> ({sampleDossier.summary}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              onDragOver={(ev) => {
                ev.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(ev) => {
                ev.preventDefault();
                setDragActive(false);
                const dropped = Array.from(ev.dataTransfer.files ?? []);
                void uploadSelectedFiles(dropped);
              }}
              className={cn(
                "rounded-xl border border-dashed p-4 text-center space-y-2.5 transition-colors",
                dragActive
                  ? "border-[#1B4D89] bg-[#EEF4FB]"
                  : "border-slate-300 bg-slate-50/60",
              )}
            >
              <p className="text-xs text-slate-600">
                Kéo thả tệp hồ sơ vào đây hoặc chọn thao tác bên dưới:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                  className="bg-[#1B4D89] hover:bg-[#163E70] text-white gap-1.5 text-xs"
                >
                  <Upload aria-hidden="true" className="h-3.5 w-3.5" />
                  {busy ? "Đang xử lý…" : "Chọn tệp tải lên"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void handleLoadSampleDossier()}
                  className="gap-1.5 text-xs border-[#1B4D89]/30 bg-white text-[#1B4D89] hover:bg-[#EEF4FB]"
                >
                  <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
                  Tải bộ hồ sơ mẫu ({deptId})
                </Button>
              </div>
            </div>

            {files.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500">
                Chưa có tệp nào trong phiên phòng {deptId}. Nhấn{" "}
                <strong>Chọn tệp tải lên</strong> hoặc{" "}
                <strong>Tải bộ hồ sơ mẫu ({deptId})</strong> để đối chiếu sai lệch ngay.
              </p>
            ) : (
              <div className="space-y-2">
                {files.map((f) => (
                  <div
                    key={f.file_id}
                    className="rounded-lg border border-slate-200 bg-[#FCFBF7] p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 flex items-center gap-1.5 truncate">
                        <FileText
                          aria-hidden="true"
                          className="h-3.5 w-3.5 text-[#1B4D89] shrink-0"
                        />
                        {f.filename}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] shrink-0 tabular-nums"
                      >
                        {Math.max(1, Math.round(f.size_bytes / 1024))} KB
                      </Badge>
                    </div>
                    <p className="text-[11px] text-emerald-700">{f.parse_note}</p>
                    <p className="text-slate-600 line-clamp-2">
                      {f.extracted_text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: 4 Processing Operations */}
        <Card className="lg:col-span-7 border-slate-200 shadow-2xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Xử lý nghiệp vụ trên tài liệu phiên ({deptId})
            </CardTitle>
            <CardDescription className="text-xs">
              Chọn một trong 04 chế độ xử lý hồ sơ chuyên biệt bên dưới:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 2xl:grid-cols-4 gap-2">
              {SESSION_PROCESS_TABS.map((tab) => (
                <Button
                  key={tab.id}
                  type="button"
                  variant={activeAction === tab.id ? "default" : "outline"}
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleRunProcess(tab.id)}
                  className={
                    activeAction === tab.id
                      ? "bg-[#1B4D89] hover:bg-[#163E70] text-white text-xs h-auto py-2 whitespace-normal"
                      : "text-xs h-auto py-2 whitespace-normal"
                  }
                >
                  <Sparkles aria-hidden="true" className="h-3 w-3 mr-1 shrink-0" />
                  <span>{tab.label}</span>
                </Button>
              ))}
            </div>

            {!result ? (
              <EmptyStatePanel
                icon={<FileSpreadsheet aria-hidden="true" className="h-5 w-5" />}
                title="Chưa có kết quả phân tích tài liệu phiên"
                description="Chọn một tác vụ xử lý ở trên để AI đọc, trích xuất thông tin hoặc đối chiếu mâu thuẫn giữa các tài liệu trong phiên."
              />
            ) : (
              <ViewTransition enter="slide-up" default="none">
                <div className="space-y-3">
                  {result.highlights.length > 0 && result.action === "doi_chieu" && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-1.5">
                      <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <AlertTriangle
                          aria-hidden="true"
                          className="h-4 w-4 text-amber-700 shrink-0"
                        />
                        Điểm cần kiểm tra lại trong hồ sơ:
                      </p>
                      {result.highlights.map((h) => (
                        <div key={h} className="pl-5 text-xs text-amber-950">
                          <FormattedMarkdown content={`- ${h}`} className="text-xs" />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-xl border border-[#E5DEC9] bg-[#FCFBF7] p-4 text-slate-900">
                    <FormattedMarkdown content={result.result_markdown} />
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleHandoffToM06}
                      className="gap-1.5 text-xs border-[#1B4D89]/30 bg-[#EEF4FB] text-[#1B4D89] hover:bg-[#1B4D89]/15"
                    >
                      <CheckSquare aria-hidden="true" className="h-3.5 w-3.5" />
                      Tạo nhiệm vụ xử lý hồ sơ (Mô-đun 06)
                    </Button>
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
