import { useEffect, useRef, useState } from "react";
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

  async function handleFilesChosen(ev: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(ev.target.files ?? []);
    ev.target.value = "";
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
      setResult(proc);
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
      setResult(proc);
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

      <Alert className="border-blue-200 bg-blue-50/80 text-blue-950">
        <ShieldAlert className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-sm font-bold flex items-center justify-between gap-2 flex-wrap">
          <span>
            Cam kết bảo mật tài liệu phiên phòng {deptId} ({files.length} tệp đang mở)
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void handleWipe()}
            className="h-7 text-xs border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Kết thúc phiên - Xóa bộ nhớ
          </Button>
        </AlertTitle>
        <AlertDescription className="text-xs text-blue-900/90">
          Hỗ trợ <code>.txt</code>, <code>.md</code>, <code>.csv</code>,{" "}
          <code>.json</code>, <code>.docx</code>, <code>.pdf</code> (tối đa 10 MB/tệp).
          Tài liệu được cô lập riêng theo phòng {deptId} trên RAM và tự động chia sẻ
          sang Mô-đun 01.
        </AlertDescription>
      </Alert>

      {banner && (
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
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Upload & Session Files List */}
        <Card className="lg:col-span-5 border-slate-200 shadow-xs h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Danh sách tệp hồ sơ trong phiên ({deptId})
            </CardTitle>
            <CardDescription className="text-xs">
              Mẫu chuyên ngành phòng {deptId}: <strong>{sampleDossier.label}</strong> ({sampleDossier.summary}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs flex-1"
              >
                <Upload className="h-3.5 w-3.5" />
                Chọn tệp tải lên
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void handleLoadSampleDossier()}
                className="gap-1.5 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                Tải bộ hồ sơ mẫu của phòng ({deptId})
              </Button>
            </div>

            {files.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                Chưa có tệp nào trong phiên phòng {deptId}. Nhấn{" "}
                <strong>Chọn tệp tải lên</strong> hoặc{" "}
                <strong>Tải bộ hồ sơ mẫu của phòng ({deptId})</strong> để đối chiếu
                sai lệch ngay.
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((f) => (
                  <div
                    key={f.file_id}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 flex items-center gap-1.5 truncate">
                        <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        {f.filename}
                      </span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
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
        <Card className="lg:col-span-7 border-slate-200 shadow-xs">
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
                      ? "bg-blue-600 hover:bg-blue-700 text-white text-xs h-auto py-2 whitespace-normal"
                      : "text-xs h-auto py-2 whitespace-normal"
                  }
                >
                  <Sparkles className="h-3 w-3 mr-1 shrink-0" />
                  <span>{tab.label}</span>
                </Button>
              ))}
            </div>

            {!result ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 space-y-2">
                <FileSpreadsheet className="h-8 w-8 mx-auto text-slate-400" />
                <p>
                  Chọn một tác vụ xử lý ở trên để AI đọc, trích xuất thông tin hoặc
                  đối chiếu mâu thuẫn giữa các tài liệu trong phiên.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {result.highlights.length > 0 && result.action === "doi_chieu" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                    <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      Điểm cần kiểm tra lại trong hồ sơ:
                    </p>
                    {result.highlights.map((h) => (
                      <div key={h} className="pl-5 text-xs text-amber-900">
                        <FormattedMarkdown content={`- ${h}`} className="text-xs" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-800">
                  <FormattedMarkdown content={result.result_markdown} />
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleHandoffToM06}
                    className="gap-1.5 text-xs border-blue-200 bg-blue-50/70 text-blue-700 hover:bg-blue-100"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    Tạo nhiệm vụ xử lý hồ sơ (Mô-đun 06)
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
