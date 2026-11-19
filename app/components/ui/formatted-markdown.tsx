import { parseMarkdownBlocks, type InlineSpan } from "~/lib/markdown-helpers";
import { cn } from "~/lib/utils";

function renderSpans(spans: InlineSpan[]) {
  return spans.map((sp, i) => {
    if (sp.code) {
      return (
        <code
          key={i}
          className={cn(
            "rounded border border-slate-200/90 bg-slate-100 px-1.5 py-0.5 font-mono text-[11.5px] text-blue-800 break-words",
            sp.bold ? "font-semibold" : "font-medium",
          )}
        >
          {sp.text}
        </code>
      );
    }
    if (sp.bold) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {sp.text}
        </strong>
      );
    }
    if (sp.italic) {
      return (
        <em key={i} className="italic text-slate-600">
          {sp.text}
        </em>
      );
    }
    return <span key={i}>{sp.text}</span>;
  });
}

export function FormattedMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = parseMarkdownBlocks(content);
  return (
    <div className={cn("space-y-2 text-[13.5px] leading-relaxed min-w-0", className)}>
      {blocks.map((block, idx) => {
        if (block.type === "hr") {
          return <hr key={idx} className="my-2 border-slate-200" />;
        }

        if (block.type === "codeblock") {
          return (
            <pre
              key={idx}
              className="my-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-3.5 font-mono text-[11.5px] leading-relaxed whitespace-pre text-slate-800 shadow-2xs"
            >
              {block.codeText}
            </pre>
          );
        }

        if (block.type === "heading") {
          const isTop = (block.level ?? 3) <= 2;
          return (
            <h4
              key={idx}
              className={cn(
                "pt-1 font-bold text-slate-900",
                isTop ? "text-[15px]" : "text-sm",
              )}
            >
              {renderSpans(block.spans)}
            </h4>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={idx}
              className="my-1.5 rounded-r-lg border-l-4 border-blue-500 bg-blue-50/80 px-3.5 py-2 text-xs sm:text-[13px] text-slate-800"
            >
              {renderSpans(block.spans)}
            </blockquote>
          );
        }

        if (block.type === "table" && block.headers) {
          return (
            <div
              key={idx}
              className="my-2 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-2xs"
            >
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-100/90 text-slate-800">
                  <tr>
                    {block.headers.map((cellSpans, hIdx) => (
                      <th
                        key={hIdx}
                        className="border-r border-slate-200 px-2.5 py-2 font-semibold whitespace-normal break-words last:border-r-0"
                      >
                        {renderSpans(cellSpans)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(block.rows ?? []).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/80">
                      {row.map((cellSpans, cIdx) => (
                        <td
                          key={cIdx}
                          className="border-r border-slate-100 px-2.5 py-2 align-top text-slate-700 whitespace-normal break-words last:border-r-0"
                        >
                          {renderSpans(cellSpans)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === "bullet") {
          const indent = block.indentLevel ?? 0;
          return (
            <div
              key={idx}
              className={cn(
                "flex items-start gap-2",
                indent === 0 && "pl-1",
                indent === 1 && "pl-5",
                indent >= 2 && "pl-9",
              )}
            >
              <span
                className={cn(
                  "mt-2 shrink-0",
                  indent === 0 && "h-1.5 w-1.5 rounded-full bg-blue-600",
                  indent === 1 &&
                    "h-1.5 w-1.5 rounded-full border border-slate-500 bg-white",
                  indent >= 2 && "h-1.5 w-1.5 bg-slate-400",
                )}
              />
              <div className="min-w-0 flex-1 break-words">{renderSpans(block.spans)}</div>
            </div>
          );
        }

        if (block.type === "ordered") {
          const indent = block.indentLevel ?? 0;
          return (
            <div
              key={idx}
              className={cn(
                "flex items-start gap-2",
                indent === 0 && "pl-1",
                indent === 1 && "pl-5",
                indent >= 2 && "pl-9",
              )}
            >
              <span className="shrink-0 font-semibold text-blue-700">
                {block.orderLabel}
              </span>
              <div className="min-w-0 flex-1 break-words">{renderSpans(block.spans)}</div>
            </div>
          );
        }

        return (
          <p key={idx} className="leading-relaxed break-words">
            {renderSpans(block.spans)}
          </p>
        );
      })}
    </div>
  );
}
