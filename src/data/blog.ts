
export interface BlogPost {
  slug: string;
  priority: number;
  coverImage: {
    src: string;
    width: number;
    height: number;
  };
}

export const blogPosts: BlogPost[] = [
  {
    slug: "real-estate-in-turkey",
    priority: 0,
    coverImage: { src: "/images/blog/real-estate-in-turkey.jpg", width: 200, height: 133 }
  },
  {
    slug: "citizenship-by-real-estate",
    priority: 1,
    coverImage: { src: "/images/blog/citizenship-by-real-estate.jpg", width: 200, height: 133 }
  },
  {
    slug: "about-turkey",
    priority: 2,
    coverImage: { src: "/images/blog/about-turkey.jpg", width: 200, height: 133 }
  },
  {
    slug: "about-istanbul",
    priority: 3,
    coverImage: { src: "/images/blog/about-istanbul.jpg", width: 200, height: 133 }
  },
  {
    slug: "life-in-turkey",
    priority: 4,
    coverImage: { src: "/images/blog/life-in-turkey.jpg", width: 200, height: 133 }
  },
  {
    slug: "buying-property-and-tapu",
    priority: 5,
    coverImage: { src: "/images/blog/buying-property-and-tapu.jpg", width: 200, height: 133 }
  },
  {
    slug: "taxes-and-tapu-fees",
    priority: 6,
    coverImage: { src: "/images/blog/taxes-and-tapu-fees.jpg", width: 200, height: 133 }
  },
  {
    slug: "real-estate-valuation",
    priority: 7,
    coverImage: { src: "/images/blog/real-estate-valuation.jpg", width: 200, height: 133 }
  },
  {
    slug: "citizenship-investment-laws",
    priority: 8,
    coverImage: { src: "/images/blog/citizenship-investment-laws.jpg", width: 200, height: 133 }
  },
  {
    slug: "real-estate-market-trends",
    priority: 9,
    coverImage: { src: "/images/blog/real-estate-market-trends.jpg", width: 200, height: 133 }
  }
];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

export function getSortedBlogPosts(): BlogPost[] {
  return [...blogPosts].sort((a, b) => a.priority - b.priority);
}
