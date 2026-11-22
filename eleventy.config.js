import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";

export default function (eleventyConfig) {
  // Сжатие картинок: все <img> из /assets/uploads превращаются в AVIF/WebP/JPEG нескольких размеров
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["avif", "webp", "jpeg"],
    widths: [640, 1280, 1920, 2560],
    htmlOptions: { imgAttributes: { loading: "lazy", decoding: "async" } },
  });

  eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy({ "src/assets/uploads": "assets/uploads" });
  eleventyConfig.addPassthroughCopy({ "src/admin/config.yml": "admin/config.yml" });
  eleventyConfig.addPassthroughCopy({
    "node_modules/gsap/dist/gsap.min.js": "assets/vendor/gsap.min.js",
    "node_modules/gsap/dist/ScrollTrigger.min.js": "assets/vendor/ScrollTrigger.min.js",
    "node_modules/lenis/dist/lenis.min.js": "assets/vendor/lenis.min.js",
  });

  eleventyConfig.addCollection("services", (api) =>
    api.getFilteredByGlob("src/uslugi/*.md").sort((a, b) => (a.data.order || 0) - (b.data.order || 0)));
  eleventyConfig.addCollection("projects", (api) =>
    api.getFilteredByGlob("src/portfolio/*.md").sort((a, b) => (a.data.order || 0) - (b.data.order || 0)));

  eleventyConfig.addShortcode("year", () => String(new Date().getFullYear()));
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("tel", (s) => String(s).replace(/[^\d+]/g, ""));
  eleventyConfig.addFilter("pad", (n) => String(n).padStart(2, "0"));

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "md", "html", "txt"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
