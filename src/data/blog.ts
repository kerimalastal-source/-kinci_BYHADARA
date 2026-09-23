import { wixImg } from "../utils/image";

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
    coverImage: { src: wixImg("3510f9_ed99943d32b54a2ab74b1ee037c7f6ff~mv2.jpg"), width: 1536, height: 1024 }
  },
  {
    slug: "citizenship-by-real-estate",
    priority: 1,
    coverImage: { src: wixImg("3510f9_e591203fa8754d0b81d6ceb767dd9294~mv2.jpg"), width: 1536, height: 1024 }
  },
  {
    slug: "about-turkey",
    priority: 2,
    coverImage: { src: wixImg("3510f9_adb80b50c1e34bfda6bb8d0e8fee8917~mv2.jpg"), width: 1536, height: 1024 }
  },
  {
    slug: "about-istanbul",
    priority: 3,
    coverImage: { src: wixImg("3510f9_9e50e7444a1e43bdb635d64d68e85ba7~mv2.jpg"), width: 1536, height: 1024 }
  },
  {
    slug: "life-in-turkey",
    priority: 4,
    coverImage: { src: wixImg("3510f9_e5e5940bb1e947a1a1f49bf342f5e2b9~mv2.jpg"), width: 1536, height: 1024 }
  },
  {
    slug: "buying-property-and-tapu",
    priority: 5,
    coverImage: { src: wixImg("3510f9_c175ce66d2c44baa9f8403fab29fc6c8~mv2.jpg"), width: 1536, height: 1024 }
  },
  {
    slug: "taxes-and-tapu-fees",
    priority: 6,
    coverImage: { src: wixImg("3510f9_34189c5d4c234db99e3e802287779d44~mv2.jpg"), width: 1536, height: 1024 }
  },
  {
    slug: "real-estate-valuation",
    priority: 7,
    coverImage: { src: wixImg("3510f9_cafc461c07db477c944827835d7dfdc5~mv2.jpg"), width: 1536, height: 1024 }
  },
  {
    slug: "citizenship-investment-laws",
    priority: 8,
    coverImage: { src: wixImg("3510f9_f3ed874569ac4a549fedf4d0459dbfaf~mv2.jpg"), width: 1536, height: 1024 }
  },
  {
    slug: "real-estate-market-trends",
    priority: 9,
    coverImage: { src: wixImg("3510f9_df7d51c8bf864713ae9086e80694e155~mv2.jpg"), width: 1536, height: 1024 }
  }
];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

export function getSortedBlogPosts(): BlogPost[] {
  return [...blogPosts].sort((a, b) => a.priority - b.priority);
}
