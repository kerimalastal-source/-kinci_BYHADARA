
export interface BlogPost {
  slug: string;
  priority: number;
  /** First day on the site (YYYY-MM-DD); `updated` is the last time the text was rewritten. Both feed the
   *  BlogPosting dates in the page data and the sitemap's lastmod. */
  published: string;
  updated?: string;
  /** Project slugs shown in the "Projects you may like" box at the end of the article (sold-out ones are
   *  skipped; without it the first available projects by priority are shown). */
  relatedProjects?: string[];
  coverImage: {
    src: string;
    width: number;
    height: number;
  };
}

export const blogPosts: BlogPost[] = [
  {
    slug: "off-plan-or-ready",
    priority: -2,
    published: "2026-10-07",
    relatedProjects: ["diamond-marin", "beylikduzu-living", "lotus-yali"],
    coverImage: { src: "/images/blog/off-plan-or-ready.jpg", width: 1327, height: 885 }
  },
  {
    slug: "gross-vs-net-area",
    priority: -1,
    published: "2026-10-01",
    relatedProjects: ["beylikduzu-living", "lotus-sisli", "cadde-ispartakule"],
    coverImage: { src: "/images/blog/gross-vs-net-area.jpg", width: 1536, height: 1024 }
  },
  {
    slug: "real-estate-in-turkey",
    priority: 0,
    published: "2026-09-23",
    updated: "2026-10-07",
    relatedProjects: ["beylikduzu-living", "diamond-marin", "lotus-sisli"],
    coverImage: { src: "/images/blog/real-estate-in-turkey.jpg", width: 1536, height: 1024 }
  },
  {
    slug: "citizenship-by-real-estate",
    priority: 1,
    published: "2026-09-23",
    updated: "2026-10-07",
    relatedProjects: ["marmara-haven-villa", "lotus-manzara-guzelce", "diamond-marin"],
    coverImage: { src: "/images/blog/citizenship-by-real-estate.jpg", width: 1536, height: 1024 }
  },
  {
    slug: "about-turkey",
    priority: 2,
    published: "2026-09-23",
    updated: "2026-10-07",
    relatedProjects: ["beylikduzu-living", "lotus-yali", "marmara-haven-villa"],
    coverImage: { src: "/images/blog/about-turkey.jpg", width: 1536, height: 1024 }
  },
  {
    slug: "about-istanbul",
    priority: 3,
    published: "2026-09-23",
    updated: "2026-10-07",
    relatedProjects: ["beylikduzu-living", "lotus-yali", "lotus-sisli"],
    coverImage: { src: "/images/blog/about-istanbul.jpg", width: 1536, height: 1024 }
  },
  {
    slug: "life-in-turkey",
    priority: 4,
    published: "2026-09-23",
    updated: "2026-10-07",
    relatedProjects: ["lotus-manzara-beylikduzu", "lotus-koru-2", "lotus-yali"],
    coverImage: { src: "/images/blog/life-in-turkey.jpg", width: 1536, height: 1024 }
  },
  {
    slug: "buying-property-and-tapu",
    priority: 5,
    published: "2026-09-23",
    updated: "2026-10-07",
    relatedProjects: ["lotus-koru-2", "cadde-ispartakule", "lotus-manzara-guzelce"],
    coverImage: { src: "/images/blog/buying-property-and-tapu.jpg", width: 1536, height: 1024 }
  },
  {
    slug: "taxes-and-tapu-fees",
    priority: 6,
    published: "2026-09-23",
    updated: "2026-10-07",
    relatedProjects: ["lotus-yali", "lotus-koru-2", "beylikduzu-living"],
    coverImage: { src: "/images/blog/taxes-and-tapu-fees.jpg", width: 1536, height: 1024 }
  },
  {
    slug: "real-estate-valuation",
    priority: 7,
    published: "2026-09-23",
    updated: "2026-10-07",
    relatedProjects: ["marmara-haven-villa", "lotus-manzara-beylikduzu", "diamond-marin"],
    coverImage: { src: "/images/blog/real-estate-valuation.jpg", width: 1536, height: 1024 }
  },
  {
    slug: "citizenship-investment-laws",
    priority: 8,
    published: "2026-09-23",
    updated: "2026-10-07",
    relatedProjects: ["marmara-haven-villa", "lotus-sisli", "lotus-manzara-guzelce"],
    coverImage: { src: "/images/blog/citizenship-investment-laws.jpg", width: 1536, height: 1024 }
  },
  {
    slug: "real-estate-market-trends",
    priority: 9,
    published: "2026-09-23",
    updated: "2026-10-07",
    relatedProjects: ["diamond-marin", "beylikduzu-living", "lotus-sisli"],
    coverImage: { src: "/images/blog/real-estate-market-trends.jpg", width: 1536, height: 1024 }
  }
];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

export function getSortedBlogPosts(): BlogPost[] {
  return [...blogPosts].sort((a, b) => a.priority - b.priority);
}
