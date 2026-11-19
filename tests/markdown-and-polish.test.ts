import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAssistantModeBadge,
  parseMarkdownBlocks,
} from "../app/lib/markdown-helpers.ts";

test("formatAssistantModeBadge maps backend mode enums to Vietnamese display badges", () => {
  assert.equal(formatAssistantModeBadge("soan_thao"), "SOẠN THẢO");
  assert.equal(formatAssistantModeBadge("nghiep_vu"), "NGHIỆP VỤ");
  assert.equal(formatAssistantModeBadge("tham_dinh"), "THẨM ĐỊNH");
});

test("parseMarkdownBlocks parses headings, list items, and inline bold/italic segments", () => {
  const md = [
    "### Tư vấn nghiệp vụ · Văn phòng",
    "**Vấn đề:** Kiểm tra *Nghị định 30*",
    "- Bước 1: Tiếp nhận hồ sơ",
    "1. Mục thứ nhất",
  ].join("\n");

  const blocks = parseMarkdownBlocks(md);
  assert.equal(blocks[0].type, "heading");
  assert.equal(blocks[0].spans[0].text, "Tư vấn nghiệp vụ · Văn phòng");

  assert.equal(blocks[1].type, "paragraph");
  assert.ok(blocks[1].spans.some((s) => s.bold && s.text === "Vấn đề:"));
  assert.ok(blocks[1].spans.some((s) => s.italic && s.text === "Nghị định 30"));

  assert.equal(blocks[2].type, "bullet");
  assert.equal(blocks[3].type, "ordered");
});
