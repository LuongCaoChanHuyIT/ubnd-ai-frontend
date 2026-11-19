export type PaperViewMode = "paper" | "edit";

export interface Nd30PreviewSections {
  hasStructuredHeader: boolean;
  agencyLines: string[];
  mottoLines: string[];
  symbolLine: string;
  datePlaceLine: string;
  bodyLines: string[];
  recipientLines: string[];
  signerLines: string[];
}

export function resolveEffectivePaperMode(
  mode: PaperViewMode,
  value: string,
): PaperViewMode {
  return (value ?? "").trim().length > 0 ? mode : "edit";
}

export function resolveNextPaperModeOnInput(
  currentMode: PaperViewMode,
  prevValue: string,
  nextValue: string,
): PaperViewMode {
  if ((prevValue ?? "").trim().length === 0 && (nextValue ?? "").trim().length > 0) {
    return "edit";
  }
  return currentMode;
}

function splitTwoColumnLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s{3,}/);
  if (parts.length >= 2) {
    return [parts[0].trim(), parts.slice(1).join(" ").trim()];
  }
  return null;
}

function splitSecondHeaderLine(line: string): [string, string] | null {
  const std = splitTwoColumnLine(line);
  if (std) return std;
  const mottoMatch = line
    .trim()
    .match(/^(.*?)\s+(Độc lập\s*-\s*Tự do\s*-\s*Hạnh phúc)\s*$/i);
  if (mottoMatch && mottoMatch[1].trim()) {
    return [mottoMatch[1].trim(), mottoMatch[2].trim()];
  }
  return null;
}

function extractFooterColumns(lines: string[]): {
  bodyLines: string[];
  recipientLines: string[];
  signerLines: string[];
} {
  const footerStart = lines.findIndex((l) => /^Nơi nhận\s*:/i.test(l.trim()));
  if (footerStart === -1) {
    return { bodyLines: lines, recipientLines: [], signerLines: [] };
  }

  const bodyLines = [...lines.slice(0, footerStart)];
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") {
    bodyLines.pop();
  }

  const recipientLines: string[] = [];
  const signerLines: string[] = [];

  for (const rawLine of lines.slice(footerStart)) {
    if (!rawLine.trim()) continue;
    const cols = splitTwoColumnLine(rawLine);
    if (cols) {
      if (cols[0]) recipientLines.push(cols[0]);
      if (cols[1]) signerLines.push(cols[1]);
    } else if (/^\s{12,}/.test(rawLine)) {
      signerLines.push(rawLine.trim());
    } else {
      recipientLines.push(rawLine.trim());
    }
  }

  return { bodyLines, recipientLines, signerLines };
}

export function parseNd30PreviewSections(rawText: string): Nd30PreviewSections {
  const normalized = (rawText ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/^\n+|\s+$/g, "");
  if (!normalized.trim()) {
    return {
      hasStructuredHeader: false,
      agencyLines: [],
      mottoLines: [],
      symbolLine: "",
      datePlaceLine: "",
      bodyLines: [],
      recipientLines: [],
      signerLines: [],
    };
  }

  const lines = normalized.split("\n");
  const firstSplit = lines[0] ? splitTwoColumnLine(lines[0]) : null;
  const secondSplit = lines[1] ? splitSecondHeaderLine(lines[1]) : null;

  const isQuocHieu =
    firstSplit !== null &&
    /CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/i.test(firstSplit[1]);

  if (!isQuocHieu || !firstSplit) {
    const extracted = extractFooterColumns(lines);
    return {
      hasStructuredHeader: false,
      agencyLines: [],
      mottoLines: [],
      symbolLine: "",
      datePlaceLine: "",
      bodyLines: extracted.bodyLines,
      recipientLines: extracted.recipientLines,
      signerLines: extracted.signerLines,
    };
  }

  const agencyLines = [firstSplit[0]];
  const mottoLines = [firstSplit[1]];
  let cursor = 1;

  if (secondSplit) {
    agencyLines.push(secondSplit[0]);
    mottoLines.push(secondSplit[1]);
    cursor = 2;
  }

  let symbolLine = "";
  let datePlaceLine = "";
  if (cursor < lines.length) {
    const thirdSplit = splitTwoColumnLine(lines[cursor]);
    if (thirdSplit && (/^Số:/i.test(thirdSplit[0]) || /ngày\s+\d+/i.test(thirdSplit[1]))) {
      symbolLine = thirdSplit[0];
      datePlaceLine = thirdSplit[1];
      cursor += 1;
    } else if (/^Số:/i.test(lines[cursor].trim())) {
      symbolLine = lines[cursor].trim();
      cursor += 1;
    }
  }

  while (cursor < lines.length && lines[cursor].trim() === "") {
    cursor += 1;
  }

  const extracted = extractFooterColumns(lines.slice(cursor));

  return {
    hasStructuredHeader: true,
    agencyLines,
    mottoLines,
    symbolLine,
    datePlaceLine,
    bodyLines: extracted.bodyLines,
    recipientLines: extracted.recipientLines,
    signerLines: extracted.signerLines,
  };
}
