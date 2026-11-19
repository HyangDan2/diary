import { DEFAULT_CATEGORY, findCategory } from "../../lib/categories.js";
import { postSlugFromPath, slugify } from "../../lib/utils.js";

/**
 * Applies to every file in en/posts/ — the English editions of the Notes posts.
 *
 * The file name matches its Korean original, so the slug is shared and the two
 * editions only differ by the /en/ prefix: /posts/<slug>/ and /en/posts/<slug>/.
 * `translationKey` is the link back to the Korean post; it drives the KO | EN switch
 * and the hreflang tags. Nothing here ends up in the home page, the Korean drawers or
 * /search.json — those read the `diaryPosts` collection, which only globs posts/.
 */
export default {
  layout: "post.njk",
  lang: "en",
  eleventyComputed: {
    postSlug: (data) => postSlugFromPath(data.page.inputPath),
    permalink: (data) => `/en/posts/${postSlugFromPath(data.page.inputPath)}/`,
    categoryName: (data) => {
      const raw = data.category || DEFAULT_CATEGORY;
      return findCategory(raw)?.name ?? raw;
    },
    categorySlug: (data) => categorySlugOf(data),
    categoryUrl: (data) => `/en/categories/${categorySlugOf(data)}/`,
    alternateEn: (data) => `/en/posts/${postSlugFromPath(data.page.inputPath)}/`,
    alternateKo: (data) => koreanEdition(data)?.url ?? null,
    newerPost: (data) => sibling(data, -1),
    olderPost: (data) => sibling(data, 1),
  },
};

function categorySlugOf(data) {
  const raw = data.category || DEFAULT_CATEGORY;
  return findCategory(raw)?.slug ?? (slugify(raw) || slugify(DEFAULT_CATEGORY));
}

/** The Korean post this translation came from, found by translationKey. */
function koreanEdition(data) {
  const key = String(data.translationKey ?? "").trim();
  if (!key) return null;
  return (data.collections?.diaryPosts ?? []).find((post) => String(post.data.translationKey ?? "").trim() === key) ?? null;
}

/** Neighbours in the date-descending list of English posts. */
function sibling(data, offset) {
  const posts = data.collections?.enDiaryPosts ?? [];
  if (!posts.length) return null;
  const url = `/en/posts/${postSlugFromPath(data.page.inputPath)}/`;
  const index = posts.findIndex((post) => post.url === url);
  if (index === -1) return null;
  return posts[index + offset] ?? null;
}
