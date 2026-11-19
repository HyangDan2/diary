/**
 * /en/search.json — the English edition's own small index.
 *
 * The diary-wide /search.json lists Korean and English posts together (it is what the
 * home page and the Korean drawers search). This file holds only the English editions,
 * so the search box on /en/categories/<slug>/ filters exactly the rows on that page and
 * never reports a Korean post it cannot show.
 *
 * Shape: the same as /search.json — { generated, count, posts: [...] } — with the
 * `lang` field always "en".
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractKeywords, normalizeTags } from "../lib/search-index.js";
import { displayDate, htmlDate } from "../lib/utils.js";

const sourceRoot = fileURLToPath(new URL("../", import.meta.url));

function keywordsFor(inputPath) {
  if (!inputPath) return "";
  const relative = String(inputPath).replace(/^\.\//, "");
  try {
    return extractKeywords(readFileSync(join(sourceRoot, relative), "utf8"));
  } catch {
    return "";
  }
}

export default class EnSearchIndex {
  data() {
    return {
      permalink: "/en/search.json",
      eleventyExcludeFromCollections: true,
    };
  }

  render({ collections }) {
    const posts = (collections?.enDiaryPosts ?? []).map((post) => ({
      title: post.data.title ?? "",
      summary: post.data.summary ?? "",
      category: post.data.category ?? "",
      categoryLabel: post.data.categoryName ?? post.data.category ?? "",
      categorySlug: post.data.categorySlug ?? "",
      tags: normalizeTags(post.data.tags),
      lang: "en",
      date: htmlDate(post.date),
      dateLabel: displayDate(post.date),
      url: post.url,
      keywords: keywordsFor(post.page?.inputPath),
    }));

    return JSON.stringify({
      generated: new Date().toISOString(),
      count: posts.length,
      posts,
    });
  }
}
