export interface Nd30PreviewSections {
  hasStructuredHeader: boolean;
  agencyLines: string[];
  mottoLines: string[];
  symbolLine: string;
  datePlaceLine: string;
  bodyLines: string[];
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

export function parseNd30PreviewSections(rawText: string): Nd30PreviewSections {
  const normalized = (rawText ?? "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return {
      hasStructuredHeader: false,
      agencyLines: [],
      mottoLines: [],
      symbolLine: "",
      datePlaceLine: "",
      bodyLines: [],
    };
  }

  const lines = normalized.split("\n");
  const firstSplit = lines[0] ? splitTwoColumnLine(lines[0]) : null;
  const secondSplit = lines[1] ? splitTwoColumnLine(lines[1]) : null;

  const isQuocHieu =
    firstSplit !== null &&
    /CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/i.test(firstSplit[1]);

  if (!isQuocHieu || !firstSplit) {
    return {
      hasStructuredHeader: false,
      agencyLines: [],
      mottoLines: [],
      symbolLine: "",
      datePlaceLine: "",
      bodyLines: lines,
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

  return {
    hasStructuredHeader: true,
    agencyLines,
    mottoLines,
    symbolLine,
    datePlaceLine,
    bodyLines: lines.slice(cursor),
  };
}
