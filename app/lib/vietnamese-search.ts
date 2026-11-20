export function foldVietnamese(text: string): string {
  if (!text) return "";
  return text
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesVietnameseQuery(
  haystack: string,
  query: string,
): boolean {
  const foldedQuery = foldVietnamese(query);
  if (!foldedQuery) return true;
  const foldedHaystack = foldVietnamese(haystack);
  const terms = foldedQuery.split(" ").filter(Boolean);
  return terms.every((term) => foldedHaystack.includes(term));
}

export function isSafeHttpUrl(url: string | null | undefined): boolean {
  const cleaned = (url ?? "").trim();
  if (!cleaned) return false;
  return /^https?:\/\/\S+$/i.test(cleaned);
}
