import { DEFAULT_CATEGORY, findCategory } from "../lib/categories.js";
import { postSlugFromPath, slugify } from "../lib/utils.js";

/**
 * Applies to every file in posts/. A post only needs frontmatter:
 * title, date, category, summary, tags, layout.
 *
 * A Notes post that also exists in English carries the same `translationKey` as its
 * English edition in en/posts/. That pair is what the KO | EN switch and the
 * <link rel="alternate" hreflang> tags point at; a post without a translation simply
 * has no switch.
 */
export default {
  layout: "post.njk",
  eleventyComputed: {
    postSlug: (data) => postSlugFromPath(data.page.inputPath),
    permalink: (data) => `/posts/${postSlugFromPath(data.page.inputPath)}/`,
    categoryName: (data) => {
      const raw = data.category || DEFAULT_CATEGORY;
      return findCategory(raw)?.name ?? raw;
    },
    categorySlug: (data) => categorySlugOf(data),
    categoryUrl: (data) => `/categories/${categorySlugOf(data)}/`,
    alternateKo: (data) => (englishEdition(data) ? `/posts/${postSlugFromPath(data.page.inputPath)}/` : null),
    alternateEn: (data) => englishEdition(data)?.url ?? null,
    newerPost: (data) => sibling(data, -1),
    olderPost: (data) => sibling(data, 1),
  },
};

function categorySlugOf(data) {
  const raw = data.category || DEFAULT_CATEGORY;
  return findCategory(raw)?.slug ?? (slugify(raw) || slugify(DEFAULT_CATEGORY));
}

/** The English post that shares this post's translationKey, if there is one. */
function englishEdition(data) {
  const key = String(data.translationKey ?? "").trim();
  if (!key) return null;
  return (data.collections?.enDiaryPosts ?? []).find((post) => String(post.data.translationKey ?? "").trim() === key) ?? null;
}

/** Neighbours in the date-descending list of all posts. */
function sibling(data, offset) {
  const posts = data.collections?.diaryPosts ?? [];
  if (!posts.length) return null;
  const url = `/posts/${postSlugFromPath(data.page.inputPath)}/`;
  const index = posts.findIndex((post) => post.url === url);
  if (index === -1) return null;
  return posts[index + offset] ?? null;
}
