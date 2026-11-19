/**
 * Template data for en/categories.njk — every drawer built here has a Korean original at
 * /categories/<slug>/, so both alternates exist.
 */
export default {
  eleventyComputed: {
    alternateKo: (data) => (data.categoryPage ? `/categories/${data.categoryPage.slug}/` : null),
    alternateEn: (data) => (data.categoryPage ? `/en/categories/${data.categoryPage.slug}/` : null),
  },
};
