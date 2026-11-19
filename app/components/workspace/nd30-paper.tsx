import { useState, type ReactNode } from "react";
import { Eye, FilePenLine } from "lucide-react";
import { parseNd30PreviewSections } from "~/lib/nd30-paper-helpers";
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

export function DocumentPaperSheet({
  value,
  onChange,
  placeholder,
  actions,
  emptyHint,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  actions?: ReactNode;
  emptyHint?: string;
}) {
  const [viewMode, setViewMode] = useState<"paper" | "edit">("paper");
  const hasContent = value.trim().length > 0;
  const parsed = parseNd30PreviewSections(value);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div
          role="tablist"
          aria-label="Chế độ hiển thị dự thảo văn bản"
          className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "paper"}
            onClick={() => setViewMode("paper")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "paper"
                ? "bg-white text-[#0C1E35] shadow-2xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Eye aria-hidden="true" className="h-3.5 w-3.5" />
            Trang giấy NĐ30
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "edit"}
            onClick={() => setViewMode("edit")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "edit"
                ? "bg-white text-[#0C1E35] shadow-2xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <FilePenLine aria-hidden="true" className="h-3.5 w-3.5" />
            Soạn văn bản gốc
          </button>
        </div>

        {actions && <div className="flex items-center gap-1.5 flex-wrap">{actions}</div>}
      </div>

      {viewMode === "edit" || !hasContent ? (
        <div className="space-y-1.5">
          <label htmlFor="nd30-draft-editor" className="sr-only">
            Nội dung dự thảo văn bản hành chính
          </label>
          <Textarea
            id="nd30-draft-editor"
            value={value}
            onChange={(e) => onChange(e.target.value)}
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
        </div>
      ) : (
        <article
          aria-label="Bản xem trước trang văn bản hành chính Nghị định 30"
          className="nd30-paper-sheet rounded-lg border border-[#E5DEC9] border-t-2 border-t-[#B45309] px-5 py-6 sm:px-10 sm:py-8 text-[#111827] font-serif"
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
        </article>
      )}
    </div>
  );
}
