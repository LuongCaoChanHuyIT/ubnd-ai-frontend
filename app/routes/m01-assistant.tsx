import { useEffect, useRef, useState } from "react";
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
  getSessionState,
  normalizeDepartmentId,
  resolveServerApiBase,
  uploadSessionFile,
  wipeSessionState,
  type AssistantMode,
  type ChatTurnResponse,
  type Department,
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
  const [uploading, setUploading] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    tone: "info" | "error";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      setMessages(res.session.messages);
      setFiles(res.session.files);
    } catch (err) {
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

      <Card className="border-slate-200 bg-white shadow-xs rounded-xl overflow-hidden">
        {/* Card Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 pt-5 pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              TRỢ LÝ NGHIỆP VỤ · {deptName.toUpperCase()}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Anh/chị cần xử lý công việc gì?
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || busy}
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5 text-xs border-slate-200 text-slate-700"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading
                ? "Đang tải..."
                : `Tải thêm tài liệu (${files.length} tệp)`}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void handleWipeSession()}
              className="gap-1.5 text-xs border-rose-200 bg-rose-50/70 text-rose-600 hover:bg-rose-100 hover:text-rose-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Kết thúc phiên - Xóa bộ nhớ
            </Button>
          </div>
        </div>

        {/* 3 Mode Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-6 pt-4">
          {ASSISTANT_MODES.map((item) => {
            const active = item.id === mode;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectMode(item.id)}
                className={cn(
                  "text-left rounded-xl border p-3.5 transition-all",
                  active
                    ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600/30"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60",
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
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600",
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
          <div className="px-6 pt-3 space-y-2">
            {statusBanner && (
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
            )}

            {files.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
                <span className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                  <Paperclip className="h-3.5 w-3.5" />
                  Tệp trong phiên ({files.length}):
                </span>
                {files.map((f) => (
                  <Badge
                    key={f.file_id}
                    variant="outline"
                    className="bg-white text-xs text-slate-700 border-blue-200 gap-1"
                  >
                    <FileText className="h-3 w-3 text-blue-600" />
                    {f.filename}
                  </Badge>
                ))}
                <Link
                  to={`/xu-ly-tai-lieu?dept=${deptId}`}
                  className="ml-auto text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
                >
                  Mở Xử lý & Đối chiếu tệp →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Conversation Body or Center Empty State */}
        <div className="px-6 py-6 min-h-[300px] flex flex-col justify-center">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-lg text-center space-y-4 py-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm font-bold text-sm">
                AI
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900">
                  Ta nên bắt đầu việc gì?
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  Đặt câu hỏi, yêu cầu soạn thảo hoặc tải tài liệu lên để AI tham
                  khảo trong phiên làm việc riêng của phòng {deptId}.
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
                    className="rounded-full text-xs border-slate-200 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                  >
                    {st.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {messages.map((msg, idx) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={`${msg.created_at}-${idx}`}
                    className={cn(
                      "flex flex-col gap-1.5",
                      isUser ? "items-end" : "items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-3xl rounded-2xl px-4 py-3 text-sm leading-relaxed",
                        isUser
                          ? "bg-blue-600 text-white whitespace-pre-wrap"
                          : "border border-slate-200 bg-slate-50 text-slate-800 w-full",
                      )}
                    >
                      {!isUser && (
                        <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
                          <Badge className="bg-blue-600 text-white text-[10px] px-2 py-0">
                            <Sparkles className="h-2.5 w-2.5 mr-1" />
                            {formatAssistantModeBadge(msg.mode)}
                          </Badge>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleHandoffToM06(msg, idx)}
                            className="h-6 px-2 text-[11px] gap-1 border-blue-200 bg-white text-blue-700 hover:bg-blue-50 whitespace-nowrap"
                          >
                            <CheckSquare className="h-3 w-3" />
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
                        <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                            <BookOpen className="h-3 w-3 text-blue-600" />
                            Nguồn đối chiếu:
                          </span>
                          {msg.citations.map((cit) => (
                            <Link
                              key={cit.doc_number}
                              to={`/nguon-van-ban?dept=${deptId}&q=${encodeURIComponent(cit.doc_number)}`}
                              className="inline-flex items-center rounded-md border border-blue-200 bg-white px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                            >
                              {cit.doc_number} · {cit.title}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Chat Input Composer */}
        <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Làm với bất kỳ nội dung nghiệp vụ nào..."
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
                  <Plus className="h-3.5 w-3.5" />
                  Tải tài liệu lên
                </Button>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                  {currentModeMeta.title}
                </span>
              </div>

              <Button
                type="button"
                size="icon"
                disabled={busy || !input.trim()}
                onClick={() => void handleSend()}
                aria-label="Gửi yêu cầu"
                className="h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Enter để gửi · Shift + Enter để xuống dòng · Tài liệu chỉ được dùng
            trong phiên hiện tại
          </p>
        </div>
      </Card>
    </div>
  );
}
