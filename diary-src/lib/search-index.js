/**
 * Build-time helpers for /search.json — the tiny index the diary's own search box reads.
 *
 * The index holds only what a reader would type: the title, the summary, the category,
 * the tags, the date and a "keywords" blob made of the post's subheadings plus the
 * opening of its body text. No full text is shipped; the whole file stays a few KB.
 */

/** Drop the YAML frontmatter block at the top of a post. */
export function stripFrontmatter(source = "") {
  return String(source).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

/** Markdown -> one line of plain words (code blocks are dropped, link text is kept). */
export function toPlainText(markdown = "") {
  return String(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}(?:[-*+]\s+|\d+\.\s+)/gm, " ")
    .replace(/^\s{0,3}>\s?/gm, " ")
    .replace(/^\s{0,3}\|.*$/gm, (line) => line.replace(/\|/g, " "))
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Subheadings + the opening of the body, so a search for "함정" or "비교" finds the
 * post that talks about it even when the word never appears in the title or summary.
 */
export function extractKeywords(markdown = "", { headings = 40, bodyChars = 320 } = {}) {
  const body = stripFrontmatter(markdown);
  const headingText = [...body.matchAll(/^#{1,6}\s+(.+)$/gm)]
    .map((match) => match[1].replace(/[`*_#>]/g, "").trim())
    .filter(Boolean)
    .slice(0, headings)
    .join(" · ");
  const lead = toPlainText(body).slice(0, bodyChars);
  return [headingText, lead].filter(Boolean).join(" ");
}

/** Frontmatter tags can be a YAML list or a comma separated string. */
export function normalizeTags(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}
