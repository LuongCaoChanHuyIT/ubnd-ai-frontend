import { startTransition, useEffect, useRef, useState, ViewTransition } from "react";
import {
  Link,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from "react-router";
import {
  ArrowUp,
  BookOpen,
  CheckSquare,
  Eye,
  FileText,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import type { Route } from "./+types/m01-assistant";
import {
  apiRequest,
  extractServerAuthHeaders,
  formatModelBadgeLabel,
  getSessionState,
  normalizeDepartmentId,
  resolveServerApiBase,
  uploadSessionFile,
  wipeSessionState,
  type AssistantMode,
  type ChatTurnResponse,
  type CitationItem,
  type Department,
  type OfficialDoc,
  type SessionFileItem,
  type SessionMessageItem,
  type SessionState,
  type WorkspaceOutletContext,
} from "~/lib/api";
import { ASSISTANT_MODES, DEPARTMENT_STARTERS } from "~/lib/m01-m02-helpers";
import { buildM06TaskHandoffUrl } from "~/lib/m03-m05-helpers";
import { formatAssistantModeBadge } from "~/lib/markdown-helpers";
import {
  getActiveActorEmail,
  getActiveTenantSlug,
  getOrInitSessionId,
  getSavedAssistantMode,
  rotateSessionId,
  setSavedAssistantMode,
} from "~/lib/session";
import { CivicCrest } from "~/components/workspace/civic-crest";
import {
  DirectDocumentViewerDialog,
  type DocumentViewerTarget,
} from "~/components/workspace/document-viewer-dialog";
import { ModuleHeader } from "~/components/workspace/module-surface";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { FormattedMarkdown } from "~/components/ui/formatted-markdown";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Mô-đun 01 · Trợ lý AI theo nghiệp vụ — UBND Xã, Phường" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const deptId = normalizeDepartmentId(url.searchParams.get("dept"));
  const baseUrl = resolveServerApiBase();
  const headers = extractServerAuthHeaders(request);

  try {
    const res = await apiRequest<{ departments: Department[] }>("/api/departments", {
      baseUrl,
      headers,
    });
    const dept =
      res.departments.find((d) => d.id === deptId) ?? res.departments[0] ?? null;
    return { deptId, dept };
  } catch {
    return { deptId, dept: null };
  }
}

export default function Module01AssistantRoute({
  loaderData,
}: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const outlet = useOutletContext<WorkspaceOutletContext | undefined>();

  const rawDeptId = normalizeDepartmentId(
    searchParams.get("dept") ?? loaderData.deptId,
  );
  const deptId =
    outlet?.currentUser?.role === "officer"
      ? outlet.currentUser.department_id
      : rawDeptId;

  const matchedDept =
    outlet?.departments?.find((d) => d.id === deptId) ?? loaderData.dept;
  const deptName = matchedDept?.name ?? "Văn phòng HĐND & UBND";

  const activeActorEmail =
    outlet?.currentUser?.email ??
    (typeof window !== "undefined" ? getActiveActorEmail() : "tsh.co@tshorg.vn");
  const activeTenantSlug =
    outlet?.activeTenantSlug ??
    (typeof window !== "undefined" ? getActiveTenantSlug() : "default");

  const [sessionId, setSessionId] = useState("");
  const [mode, setModeState] = useState<AssistantMode>("nghiep_vu");
  const [messages, setMessages] = useState<SessionMessageItem[]>([]);
  const [files, setFiles] = useState<SessionFileItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    tone: "info" | "error";
    text: string;
  } | null>(null);
  const [viewerTarget, setViewerTarget] = useState<DocumentViewerTarget | null>(
    null,
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messages.length > 0 || pendingUserMessage) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length, pendingUserMessage]);

  function handleSelectMode(nextMode: AssistantMode) {
    setModeState(nextMode);
    setSavedAssistantMode(nextMode);
  }

  useEffect(() => {
    setModeState(getSavedAssistantMode());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const sid = getOrInitSessionId(deptId, activeActorEmail, activeTenantSlug);
    setSessionId(sid);
    setStatusBanner(null);

    void getSessionState(sid, deptId)
      .then((state) => {
        if (!cancelled) {
          setFiles(state.files);
          setMessages(state.messages);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFiles([]);
          setMessages([]);
        }
      });

    const onSessionRotated = (ev: Event) => {
      const nextSid = (ev as CustomEvent<string>).detail;
      if (nextSid && !cancelled) {
        setSessionId(nextSid);
        setFiles([]);
        setMessages([]);
      }
    };
    window.addEventListener("ubnd-session-changed", onSessionRotated);
    return () => {
      cancelled = true;
      window.removeEventListener("ubnd-session-changed", onSessionRotated);
    };
  }, [deptId, activeActorEmail, activeTenantSlug]);

  async function handleSend(customPrompt?: string, customMode?: AssistantMode) {
    const text = (customPrompt ?? input).trim();
    if (!text || busy) return;
    const activeMode = customMode ?? mode;
    if (customMode) {
      handleSelectMode(customMode);
    }

    const activeSid =
      sessionId || getOrInitSessionId(deptId, activeActorEmail, activeTenantSlug);
    setBusy(true);
    setPendingUserMessage(text);
    setStatusBanner(null);
    if (!customPrompt) setInput("");

    try {
      const res = await apiRequest<ChatTurnResponse>("/api/m01/chat", {
        method: "POST",
        body: {
          session_id: activeSid,
          department_id: deptId,
          mode: activeMode,
          message: text,
        },
      });
      startTransition(() => {
        setPendingUserMessage(null);
        setMessages(res.session.messages);
        setFiles(res.session.files);
      });
    } catch (err) {
      setPendingUserMessage(null);
      if (!customPrompt) setInput(text);
      setStatusBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Không thể gửi yêu cầu tới AI",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleFileSelect(ev: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(ev.target.files ?? []);
    ev.target.value = "";
    if (!selected.length) return;

    const activeSid =
      sessionId || getOrInitSessionId(deptId, activeActorEmail, activeTenantSlug);
    setUploading(true);
    setStatusBanner(null);
    try {
      let latest: SessionState | null = null;
      for (const file of selected) {
        latest = await uploadSessionFile(activeSid, file, deptId);
      }
      if (latest) {
        setFiles(latest.files);
        setStatusBanner({
          tone: "info",
          text: `Đã nạp ${selected.length} tệp vào bộ nhớ tạm của phiên phòng ${deptId}.`,
        });
      }
    } catch (err) {
      setStatusBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Lỗi tải tài liệu lên phiên",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleWipeSession() {
    const activeSid =
      sessionId || getOrInitSessionId(deptId, activeActorEmail, activeTenantSlug);
    setBusy(true);
    try {
      await wipeSessionState(activeSid, "M01", deptId);
      const nextSid = rotateSessionId(deptId, activeActorEmail, activeTenantSlug);
      setSessionId(nextSid);
      setMessages([]);
      setFiles([]);
      setInput("");
      setStatusBanner({
        tone: "info",
        text: "Đã kết thúc phiên trước và xóa sạch 100% lịch sử trao đổi cùng bộ nhớ tệp tạm.",
      });
    } catch (err) {
      setStatusBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Không thể xóa phiên",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenCitation(cit: CitationItem) {
    try {
      if (cit.id) {
        const doc = await apiRequest<OfficialDoc>(
          `/api/m04/documents/${encodeURIComponent(String(cit.id))}`,
        );
        setViewerTarget({ kind: "official", doc });
        return;
      }
      const res = await apiRequest<{ documents: OfficialDoc[] }>(
        `/api/m04/documents?department_id=${encodeURIComponent(deptId)}&q=${encodeURIComponent(cit.doc_number)}`,
      );
      if (res.documents[0]) {
        setViewerTarget({ kind: "official", doc: res.documents[0] });
        return;
      }
      navigate(
        `/nguon-van-ban?dept=${deptId}&q=${encodeURIComponent(cit.doc_number)}`,
      );
    } catch {
      navigate(
        `/nguon-van-ban?dept=${deptId}&q=${encodeURIComponent(cit.doc_number)}`,
      );
    }
  }

  function handleHandoffToM06(msg: SessionMessageItem, msgIdx: number) {
    const prevMsg = msgIdx > 0 ? messages[msgIdx - 1] : undefined;
    const baseTitle =
      prevMsg?.role === "user"
        ? `Xử lý nghiệp vụ: ${prevMsg.content.trim().slice(0, 110)}`
        : msg.content
            .replace(/[#*`|>]/g, "")
            .split(/\r?\n/)
            .map((s) => s.trim())
            .find(Boolean) ?? `Triển khai nội dung tư vấn phòng ${deptId}`;
    const cleanDesc = msg.content
      .replace(/[#*`|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 320);
    const refDoc = msg.citations?.[0]?.doc_number ?? `Tư vấn AI M01 (${deptId})`;
    navigate(
      buildM06TaskHandoffUrl({
        deptId,
        title: baseTitle,
        desc: cleanDesc,
        ref: refDoc,
      }),
    );
  }

  const starters = DEPARTMENT_STARTERS[deptId];
  const currentModeMeta =
    ASSISTANT_MODES.find((m) => m.id === mode) ?? ASSISTANT_MODES[1];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.md,.csv,.json,.docx,.pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      <ModuleHeader.Root>
        <ModuleHeader.Content>
          <ModuleHeader.Eyebrow>
            Mô-đun 01 · Trợ lý nghiệp vụ · {deptName}
          </ModuleHeader.Eyebrow>
          <ModuleHeader.Title>
            Anh/chị cần xử lý công việc gì?
          </ModuleHeader.Title>
          <ModuleHeader.Description>
            Tra cứu căn cứ pháp lý, soạn thảo tham mưu và thẩm định hồ sơ trong không
            gian làm việc cô lập của phòng {deptId}.
          </ModuleHeader.Description>
        </ModuleHeader.Content>

        <ModuleHeader.Actions>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || busy}
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 text-xs border-slate-200 bg-white text-slate-700 tabular-nums"
          >
            <Upload aria-hidden="true" className="h-3.5 w-3.5" />
            {uploading
              ? "Đang tải…"
              : `Tải thêm tài liệu (${files.length} tệp)`}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void handleWipeSession()}
            className="gap-1.5 text-xs border-rose-200 bg-rose-50/80 text-rose-700 hover:bg-rose-100"
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            Kết thúc phiên - Xóa bộ nhớ
          </Button>
        </ModuleHeader.Actions>
      </ModuleHeader.Root>

      <Card className="border-slate-200 bg-white shadow-2xs rounded-xl overflow-hidden py-0 gap-0">
        {/* 3 Mode Selector Cards */}
        <div
          role="group"
          aria-label="Chế độ làm việc của Trợ lý AI"
          className="grid grid-cols-1 md:grid-cols-3 gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100"
        >
          {ASSISTANT_MODES.map((item) => {
            const active = item.id === mode;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => handleSelectMode(item.id)}
                className={cn(
                  "text-left rounded-xl border p-3.5 transition-colors",
                  active
                    ? "border-[#1B4D89] bg-[#EEF4FB]/70 ring-1 ring-[#1B4D89]/25"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {item.title}
                  </span>
                  <Badge
                    variant={active ? "default" : "secondary"}
                    className={cn(
                      "text-[10px] font-bold px-2 py-0",
                      active
                        ? "bg-[#1B4D89] text-white"
                        : "bg-slate-100 text-slate-700",
                    )}
                  >
                    {item.badge}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Status or Active Session Files Strip */}
        {(statusBanner || files.length > 0) && (
          <div className="px-5 sm:px-6 pt-3 space-y-2">
            {statusBanner && (
              <div
                role={statusBanner.tone === "error" ? "alert" : "status"}
                aria-live="polite"
              >
                <Alert
                  variant={statusBanner.tone === "error" ? "destructive" : "default"}
                  className={cn(
                    "py-2.5",
                    statusBanner.tone === "info" &&
                      "border-emerald-200 bg-emerald-50 text-emerald-900",
                  )}
                >
                  <AlertDescription className="text-xs">
                    {statusBanner.text}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {files.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#1B4D89]/20 bg-[#EEF4FB]/60 px-3 py-2">
                <span className="text-xs font-semibold text-[#0C1E35] flex items-center gap-1 tabular-nums">
                  <Paperclip aria-hidden="true" className="h-3.5 w-3.5 text-[#1B4D89]" />
                  Tệp trong phiên ({files.length}):
                </span>
                {files.map((f) => (
                  <button
                    key={f.file_id}
                    type="button"
                    onClick={() =>
                      setViewerTarget({
                        kind: "session",
                        sessionId:
                          sessionId ||
                          getOrInitSessionId(
                            deptId,
                            activeActorEmail,
                            activeTenantSlug,
                          ),
                        departmentId: deptId,
                        file: f,
                      })
                    }
                    title={`Xem trực tiếp tệp ${f.filename}`}
                    className="inline-flex items-center rounded-md border border-[#1B4D89]/25 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-[#EEF4FB] hover:text-[#1B4D89] gap-1 transition-colors"
                  >
                    <FileText aria-hidden="true" className="h-3 w-3 text-[#1B4D89]" />
                    <span>{f.filename}</span>
                    <Eye aria-hidden="true" className="h-3 w-3 text-[#1B4D89]/80" />
                  </button>
                ))}
                <Link
                  to={`/xu-ly-tai-lieu?dept=${deptId}`}
                  viewTransition
                  className="ml-auto text-xs font-medium text-[#1B4D89] hover:underline whitespace-nowrap"
                >
                  Mở Xử lý & Đối chiếu tệp →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Conversation Body or Center Empty State */}
        <div className="px-5 sm:px-6 py-6 min-h-[300px] flex flex-col justify-center">
          {messages.length === 0 && !pendingUserMessage ? (
            <div className="mx-auto max-w-lg text-center space-y-4 py-6">
              <div className="mx-auto flex justify-center">
                <CivicCrest className="h-12 w-12" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900 text-balance">
                  Ta nên bắt đầu việc gì?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Đặt câu hỏi, yêu cầu soạn thảo hoặc tải tài liệu lên để AI đối
                  chiếu trong phiên làm việc riêng của phòng {deptId}.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {starters.map((st) => (
                  <Button
                    key={st.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleSend(st.prompt, st.mode)}
                    className="rounded-full text-xs border-slate-200 bg-slate-50/80 hover:bg-[#EEF4FB] hover:text-[#1B4D89] hover:border-[#1B4D89]/30"
                  >
                    {st.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
              {messages.map((msg, idx) => {
                const isUser = msg.role === "user";
                return (
                  <ViewTransition
                    key={`${msg.created_at}-${idx}`}
                    enter="slide-up"
                    default="none"
                  >
                    <div
                      className={cn(
                        "flex flex-col gap-1.5",
                        isUser ? "items-end" : "items-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-3xl rounded-2xl px-4 py-3 text-sm leading-relaxed",
                          isUser
                            ? "bg-[#1B4D89] text-white whitespace-pre-wrap"
                            : "border border-[#E5DEC9] bg-[#FCFBF7] text-slate-900 w-full",
                        )}
                      >
                        {!isUser && (
                          <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge className="bg-[#0C1E35] text-white text-[10px] px-2 py-0">
                                <Sparkles aria-hidden="true" className="h-2.5 w-2.5 mr-1 text-amber-300" />
                                {formatAssistantModeBadge(msg.mode)}
                              </Badge>
                              {msg.model_used && (
                                <Badge
                                  variant="outline"
                                  className="border-emerald-300 bg-emerald-50 text-emerald-900 text-[10px] font-semibold px-2 py-0"
                                >
                                  {formatModelBadgeLabel(msg.model_used)}
                                </Badge>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleHandoffToM06(msg, idx)}
                              className="h-7 px-2.5 text-[11px] gap-1 border-[#1B4D89]/25 bg-white text-[#1B4D89] hover:bg-[#EEF4FB] whitespace-nowrap"
                            >
                              <CheckSquare aria-hidden="true" className="h-3 w-3" />
                              Giao việc từ tư vấn này (M06)
                            </Button>
                          </div>
                        )}

                        {isUser ? (
                          msg.content
                        ) : (
                          <FormattedMarkdown content={msg.content} />
                        )}

                        {!isUser && msg.citations && msg.citations.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-[#E5DEC9] flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                              <BookOpen aria-hidden="true" className="h-3 w-3 text-[#B45309]" />
                              Nguồn đối chiếu:
                            </span>
                            {msg.citations.map((cit) => (
                              <button
                                key={cit.doc_number}
                                type="button"
                                onClick={() => void handleOpenCitation(cit)}
                                title="Bấm để xem trực tiếp toàn văn và nguồn gốc văn bản"
                                className="inline-flex items-center gap-1 rounded-md border border-[#1B4D89]/25 bg-white px-2 py-0.5 text-[11px] font-medium text-[#1B4D89] hover:bg-[#EEF4FB] transition-colors text-left"
                              >
                                <Eye aria-hidden="true" className="h-3 w-3 shrink-0" />
                                <span>
                                  {cit.doc_number} · {cit.title}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </ViewTransition>
                );
              })}

              {pendingUserMessage && (
                <div className="space-y-3" role="status" aria-live="polite">
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="max-w-3xl rounded-2xl bg-[#1B4D89] px-4 py-3 text-sm leading-relaxed text-white whitespace-pre-wrap opacity-95">
                      {pendingUserMessage}
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-1.5">
                    <div className="max-w-xl rounded-2xl border border-[#E5DEC9] bg-[#FCFBF7] px-4 py-3 text-xs text-slate-700 flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="inline-flex h-2 w-2 rounded-full bg-[#D97706] animate-pulse"
                      />
                      <span>
                        Trợ lý AI đang đối chiếu căn cứ pháp lý và tổng hợp nội dung…
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Chat Input Composer */}
        <div className="border-t border-slate-200/80 bg-slate-50/70 px-5 sm:px-6 py-4">
          <div className="rounded-xl border border-slate-300 bg-white p-2.5 shadow-2xs focus-within:border-[#1B4D89] focus-within:ring-2 focus-within:ring-[#1B4D89]/15">
            <label htmlFor="m01-prompt-input" className="sr-only">
              Nội dung câu hỏi hoặc yêu cầu nghiệp vụ
            </label>
            <Textarea
              id="m01-prompt-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Làm với bất kỳ nội dung nghiệp vụ nào…"
              rows={2}
              className="min-h-[54px] resize-none border-0 p-1.5 text-sm shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading || busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 px-2.5 text-xs text-slate-600 hover:text-slate-900 gap-1"
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  Tải tài liệu lên
                </Button>
                <span className="text-xs font-medium text-[#1B4D89] bg-[#EEF4FB] px-2.5 py-0.5 rounded-full">
                  {currentModeMeta.title}
                </span>
              </div>

              <Button
                type="button"
                size="icon"
                disabled={busy || !input.trim()}
                onClick={() => void handleSend()}
                aria-label="Gửi yêu cầu"
                className="h-8 w-8 rounded-full bg-[#1B4D89] hover:bg-[#163E70] text-white shrink-0"
              >
                <ArrowUp aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Enter để gửi · Shift + Enter để xuống dòng · Tài liệu chỉ được dùng
            trong phiên hiện tại
          </p>
        </div>
      </Card>

      <DirectDocumentViewerDialog
        open={Boolean(viewerTarget)}
        onOpenChange={(open) => !open && setViewerTarget(null)}
        target={viewerTarget}
      />
    </div>
  );
}
