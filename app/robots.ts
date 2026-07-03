import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/qr-code", "/api/"],
    },
    sitemap: "https://hjhportfolio.com/sitemap.xml",
  };
}
