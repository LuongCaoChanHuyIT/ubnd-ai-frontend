import { useEffect, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  Link2,
  Loader2,
  Paperclip,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  fetchBinaryBlob,
  type DepartmentId,
  type OfficialDoc,
  type SessionFileItem,
} from "~/lib/api";
import { formatTierLabel } from "~/lib/m03-m05-helpers";
import { isSafeHttpUrl } from "~/lib/vietnamese-search";
import { DocumentPaperSheet } from "~/components/workspace/nd30-paper";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { FormattedMarkdown } from "~/components/ui/formatted-markdown";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

export type DocumentViewerTarget =
  | {
      kind: "official";
      doc: OfficialDoc;
      canEdit?: boolean;
      onAttachFile?: (docId: number, file: File) => Promise<void>;
      onUpdateSourceUrl?: (docId: number, sourceUrl: string) => Promise<void>;
      onDeleteDoc?: (docId: number) => Promise<void>;
    }
  | {
      kind: "session";
      sessionId: string;
      departmentId: DepartmentId;
      file: SessionFileItem;
    };

export interface DirectDocumentViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DocumentViewerTarget | null;
}

export function DirectDocumentViewerDialog({
  open,
  onOpenChange,
  target,
}: DirectDocumentViewerDialogProps) {
  const [activeTab, setActiveTab] = useState<"pdf" | "text">("text");
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loadingBlob, setLoadingBlob] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [sourceUrlDraft, setSourceUrlDraft] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const attachInputRef = useRef<HTMLInputElement | null>(null);

  const isOfficial = target?.kind === "official";
  const hasBinary = isOfficial
    ? Boolean(target.doc.has_attachment)
    : Boolean(target && target.file.has_raw !== false);

  const isPdfBinary = isOfficial
    ? Boolean(
        target.doc.has_attachment &&
          (target.doc.attachment_filename?.toLowerCase().endsWith(".pdf") ||
            target.doc.attachment_mime?.toLowerCase().includes("pdf")),
      )
    : Boolean(
        target &&
          (target.file.ext.toLowerCase() === ".pdf" ||
            target.file.mime_type?.toLowerCase().includes("pdf")),
      );

  const rawEndpoint = !target
    ? ""
    : target.kind === "official"
      ? `/api/m04/documents/${encodeURIComponent(String(target.doc.id))}/file`
      : `/api/m05/sessions/${encodeURIComponent(target.sessionId)}/files/${encodeURIComponent(target.file.file_id)}/raw?department_id=${encodeURIComponent(target.departmentId)}`;

  const downloadFilename = !target
    ? "tai-lieu"
    : target.kind === "official"
      ? target.doc.attachment_filename || `${target.doc.doc_number}.txt`
      : target.file.filename;

  const targetIdentityKey = !target
    ? ""
    : target.kind === "official"
      ? `official:${target.doc.id}:${target.doc.attachment_filename ?? ""}:${target.doc.attachment_size ?? 0}`
      : `session:${target.sessionId}:${target.file.file_id}`;

  const officialDocId = target?.kind === "official" ? target.doc.id : null;
  const officialSourceUrl =
    target?.kind === "official" ? (target.doc.source_url ?? "") : "";

  useEffect(() => {
    if (open && officialDocId !== null) {
      setSourceUrlDraft(officialSourceUrl);
    }
  }, [open, officialDocId, officialSourceUrl]);

  useEffect(() => {
    if (!open || !targetIdentityKey) {
      setPdfBlobUrl(null);
      setViewerError(null);
      return;
    }

    if (!isPdfBinary || !hasBinary || !rawEndpoint) {
      setActiveTab("text");
      setPdfBlobUrl(null);
      return;
    }

    setActiveTab("pdf");
    setLoadingBlob(true);
    setViewerError(null);

    let revokedUrl: string | null = null;
    let cancelled = false;

    void fetchBinaryBlob(rawEndpoint)
      .then(({ blob }) => {
        if (cancelled) return;
        const pdfBlob =
          blob.type === "application/pdf"
            ? blob
            : new Blob([blob], { type: "application/pdf" });
        const objectUrl = URL.createObjectURL(pdfBlob);
        revokedUrl = objectUrl;
        setPdfBlobUrl(objectUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        setViewerError(
          err instanceof Error
            ? err.message
            : "Không thể tải bản xem trực tiếp của tệp PDF.",
        );
        setActiveTab("text");
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingBlob(false);
        }
      });

    return () => {
      cancelled = true;
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
    };
  }, [open, targetIdentityKey, isPdfBinary, hasBinary, rawEndpoint]);

  async function handleDownloadOriginal() {
    if (!rawEndpoint || !hasBinary) return;
    setViewerError(null);
    try {
      const { blob } = await fetchBinaryBlob(rawEndpoint);
      const tempUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = tempUrl;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(tempUrl), 1000);
    } catch (err) {
      setViewerError(
        err instanceof Error ? err.message : "Không thể tải tệp gốc về máy.",
      );
    }
  }

  async function handleChooseAttachment(ev: React.ChangeEvent<HTMLInputElement>) {
    const chosen = ev.target.files?.[0];
    ev.target.value = "";
    if (!chosen || !target || target.kind !== "official" || !target.onAttachFile) {
      return;
    }
    setEditBusy(true);
    setViewerError(null);
    try {
      await target.onAttachFile(target.doc.id, chosen);
    } catch (err) {
      setViewerError(
        err instanceof Error ? err.message : "Không thể đính kèm tệp gốc.",
      );
    } finally {
      setEditBusy(false);
    }
  }

  async function handleSaveSourceUrl(ev: React.FormEvent) {
    ev.preventDefault();
    if (!target || target.kind !== "official" || !target.onUpdateSourceUrl) {
      return;
    }
    const trimmed = sourceUrlDraft.trim();
    if (trimmed && !isSafeHttpUrl(trimmed)) {
      setViewerError("Đường dẫn nguồn phải bắt đầu bằng http:// hoặc https://");
      return;
    }
    setEditBusy(true);
    setViewerError(null);
    try {
      await target.onUpdateSourceUrl(target.doc.id, trimmed);
    } catch (err) {
      setViewerError(
        err instanceof Error ? err.message : "Không thể lưu đường dẫn nguồn.",
      );
    } finally {
      setEditBusy(false);
    }
  }

  async function handleRemoveDoc() {
    if (!target || target.kind !== "official" || !target.onDeleteDoc) {
      return;
    }
    setEditBusy(true);
    setViewerError(null);
    try {
      await target.onDeleteDoc(target.doc.id);
      onOpenChange(false);
    } catch (err) {
      setViewerError(
        err instanceof Error ? err.message : "Không thể xóa văn bản.",
      );
    } finally {
      setEditBusy(false);
    }
  }

  const safeOfficialUrl =
    target?.kind === "official" && isSafeHttpUrl(target.doc.source_url)
      ? target.doc.source_url!.trim()
      : "";

  const textBody =
    target?.kind === "official"
      ? target.doc.content
      : target?.file.extracted_text ?? "";

  const isStructuredSessionFormat =
    target?.kind === "session" &&
    [".md", ".csv", ".json"].includes(target.file.ext.toLowerCase());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {target && (
          <>
            <DialogHeader className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                {target.kind === "official" ? (
                  <>
                    <Badge className="bg-[#0C1E35] text-white text-[10px]">
                      {target.doc.doc_number}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {formatTierLabel(target.doc.tier)}
                    </Badge>
                    {target.doc.has_attachment && (
                      <Badge
                        variant="outline"
                        className="border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px]"
                      >
                        <Paperclip aria-hidden="true" className="h-2.5 w-2.5 mr-1" />
                        {target.doc.attachment_filename}
                      </Badge>
                    )}
                  </>
                ) : (
                  <>
                    <Badge className="bg-[#1B4D89] text-white text-[10px]">
                      Tệp phiên phòng {target.departmentId}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] tabular-nums">
                      {Math.max(1, Math.round(target.file.size_bytes / 1024))} KB
                    </Badge>
                  </>
                )}
              </div>

              <DialogTitle className="text-base sm:text-lg text-balance">
                {target.kind === "official"
                  ? `${target.doc.doc_number} — ${target.doc.title}`
                  : target.file.filename}
              </DialogTitle>

              <DialogDescription className="text-xs tabular-nums">
                {target.kind === "official"
                  ? `Cơ quan ban hành: ${target.doc.issuer} · Ngày ban hành: ${target.doc.issued_date} · Phạm vi: ${target.doc.department_id === "ALL" ? "Toàn UBND" : `Phòng ${target.doc.department_id}`}`
                  : `${target.file.parse_note} · Chỉ lưu trên bộ nhớ tạm (RAM) của phiên hiện tại`}
              </DialogDescription>
            </DialogHeader>

            {viewerError && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">{viewerError}</AlertDescription>
              </Alert>
            )}

            {/* Action Toolbar: Source Link, Original Download, Delegated Manager Upload */}
            <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                {safeOfficialUrl && (
                  <Button
                    asChild
                    size="sm"
                    className="h-8 text-xs bg-[#1B4D89] hover:bg-[#163E70] text-white gap-1.5"
                  >
                    <a
                      href={safeOfficialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                      Mở nguồn văn bản gốc
                    </a>
                  </Button>
                )}

                {hasBinary && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDownloadOriginal()}
                    className="h-8 text-xs gap-1.5 bg-white"
                  >
                    <Download aria-hidden="true" className="h-3.5 w-3.5" />
                    Tải tệp gốc ({downloadFilename})
                  </Button>
                )}
              </div>

              {target.kind === "official" && target.canEdit && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <input
                    ref={attachInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.csv,.json"
                    className="hidden"
                    onChange={handleChooseAttachment}
                  />
                  {target.onAttachFile && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={editBusy}
                      onClick={() => attachInputRef.current?.click()}
                      className="h-8 text-xs gap-1.5 bg-white"
                    >
                      <Upload aria-hidden="true" className="h-3.5 w-3.5" />
                      {target.doc.has_attachment
                        ? "Thay tệp đính kèm"
                        : "Đính kèm tệp văn bản (.pdf/.docx)"}
                    </Button>
                  )}
                  {target.onDeleteDoc && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={editBusy}
                      onClick={() => void handleRemoveDoc()}
                      className="h-8 text-xs gap-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      Xóa văn bản
                    </Button>
                  )}
                </div>
              )}
            </div>

            {target.kind === "official" &&
              target.canEdit &&
              target.onUpdateSourceUrl && (
                <form
                  onSubmit={handleSaveSourceUrl}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5"
                >
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1 shrink-0">
                    <Link2 aria-hidden="true" className="h-3.5 w-3.5 text-[#1B4D89]" />
                    Link dẫn nguồn:
                  </span>
                  <Input
                    value={sourceUrlDraft}
                    onChange={(e) => setSourceUrlDraft(e.target.value)}
                    placeholder="https://vbpl.vn/… hoặc cổng văn bản chính thức"
                    spellCheck={false}
                    className="h-8 text-xs flex-1"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="secondary"
                    disabled={editBusy}
                    className="h-8 text-xs gap-1 shrink-0"
                  >
                    <Save aria-hidden="true" className="h-3.5 w-3.5" />
                    Lưu nguồn
                  </Button>
                </form>
              )}

            {/* Main Viewer Body: Inline PDF Iframe + Archival Text View */}
            {isPdfBinary ? (
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "pdf" | "text")}
                className="space-y-2.5"
              >
                <TabsList className="h-auto">
                  <TabsTrigger value="pdf" className="text-xs gap-1.5">
                    <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                    Xem trực tiếp tệp PDF gốc
                  </TabsTrigger>
                  <TabsTrigger value="text" className="text-xs gap-1.5">
                    <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                    Văn bản trích xuất phục vụ AI
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pdf" className="mt-0">
                  {loadingBlob ? (
                    <div className="flex h-[56vh] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600 gap-2">
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      Đang tải tệp PDF gốc có xác thực phân quyền…
                    </div>
                  ) : pdfBlobUrl ? (
                    <iframe
                      title={
                        target.kind === "official"
                          ? `Bản gốc PDF ${target.doc.doc_number}`
                          : `Bản gốc PDF ${target.file.filename}`
                      }
                      src={pdfBlobUrl}
                      className="h-[60vh] w-full rounded-lg border border-slate-300 bg-slate-100"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-600">
                      Không thể hiển thị khung PDF trực tiếp. Vui lòng chuyển sang
                      tab văn bản trích xuất hoặc bấm <strong>Tải tệp gốc</strong>.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="text" className="mt-0">
                  <div className="max-h-[56vh] overflow-y-auto">
                    <DocumentPaperSheet.Canvas
                      text={
                        textBody.trim() ||
                        "(Tệp PDF dạng ảnh quét chưa có lớp văn bản trích xuất)"
                      }
                    />
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-2.5">
                {target.kind === "official" && target.doc.summary && (
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">Tóm tắt: </span>
                    {target.doc.summary}
                  </div>
                )}

                <div className="max-h-[56vh] overflow-y-auto">
                  {isStructuredSessionFormat ? (
                    <div className="rounded-lg border border-slate-200 bg-[#FCFBF7] p-4 text-xs">
                      {target.file.ext.toLowerCase() === ".md" ? (
                        <FormattedMarkdown content={textBody} />
                      ) : (
                        <pre className="whitespace-pre-wrap font-mono text-xs text-slate-800 leading-relaxed">
                          {textBody}
                        </pre>
                      )}
                    </div>
                  ) : (
                    <DocumentPaperSheet.Canvas text={textBody} />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
