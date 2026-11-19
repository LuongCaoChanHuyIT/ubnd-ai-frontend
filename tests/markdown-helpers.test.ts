import test from "node:test";
import assert from "node:assert/strict";
import {
  parseInlineSpans,
  parseMarkdownBlocks,
} from "../app/lib/markdown-helpers.ts";

test("parseInlineSpans parses bold, italic, and inline code spans cleanly", () => {
  const spans = parseInlineSpans(
    "Đối chiếu `399/2026/NĐ-CP` với **Luật Đất đai** (*Điều 235*).",
  );
  assert.ok(spans.some((s) => s.code && s.text === "399/2026/NĐ-CP"));
  assert.ok(spans.some((s) => s.bold && s.text === "Luật Đất đai"));
  assert.ok(spans.some((s) => s.italic && s.text === "Điều 235"));
});

test("parseMarkdownBlocks parses GFM Markdown tables with headers and rows", () => {
  const md = [
    "### Bảng đối chiếu sai lệch hồ sơ",
    "| Tiêu chí | Tờ khai (Tệp 1) | Thực địa (Tệp 2) | Nhận định |",
    "| :--- | :---: | :---: | :--- |",
    "| Diện tích | `120 m2` | **145 m2** | Chênh lệch +25 m2 |",
    "| Thửa đất | Số 42 | Số 45 | Cần xác minh lại |",
  ].join("\n");

  const blocks = parseMarkdownBlocks(md);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, "heading");
  assert.equal(blocks[0].level, 3);

  const table = blocks[1];
  assert.equal(table.type, "table");
  assert.ok(table.headers);
  assert.ok(table.rows);
  assert.equal(table.headers.length, 4);
  assert.equal(table.headers[0][0].text, "Tiêu chí");
  assert.equal(table.rows.length, 2);
  assert.ok(table.rows[0][1].some((s) => s.code && s.text === "120 m2"));
  assert.ok(table.rows[0][2].some((s) => s.bold && s.text === "145 m2"));
});

test("parseMarkdownBlocks parses nested bullet/numbered lists and callout blockquotes", () => {
  const md = [
    "- Hồ sơ chính:",
    "  - Mốc ngày tháng: `10/11/2026`",
    "    - Chi tiết phụ lục",
    "1. Bước thẩm tra",
    "  1. Kiểm tra bản gốc",
    "> **Lưu ý:** Cán bộ chuyên trách cần đối chiếu thực địa trước khi trình ký.",
  ].join("\n");

  const blocks = parseMarkdownBlocks(md);
  assert.equal(blocks[0].type, "bullet");
  assert.equal(blocks[0].indentLevel, 0);
  assert.equal(blocks[1].type, "bullet");
  assert.equal(blocks[1].indentLevel, 1);
  assert.equal(blocks[2].type, "bullet");
  assert.equal(blocks[2].indentLevel, 2);

  assert.equal(blocks[3].type, "ordered");
  assert.equal(blocks[3].indentLevel, 0);
  assert.equal(blocks[4].type, "ordered");
  assert.equal(blocks[4].indentLevel, 1);

  assert.equal(blocks[5].type, "blockquote");
  assert.ok(blocks[5].spans.some((s) => s.bold && s.text === "Lưu ý:"));
});

test("parseMarkdownBlocks parses fenced code blocks without leaking triple backticks and preserves nested code inside bold", () => {
  const md = [
    "### Dự thảo soạn thảo nhanh",
    "```text",
    "ỦY BAN NHÂN DÂN          CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
    "XÃ, PHƯỜNG TRUNG TÂM           Độc lập - Tự do - Hạnh phúc",
    "```",
    "- ⚠️ Phát hiện **3 trường thông tin `[SAI LỆCH - CẦN XÁC MINH]`** trong hồ sơ.",
  ].join("\n");

  const blocks = parseMarkdownBlocks(md);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[1].type, "codeblock");
  assert.equal(blocks[1].language, "text");
  assert.match(blocks[1].codeText ?? "", /CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/);
  assert.doesNotMatch(blocks[1].codeText ?? "", /```/);

  // Nested inline code inside **...** must have zero raw backticks
  const bulletSpans = blocks[2].spans;
  assert.ok(bulletSpans.every((s) => !s.text.includes("`")));
  assert.ok(
    bulletSpans.some(
      (s) => s.code && s.bold && s.text === "[SAI LỆCH - CẦN XÁC MINH]",
    ),
  );
});
