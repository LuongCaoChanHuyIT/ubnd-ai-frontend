import { useEffect, useState, type ReactNode } from "react";
import { Eye, FilePenLine } from "lucide-react";
import {
  parseNd30PreviewSections,
  resolveEffectivePaperMode,
  resolveNextPaperModeOnInput,
  type PaperViewMode,
} from "~/lib/nd30-paper-helpers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

const CENTERED_DOC_HEADINGS = new Set([
  "QUYẾT ĐỊNH",
  "TỜ TRÌNH",
  "KẾ HOẠCH",
  "BÁO CÁO",
  "THÔNG BÁO",
  "CÔNG VĂN",
  "CHƯƠNG TRÌNH",
  "QUYẾT ĐỊNH:",
]);

function PaperRoot({
  value,
  defaultMode = "paper",
  onValueChange,
  children,
  className,
}: {
  value?: PaperViewMode;
  defaultMode?: PaperViewMode;
  onValueChange?: (mode: PaperViewMode) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tabs
      value={value}
      defaultValue={value ? undefined : defaultMode}
      onValueChange={(next) => onValueChange?.(next as PaperViewMode)}
      className={cn("space-y-3", className)}
    >
      {children}
    </Tabs>
  );
}

function PaperToolbar({
  disablePaper = false,
  actions,
}: {
  disablePaper?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <TabsList
        aria-label="Chế độ hiển thị dự thảo văn bản"
        className="h-auto rounded-lg border border-slate-200 bg-slate-100 p-0.5"
      >
        <TabsTrigger
          value="paper"
          disabled={disablePaper}
          className="gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-[#0C1E35]"
        >
          <Eye aria-hidden="true" className="h-3.5 w-3.5" />
          Trang giấy NĐ30
        </TabsTrigger>
        <TabsTrigger
          value="edit"
          className="gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-[#0C1E35]"
        >
          <FilePenLine aria-hidden="true" className="h-3.5 w-3.5" />
          Soạn văn bản gốc
        </TabsTrigger>
      </TabsList>

      {actions && <div className="flex items-center gap-1.5 flex-wrap">{actions}</div>}
    </div>
  );
}

function PaperCanvas({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parsed = parseNd30PreviewSections(text);
  const hasFooter =
    parsed.recipientLines.length > 0 || parsed.signerLines.length > 0;

  return (
    <article
      aria-label="Bản xem trước trang văn bản hành chính Nghị định 30"
      className={cn(
        "nd30-paper-sheet rounded-lg border border-[#E5DEC9] border-t-2 border-t-[#B45309] px-5 py-6 sm:px-10 sm:py-8 text-[#111827] font-serif",
        className,
      )}
    >
      {parsed.hasStructuredHeader && (
        <header className="space-y-3 pb-5 border-b border-stone-200/80">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 text-center">
            <div className="sm:col-span-5 space-y-0.5">
              {parsed.agencyLines.map((line, i) => (
                <p
                  key={i}
                  className={cn(
                    "text-[12.5px] tracking-tight leading-snug",
                    i === 0 ? "font-normal" : "font-bold",
                  )}
                >
                  {line}
                </p>
              ))}
              <div
                aria-hidden="true"
                className="mx-auto mt-1.5 h-px w-16 bg-stone-700"
              />
            </div>

            <div className="sm:col-span-7 space-y-0.5">
              {parsed.mottoLines.map((line, i) => (
                <p
                  key={i}
                  className={cn(
                    "leading-snug",
                    i === 0
                      ? "text-[12.5px] font-bold tracking-tight"
                      : "text-[13px] font-bold",
                  )}
                >
                  {line}
                </p>
              ))}
              <div
                aria-hidden="true"
                className="mx-auto mt-1.5 h-px w-36 bg-stone-800"
              />
            </div>
          </div>

          {(parsed.symbolLine || parsed.datePlaceLine) && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1 text-[13px]">
              <p className="sm:col-span-5 text-center text-stone-800">
                {parsed.symbolLine}
              </p>
              <p className="sm:col-span-7 text-center sm:text-right sm:pr-4 italic text-stone-800">
                {parsed.datePlaceLine}
              </p>
            </div>
          )}
        </header>
      )}

      <div className="pt-4 space-y-2 text-[14px] leading-[1.75]">
        {parsed.bodyLines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-1.5" aria-hidden="true" />;
          }
          if (CENTERED_DOC_HEADINGS.has(trimmed.toUpperCase())) {
            return (
              <p
                key={idx}
                className="text-center font-bold text-[15px] tracking-wide pt-1 text-stone-950"
              >
                {trimmed}
              </p>
            );
          }
          if (/^(Về việc|V\/v)\b/i.test(trimmed)) {
            return (
              <p
                key={idx}
                className="text-center font-semibold text-[13.5px] pb-2 text-stone-900"
              >
                {trimmed}
              </p>
            );
          }
          if (/^\s{12,}/.test(line)) {
            return (
              <p key={idx} className="text-right pr-4 font-bold text-[13.5px]">
                {trimmed}
              </p>
            );
          }
          if (/^Căn cứ\b/.test(trimmed) || /^Theo đề nghị\b/.test(trimmed)) {
            return (
              <p key={idx} className="italic text-stone-800 indent-6">
                {trimmed}
              </p>
            );
          }
          if (/^(Điều\s+\d+\.|[IVX]+\.\s+)/.test(trimmed)) {
            return (
              <p key={idx} className="font-semibold text-stone-950 pt-1">
                {trimmed}
              </p>
            );
          }
          return (
            <p key={idx} className="text-stone-900">
              {trimmed}
            </p>
          );
        })}
      </div>

      {hasFooter && (
        <footer className="mt-6 pt-4 border-t border-stone-200/80 grid grid-cols-1 sm:grid-cols-12 gap-4">
          <div className="sm:col-span-6 space-y-0.5 text-[12.5px] leading-relaxed text-stone-800">
            {parsed.recipientLines.map((line, i) => (
              <p
                key={i}
                className={
                  /^Nơi nhận\s*:/i.test(line) ? "font-bold italic text-stone-950" : ""
                }
              >
                {line}
              </p>
            ))}
          </div>

          <div className="sm:col-span-6 space-y-1 text-center text-[13px] leading-snug text-stone-950">
            {parsed.signerLines.map((line, i) => {
              const isSealNote = /^\(.*\)$/.test(line);
              return (
                <p
                  key={i}
                  className={
                    isSealNote
                      ? "py-2 text-[12px] italic font-normal text-stone-600"
                      : "font-bold"
                  }
                >
                  {line}
                </p>
              );
            })}
          </div>
        </footer>
      )}
    </article>
  );
}

function DocumentPaperSheetComposed({
  value,
  onChange,
  placeholder,
  actions,
  emptyHint,
  previewVersion,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  actions?: ReactNode;
  emptyHint?: string;
  previewVersion?: number;
}) {
  const [viewMode, setViewMode] = useState<PaperViewMode>("paper");
  const hasContent = value.trim().length > 0;
  const effectiveMode = resolveEffectivePaperMode(viewMode, value);

  useEffect(() => {
    if (previewVersion && previewVersion > 0) {
      setViewMode("paper");
    }
  }, [previewVersion]);

  return (
    <PaperRoot value={effectiveMode} onValueChange={setViewMode}>
      <PaperToolbar disablePaper={!hasContent} actions={actions} />

      <TabsContent value="paper" className="mt-0">
        <PaperCanvas text={value} />
      </TabsContent>

      <TabsContent value="edit" className="mt-0 space-y-1.5">
        <label htmlFor="nd30-draft-editor" className="sr-only">
          Nội dung dự thảo văn bản hành chính
        </label>
        <Textarea
          id="nd30-draft-editor"
          value={value}
          onChange={(e) => {
            const nextText = e.target.value;
            const nextMode = resolveNextPaperModeOnInput(
              viewMode,
              value,
              nextText,
            );
            if (nextMode !== viewMode) {
              setViewMode(nextMode);
            }
            onChange(nextText);
          }}
          rows={18}
          placeholder={
            placeholder ??
            "Nhập hoặc sinh tự động dự thảo văn bản hành chính theo Nghị định 30/2020/NĐ-CP để kiểm tra thể thức…"
          }
          className="font-mono text-xs leading-relaxed bg-[#FCFBF7] border-slate-300 min-h-[380px]"
        />
        {!hasContent && emptyHint && (
          <p className="text-xs text-slate-500">{emptyHint}</p>
        )}
      </TabsContent>
    </PaperRoot>
  );
}

export const DocumentPaperSheet = Object.assign(DocumentPaperSheetComposed, {
  Root: PaperRoot,
  Toolbar: PaperToolbar,
  Canvas: PaperCanvas,
});
