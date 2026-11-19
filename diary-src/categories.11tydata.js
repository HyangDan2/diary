/**
 * Template data for categories.njk (the Korean-URL drawers).
 * Notes is the only drawer with an English edition at /en/categories/notes/, so it is the
 * only one that gets hreflang alternates. The three English drawers are English at their
 * Korean URL and have no second edition to point at.
 */
export default {
  eleventyComputed: {
    alternateKo: (data) => (data.categoryPage?.slug === "notes" ? `/categories/${data.categoryPage.slug}/` : null),
    alternateEn: (data) => (data.categoryPage?.slug === "notes" ? `/en/categories/${data.categoryPage.slug}/` : null),
  },
};
