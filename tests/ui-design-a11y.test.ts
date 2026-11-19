import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseNd30PreviewSections } from "../app/lib/nd30-paper-helpers.ts";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("app.css defines Vietnamese civic tokens, View Transition recipes, reduced-motion guard, and drops unused Geist CSS", () => {
  const css = fs.readFileSync(path.join(APP_DIR, "app/app.css"), "utf-8");
  assert.doesNotMatch(css, /@fontsource-variable\/geist/);
  assert.doesNotMatch(css, /transition\s*:\s*all/);
  assert.match(css, /#0C1E35/i);
  assert.match(css, /#1B4D89/i);
  assert.match(css, /#B45309/i);
  assert.match(css, /#FCFBF7/i);
  assert.match(css, /--font-serif/);
  assert.match(css, /\.nav-active-pill/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("root.tsx loads Be Vietnam Pro + Noto Serif with display=swap, sets theme-color, and localizes ErrorBoundary", () => {
  const rootSrc = fs.readFileSync(path.join(APP_DIR, "app/root.tsx"), "utf-8");
  assert.match(rootSrc, /Be\+Vietnam\+Pro/);
  assert.match(rootSrc, /Noto\+Serif/);
  assert.match(rootSrc, /display=swap/);
  assert.match(rootSrc, /name="theme-color"\s+content="#0C1E35"/);
  assert.doesNotMatch(rootSrc, /Oops!|An unexpected error occurred\./);
  assert.match(rootSrc, /Quay về trang làm việc chính/);
});

test("parseNd30PreviewSections splits two-column ND30 headers cleanly and preserves freeform fallback text", () => {
  const sample = [
    "ỦY BAN NHÂN DÂN                 CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
    "PHƯỜNG HÒA XUÂN                 Độc lập - Tự do - Hạnh phúc",
    "Số: .../QĐ-UBND                 Hòa Xuân, ngày 18 tháng 11 năm 2026",
    "",
    "QUYẾT ĐỊNH",
    "Về việc thành lập Tổ công tác chuyển đổi số",
    "",
    "Điều 1. Thành lập Tổ công tác.",
  ].join("\n");

  const parsed = parseNd30PreviewSections(sample);
  assert.equal(parsed.hasStructuredHeader, true);
  assert.deepEqual(parsed.agencyLines, ["ỦY BAN NHÂN DÂN", "PHƯỜNG HÒA XUÂN"]);
  assert.deepEqual(parsed.mottoLines, [
    "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
    "Độc lập - Tự do - Hạnh phúc",
  ]);
  assert.equal(parsed.symbolLine, "Số: .../QĐ-UBND");
  assert.equal(parsed.datePlaceLine, "Hòa Xuân, ngày 18 tháng 11 năm 2026");
  assert.ok(parsed.bodyLines.some((l) => l.includes("QUYẾT ĐỊNH")));
  assert.ok(parsed.bodyLines.some((l) => l.includes("Điều 1.")));

  const freeform = parseNd30PreviewSections("Nội dung ghi chú nhanh không có tiêu ngữ.");
  assert.equal(freeform.hasStructuredHeader, false);
  assert.deepEqual(freeform.bodyLines, ["Nội dung ghi chú nhanh không có tiêu ngữ."]);

  const empty = parseNd30PreviewSections("");
  assert.equal(empty.hasStructuredHeader, false);
  assert.deepEqual(empty.bodyLines, []);
});

test("WorkspaceShell & home.tsx satisfy skip-link, aria-label, aria-current, desktop-only named VT, and tabular-nums", () => {
  const shellSrc = fs.readFileSync(
    path.join(APP_DIR, "app/components/layout/workspace-shell.tsx"),
    "utf-8",
  );
  assert.match(shellSrc, /href="#main-workspace"/);
  assert.match(shellSrc, /id="main-workspace"/);
  assert.match(shellSrc, /aria-label="Mở trình đơn điều hướng"/);
  assert.match(shellSrc, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(shellSrc, /viewTransition/);
  assert.match(shellSrc, /variant === "desktop"/);
  assert.match(shellSrc, /CivicCrest/);

  const homeSrc = fs.readFileSync(path.join(APP_DIR, "app/routes/home.tsx"), "utf-8");
  assert.match(homeSrc, /CivicCrest/);
  assert.match(homeSrc, /tabular-nums/);
  assert.doesNotMatch(homeSrc, /\.\.\./);
});

test("M01-M07 routes use ModuleHeader, ND30 paper sheet, MetricStrip, safe ViewTransition reveals, and WCAG/WIG rules", () => {
  const routeFiles = [
    "m01-assistant.tsx",
    "m02-extended.tsx",
    "m03-drafting.tsx",
    "m04-official-docs.tsx",
    "m05-doc-session.tsx",
    "m06-tasks.tsx",
    "m07-admin.tsx",
  ];

  const sources: Record<string, string> = {};
  for (const file of routeFiles) {
    const src = fs.readFileSync(path.join(APP_DIR, "app/routes", file), "utf-8");
    sources[file] = src;

    assert.doesNotMatch(
      src,
      /\btransition-all\b/,
      `${file} must not use transition-all`,
    );
    assert.doesNotMatch(
      src,
      /"[^"\n]*\.\.\.[^"\n]*"/,
      `${file} must use typographic ellipsis (…) instead of ASCII ... in string literals`,
    );
    assert.match(
      src,
      /ModuleHeader/,
      `${file} must compose ModuleHeader for consistent civic hierarchy`,
    );
  }

  assert.match(sources["m01-assistant.tsx"], /htmlFor="m01-prompt-input"/);
  assert.match(sources["m01-assistant.tsx"], /aria-live="polite"/);

  assert.match(sources["m03-drafting.tsx"], /DocumentPaperSheet/);
  assert.match(sources["m03-drafting.tsx"], /tabular-nums/);

  assert.match(sources["m04-official-docs.tsx"], /tabular-nums/);
  assert.match(sources["m04-official-docs.tsx"], /font-serif/);

  assert.match(sources["m05-doc-session.tsx"], /tabular-nums/);
  assert.match(sources["m05-doc-session.tsx"], /aria-live="polite"/);

  assert.match(sources["m06-tasks.tsx"], /MetricStrip/);
  assert.match(sources["m06-tasks.tsx"], /tabular-nums/);

  const m07SpellCheckMatches =
    sources["m07-admin.tsx"].match(/spellCheck=\{false\}/g) ?? [];
  assert.ok(
    m07SpellCheckMatches.length >= 5,
    "m07-admin.tsx must set spellCheck={false} on email, URL, model, API key, and tenant admin inputs",
  );
  assert.match(sources["m07-admin.tsx"], /aria-live="polite"/);
  assert.match(sources["m07-admin.tsx"], /tabular-nums/);

  for (const vtRoute of [
    "m01-assistant.tsx",
    "m02-extended.tsx",
    "m03-drafting.tsx",
    "m05-doc-session.tsx",
  ]) {
    const src = sources[vtRoute];
    const vtTags = src.match(/<ViewTransition\b[^>]*>/g) ?? [];
    assert.ok(vtTags.length >= 1, `${vtRoute} must use <ViewTransition>`);
    assert.match(src, /\bstartTransition\b/, `${vtRoute} must trigger reveals via startTransition`);
    for (const tag of vtTags) {
      assert.match(
        tag,
        /default="none"/,
        `${vtRoute} <ViewTransition> tag must include default="none": ${tag}`,
      );
    }
  }
});
