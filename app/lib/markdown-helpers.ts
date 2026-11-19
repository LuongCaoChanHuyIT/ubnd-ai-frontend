export interface InlineSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export interface MarkdownBlock {
  type:
    | "heading"
    | "bullet"
    | "ordered"
    | "paragraph"
    | "table"
    | "blockquote"
    | "codeblock"
    | "hr";
  level?: 1 | 2 | 3 | 4;
  indentLevel?: number;
  orderLabel?: string;
  language?: string;
  codeText?: string;
  spans: InlineSpan[];
  headers?: InlineSpan[][];
  rows?: InlineSpan[][][];
}

export function formatAssistantModeBadge(mode: string): string {
  switch (mode) {
    case "soan_thao":
      return "SOẠN THẢO";
    case "nghiep_vu":
      return "NGHIỆP VỤ";
    case "tham_dinh":
      return "THẨM ĐỊNH";
    default:
      return mode.toUpperCase();
  }
}

function parseNestedCodeSpans(
  segment: string,
  style: { bold?: boolean; italic?: boolean },
): InlineSpan[] {
  const out: InlineSpan[] = [];
  const codeRegex = /`([^`\n]+)`/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = codeRegex.exec(segment)) !== null) {
    if (m.index > lastIdx) {
      out.push({ text: segment.slice(lastIdx, m.index), ...style });
    }
    out.push({ text: m[1], code: true, ...style });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < segment.length) {
    out.push({ text: segment.slice(lastIdx), ...style });
  }
  return out.length > 0 ? out : [{ text: segment, ...style }];
}

export function parseInlineSpans(line: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const tokenRegex = /(\*\*(?:`[^`\n]+`|[^*])+\*\*|\*(?:`[^`\n]+`|[^*\n])+\*|`[^`\n]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ text: line.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`")) {
      spans.push({ text: token.slice(1, -1), code: true });
    } else if (token.startsWith("**") && token.endsWith("**")) {
      spans.push(...parseNestedCodeSpans(token.slice(2, -2), { bold: true }));
    } else if (token.startsWith("*") && token.endsWith("*")) {
      spans.push(...parseNestedCodeSpans(token.slice(1, -1), { italic: true }));
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) {
    spans.push({ text: line.slice(lastIndex) });
  }

  return spans.length > 0 ? spans : [{ text: line }];
}

function isTableSeparatorLine(trimmed: string): boolean {
  if (!trimmed.includes("|")) return false;
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(trimmed);
}

function isPotentialTableRow(trimmed: string): boolean {
  if (!trimmed.includes("|")) return false;
  const pipeCount = (trimmed.match(/\|/g) ?? []).length;
  return pipeCount >= 2;
}

function splitTableCells(trimmed: string): InlineSpan[][] {
  let clean = trimmed;
  if (clean.startsWith("|")) clean = clean.slice(1);
  if (clean.endsWith("|")) clean = clean.slice(0, -1);
  return clean.split("|").map((cell) => parseInlineSpans(cell.trim()));
}

function computeIndentLevel(rawLine: string): number {
  const leading = /^([ \t]*)/.exec(rawLine)?.[1] ?? "";
  let spaces = 0;
  for (const ch of leading) {
    spaces += ch === "\t" ? 2 : 1;
  }
  return Math.min(3, Math.floor(spaces / 2));
}

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const rawLines = (markdown ?? "").split(/\r?\n/);
  let idx = 0;

  while (idx < rawLines.length) {
    const raw = rawLines[idx] ?? "";
    const trimmed = raw.trim();
    if (!trimmed) {
      idx += 1;
      continue;
    }

    // Fenced code block (```lang ... ```)
    const fenceMatch = /^```([A-Za-z0-9_-]*)\s*$/.exec(trimmed);
    if (fenceMatch) {
      const language = fenceMatch[1] || "text";
      const codeLines: string[] = [];
      idx += 1;
      while (idx < rawLines.length) {
        const currentLine = rawLines[idx] ?? "";
        if (/^```\s*$/.test(currentLine.trim())) {
          idx += 1;
          break;
        }
        codeLines.push(currentLine);
        idx += 1;
      }
      blocks.push({
        type: "codeblock",
        language,
        codeText: codeLines.join("\n"),
        spans: [],
      });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "hr", spans: [] });
      idx += 1;
      continue;
    }

    // Markdown Table (header line + separator line + body rows)
    const nextTrimmed = (rawLines[idx + 1] ?? "").trim();
    if (isPotentialTableRow(trimmed) && isTableSeparatorLine(nextTrimmed)) {
      const headers = splitTableCells(trimmed);
      const rows: InlineSpan[][][] = [];
      idx += 2;
      while (idx < rawLines.length) {
        const rowTrimmed = (rawLines[idx] ?? "").trim();
        if (!rowTrimmed || !isPotentialTableRow(rowTrimmed)) {
          break;
        }
        if (!isTableSeparatorLine(rowTrimmed)) {
          rows.push(splitTableCells(rowTrimmed));
        }
        idx += 1;
      }
      blocks.push({
        type: "table",
        spans: [],
        headers,
        rows,
      });
      continue;
    }

    // Heading (# to ####)
    const headingMatch = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      const level = Math.min(4, Math.max(1, headingMatch[1].length)) as 1 | 2 | 3 | 4;
      blocks.push({
        type: "heading",
        level,
        spans: parseInlineSpans(headingMatch[2]),
      });
      idx += 1;
      continue;
    }

    // Callout / Blockquote (> ...)
    const quoteMatch = /^>\s?(.*)$/.exec(trimmed);
    if (quoteMatch) {
      const quoteParts: string[] = [quoteMatch[1].trim()];
      idx += 1;
      while (idx < rawLines.length) {
        const nextQuote = /^>\s?(.*)$/.exec((rawLines[idx] ?? "").trim());
        if (!nextQuote) break;
        if (nextQuote[1].trim()) {
          quoteParts.push(nextQuote[1].trim());
        }
        idx += 1;
      }
      blocks.push({
        type: "blockquote",
        spans: parseInlineSpans(quoteParts.join(" ")),
      });
      continue;
    }

    // Bullet list (including nested/indented bullets)
    if (/^[-•*]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[-•*]\s+/, "");
      blocks.push({
        type: "bullet",
        indentLevel: computeIndentLevel(raw),
        spans: parseInlineSpans(content),
      });
      idx += 1;
      continue;
    }

    // Numbered list (including nested/indented numbered items)
    const orderedMatch = /^(\d+(?:\.\d+)*[.)])\s+(.*)$/.exec(trimmed);
    if (orderedMatch) {
      blocks.push({
        type: "ordered",
        indentLevel: computeIndentLevel(raw),
        orderLabel: orderedMatch[1],
        spans: parseInlineSpans(orderedMatch[2]),
      });
      idx += 1;
      continue;
    }

    blocks.push({ type: "paragraph", spans: parseInlineSpans(trimmed) });
    idx += 1;
  }

  return blocks;
}
