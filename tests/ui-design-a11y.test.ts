import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseNd30PreviewSections,
  resolveEffectivePaperMode,
  resolveNextPaperModeOnInput,
} from "../app/lib/nd30-paper-helpers.ts";

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

test("Final review fixes: ND30 two-column footer + long commune header, manual typing stability, Radix Tabs a11y, mobile Sheet close contrast, nav-active-pill z-index, global reduced-motion, h1 on /hello-check, and Progress aria-labels", () => {
  // 1. Critical #1: Manual typing into empty DocumentPaperSheet stays in 'edit' mode; empty draft reports 'edit' as effective mode
  assert.equal(resolveEffectivePaperMode("paper", ""), "edit");
  assert.equal(resolveEffectivePaperMode("paper", "   "), "edit");
  assert.equal(resolveEffectivePaperMode("paper", "Nội dung"), "paper");
  assert.equal(resolveNextPaperModeOnInput("paper", "", "U"), "edit");
  assert.equal(resolveNextPaperModeOnInput("edit", "U", "UB"), "edit");
  assert.equal(resolveNextPaperModeOnInput("paper", "Đã có dự thảo", "Đã có dự thảo!"), "paper");

  // 2. Important #2: Long commune name (<3 spaces before motto), line-0 leading space preservation, and two-column Nơi nhận + Signer footer
  const fullNd30 = [
    "ỦY BAN NHÂN DÂN                 CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
    "PHƯỜNG NGUYỄN THÁI BÌNH TRUNG TÂM Độc lập - Tự do - Hạnh phúc",
    "Số: 15/KH-UBND                  Nguyễn Thái Bình, ngày 19 tháng 11 năm 2026",
    "",
    "KẾ HOẠCH",
    "Về việc chuyển đổi số quý IV/2026",
    "",
    "I. MỤC ĐÍCH, YÊU CẦU",
    "Bảo đảm 100% hồ sơ trực tuyến.",
    "",
    "Nơi nhận:                        TM. ỦY BAN NHÂN DÂN",
    "- Như trên;                      CHỦ TỊCH",
    "- Đảng ủy, HĐND (để b/c);",
    "- Lưu: VT, VP.                   (Chữ ký số, đóng dấu)",
    "                                 Nguyễn Văn A",
  ].join("\n");

  const parsedFull = parseNd30PreviewSections(fullNd30);
  assert.equal(parsedFull.hasStructuredHeader, true);
  assert.deepEqual(parsedFull.agencyLines, [
    "ỦY BAN NHÂN DÂN",
    "PHƯỜNG NGUYỄN THÁI BÌNH TRUNG TÂM",
  ]);
  assert.deepEqual(parsedFull.mottoLines, [
    "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
    "Độc lập - Tự do - Hạnh phúc",
  ]);
  assert.deepEqual(parsedFull.recipientLines, [
    "Nơi nhận:",
    "- Như trên;",
    "- Đảng ủy, HĐND (để b/c);",
    "- Lưu: VT, VP.",
  ]);
  assert.deepEqual(parsedFull.signerLines, [
    "TM. ỦY BAN NHÂN DÂN",
    "CHỦ TỊCH",
    "(Chữ ký số, đóng dấu)",
    "Nguyễn Văn A",
  ]);
  assert.ok(!parsedFull.bodyLines.some((l) => l.includes("Nơi nhận:")));

  const indentedFreeform = parseNd30PreviewSections("                CHỦ TỊCH");
  assert.match(indentedFreeform.bodyLines[0], /^\s{12,}CHỦ TỊCH$/);

  // 3. Important #4: DocumentPaperSheet uses Radix Tabs (tabpanel contract) and exposes compound Root/Toolbar/Canvas
  const paperSrc = fs.readFileSync(
    path.join(APP_DIR, "app/components/workspace/nd30-paper.tsx"),
    "utf-8",
  );
  assert.match(paperSrc, /TabsContent/);
  assert.match(paperSrc, /Root:/);
  assert.match(paperSrc, /Toolbar:/);
  assert.match(paperSrc, /Canvas:/);

  // 4. Important #1 & #3: Mobile SheetContent hides default dark Close button and provides accessible Vietnamese SheetClose; nav-active-pill z-index > persistent-nav
  const shellSrc = fs.readFileSync(
    path.join(APP_DIR, "app/components/layout/workspace-shell.tsx"),
    "utf-8",
  );
  assert.match(shellSrc, /showCloseButton=\{false\}/);
  assert.match(shellSrc, /aria-label="Đóng trình đơn điều hướng"/);

  const css = fs.readFileSync(path.join(APP_DIR, "app/app.css"), "utf-8");
  assert.match(css, /::view-transition-group\(\.nav-active-pill\)[\s\S]*?z-index:\s*101/);
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation-duration:\s*0\.01ms\s*!important/,
  );
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition-duration:\s*0\.01ms\s*!important/,
  );

  // 5. Re-graded Important #6: /hello-check h1 + Progress aria-labels in M03 & M06
  const homeSrc = fs.readFileSync(path.join(APP_DIR, "app/routes/home.tsx"), "utf-8");
  assert.match(homeSrc, /<h1\b/);

  const m03Src = fs.readFileSync(
    path.join(APP_DIR, "app/routes/m03-drafting.tsx"),
    "utf-8",
  );
  assert.match(m03Src, /<Progress[^>]*aria-label=/);

  const m06Src = fs.readFileSync(
    path.join(APP_DIR, "app/routes/m06-tasks.tsx"),
    "utf-8",
  );
  assert.match(m06Src, /<Progress[^>]*aria-label=/);
});

test("UI smoothness upgrades: parallel layout loader, shouldRevalidate, prefetch=intent, top progress shimmer, optimistic M01 turn, deferred search, and GPU button transitions", () => {
  const layoutSrc = fs.readFileSync(
    path.join(APP_DIR, "app/routes/workspace-layout.tsx"),
    "utf-8",
  );
  assert.match(layoutSrc, /Promise\.allSettled/);
  assert.match(layoutSrc, /export function shouldRevalidate/);

  const shellSrc = fs.readFileSync(
    path.join(APP_DIR, "app/components/layout/workspace-shell.tsx"),
    "utf-8",
  );
  assert.match(shellSrc, /prefetch="intent"/);
  assert.match(shellSrc, /useNavigation/);
  assert.match(shellSrc, /civic-nav-progress/);

  const btnSrc = fs.readFileSync(
    path.join(APP_DIR, "app/components/ui/button.tsx"),
    "utf-8",
  );
  assert.doesNotMatch(btnSrc, /\btransition-all\b/);
  assert.match(btnSrc, /scale-\[0\.985\]/);

  const cssSrc = fs.readFileSync(path.join(APP_DIR, "app/app.css"), "utf-8");
  assert.match(cssSrc, /\.civic-nav-progress/);
  assert.match(cssSrc, /content-visibility:\s*auto/);

  const m01Src = fs.readFileSync(
    path.join(APP_DIR, "app/routes/m01-assistant.tsx"),
    "utf-8",
  );
  assert.match(m01Src, /pendingUserMessage/);
  assert.match(m01Src, /scrollIntoView/);

  const m06Src = fs.readFileSync(
    path.join(APP_DIR, "app/routes/m06-tasks.tsx"),
    "utf-8",
  );
  assert.match(m06Src, /useDeferredValue/);

  const m07Src = fs.readFileSync(
    path.join(APP_DIR, "app/routes/m07-admin.tsx"),
    "utf-8",
  );
  assert.match(m07Src, /useDeferredValue/);
});
