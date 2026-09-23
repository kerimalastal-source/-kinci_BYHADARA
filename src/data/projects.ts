import { wixImg } from "../utils/image";

export type ProjectStatus = "new-launch" | "ongoing" | "delivered";

export interface ProjectImage {
  src: string;
  width: number;
  height: number;
  alt: string;
}

export interface ProjectStat {
  value: string;
  labelKey: string;
}

export interface Project {
  slug: string;
  district: string;
  city: string;
  status: ProjectStatus;
  timeline: string;
  priority: number;
  coverImage: ProjectImage;
  gallery: ProjectImage[];
  stats: ProjectStat[];
}

export const projects: Project[] = [
  {
    slug: "beylikduzu-living",
    district: "Beylikdüzü",
    city: "Istanbul",
    status: "new-launch",
    timeline: "2026 – 2028",
    priority: 0,
    coverImage: {
      src: wixImg("3510f9_6cd2110b3f8148e7a91be907edf8a395~mv2.jpg"),
      width: 3000,
      height: 1688,
      alt: "Beylikduzu Living exterior render"
    },
    gallery: [
      { src: wixImg("3510f9_98b186e70a2a458c83ea36c8ecf76110~mv2.jpg"), width: 3000, height: 1688, alt: "Beylikduzu Living facade" },
      { src: wixImg("3510f9_a5e66c9abff646e78644e85c5f864074~mv2.jpg"), width: 3000, height: 1688, alt: "Beylikduzu Living exterior angle" },
      { src: wixImg("3510f9_93e972a0e25c41c99258e04a712620c4~mv2.jpg"), width: 3000, height: 1696, alt: "Beylikduzu Living building view" },
      { src: wixImg("3510f9_46fa5d6cf46c46b2a51a61a859bb4d53~mv2.jpg"), width: 3000, height: 1687, alt: "Beylikduzu Living balcony view" },
      { src: wixImg("3510f9_b760238922074b138f2d8e9f06dfc3e4~mv2.jpg"), width: 3000, height: 1938, alt: "Beylikduzu Living evening render" },
      { src: wixImg("3510f9_5d4e8280e0c84c8e8d5d4eb541b399ab~mv2.png"), width: 2800, height: 2200, alt: "Beylikduzu Living living room" },
      { src: wixImg("3510f9_2fb2a0e27bfe46c6a3e0d2fef0487966~mv2.png"), width: 2800, height: 2200, alt: "Beylikduzu Living kitchen" },
      { src: wixImg("3510f9_138f38664e7149c692279cdef485dfae~mv2.png"), width: 3000, height: 2600, alt: "Beylikduzu Living bathroom" }
    ],
    stats: [
      { value: "21,000 m²", labelKey: "landArea" },
      { value: "2028", labelKey: "delivery" }
    ]
  },
  {
    slug: "lotus-koru-2",
    district: "Beylikdüzü",
    city: "Istanbul",
    status: "ongoing",
    timeline: "2023 – 2025",
    priority: 1,
    coverImage: {
      src: wixImg("3510f9_d33ff747ef4d4e1f8bdd85a35fa6d2f5~mv2.jpg"),
      width: 1733,
      height: 1000,
      alt: "Lotus Koru 2 landscaped grounds"
    },
    gallery: [
      { src: wixImg("3510f9_e15d992eba2e4dafa2398a6b75bb25ec~mv2.jpg"), width: 1500, height: 1000, alt: "Lotus Koru 2 urban living concept" },
      { src: wixImg("3510f9_358bbb9965fe42dd986348fd165c1bc9~mv2.jpg"), width: 1733, height: 1000, alt: "Lotus Koru 2 central location" },
      { src: wixImg("3510f9_1ce5b4bad8084ed084ecbd9ce23edd7b~mv2.jpeg"), width: 1600, height: 1133, alt: "Lotus Koru 2 residential blocks" }
    ],
    stats: [
      { value: "204", labelKey: "apartments" },
      { value: "13 × 5", labelKey: "blocksFloors" },
      { value: "40,000 m²", labelKey: "constructionArea" },
      { value: "17,500 m²", labelKey: "greenAndParkArea" }
    ]
  },
  {
    slug: "lotus-istanbul",
    district: "Beylikdüzü",
    city: "Istanbul",
    status: "ongoing",
    timeline: "2022 – 2024",
    priority: 2,
    coverImage: {
      src: wixImg("3510f9_90db09f48bde445098eb3dd251a09da1~mv2.jpeg"),
      width: 1707,
      height: 1280,
      alt: "Lotus Istanbul mixed-use development"
    },
    gallery: [
      { src: wixImg("3510f9_9633582539ad473685a43de656ba6faa~mv2.jpg"), width: 1677, height: 1000, alt: "Lotus Istanbul premium mixed-use project" },
      { src: wixImg("3510f9_dfaf26e5b1744a45a788e155ff70cab6~mv2.jpg"), width: 2000, height: 1287, alt: "Lotus Istanbul iconic urban development" },
      { src: wixImg("3510f9_57734070697e4e2794b0e1fe62f6f3f8~mv2.jpg"), width: 1494, height: 1000, alt: "Lotus Istanbul luxury living concept" },
      { src: wixImg("3510f9_c849d57c16a04fb3a75873f19255e8bc~mv2.jpg"), width: 2000, height: 1333, alt: "Lotus Istanbul modern mixed-use landmark" },
      { src: wixImg("3510f9_830eb2ea0530466dbf9252685140c491~mv2.jpg"), width: 2000, height: 1333, alt: "Lotus Istanbul exclusive investment opportunity" },
      { src: wixImg("3510f9_27e6044b26614e799fae79a347efe773~mv2.jpeg"), width: 1707, height: 1280, alt: "Lotus Istanbul contemporary urban project" }
    ],
    stats: [
      { value: "102", labelKey: "offices" },
      { value: "62", labelKey: "apartments" },
      { value: "47", labelKey: "shops" }
    ]
  },
  {
    slug: "lotus-koru-1",
    district: "Beylikdüzü",
    city: "Istanbul",
    status: "delivered",
    timeline: "2022 – 2024",
    priority: 3,
    coverImage: {
      src: wixImg("3510f9_0e541a01b4db4c90aaa21e2f1bcea687~mv2.jpeg"),
      width: 1600,
      height: 923,
      alt: "Lotus Koru 1 residential exterior"
    },
    gallery: [
      { src: wixImg("3510f9_edbdee8ad770462fb853a8730c094518~mv2.jpg"), width: 2000, height: 1333, alt: "Lotus Koru 1 low-rise residential concept" },
      { src: wixImg("3510f9_ad7dc0dc93a74625a1542c2cad01ebcd~mv2.jpeg"), width: 2000, height: 1462, alt: "Lotus Koru 1 green living project" },
      { src: wixImg("3510f9_5da11f8697ff4b1cbb8ac3763d35bce1~mv2.jpeg"), width: 2000, height: 1429, alt: "Lotus Koru 1 nature-inspired residences" },
      { src: wixImg("3510f9_af156a90b5d44ce29d99a67e19be43c1~mv2.jpeg"), width: 1600, height: 1142, alt: "Lotus Koru 1 landscape-focused housing" },
      { src: wixImg("3510f9_fce46be4de0143468e889189ad57107f~mv2.jpeg"), width: 1600, height: 800, alt: "Lotus Koru 1 green-focused residential project" },
      { src: wixImg("3510f9_5f818f66eee54ae7a89c51be664b9c6f~mv2.jpeg"), width: 1600, height: 1142, alt: "Lotus Koru 1 modern green community" }
    ],
    stats: [
      { value: "144", labelKey: "apartments" },
      { value: "5", labelKey: "floors" }
    ]
  },
  {
    slug: "marmara-haven-villa",
    district: "Büyükçekmece",
    city: "Istanbul",
    status: "ongoing",
    timeline: "2024 – 2025",
    priority: 4,
    coverImage: {
      src: wixImg("3510f9_b3632c1bd958497eaf5bdf465b99b197~mv2.jpeg"),
      width: 1200,
      height: 1600,
      alt: "Marmara Haven Villa exterior facade"
    },
    gallery: [
      { src: wixImg("3510f9_7c18d7b91a814c0ea70edccacf0f8c3e~mv2.jpeg"), width: 2000, height: 1500, alt: "Marmara Haven Villa main facade" },
      { src: wixImg("3510f9_a0832cb474b941bb96c1ab41ce532e75~mv2.jpeg"), width: 1500, height: 2000, alt: "Marmara Haven Villa side view" },
      { src: wixImg("3510f9_c4e14f77b98144a59013aca49d0e7c40~mv2.jpeg"), width: 1500, height: 2000, alt: "Marmara Haven Villa private pool" },
      { src: wixImg("3510f9_9d3cbcac812a48f0b36fb38d5613aaaa~mv2.jpeg"), width: 1500, height: 2000, alt: "Marmara Haven Villa living room" },
      { src: wixImg("3510f9_d65530e758bc4bddb028ea568bfe622f~mv2.jpeg"), width: 1500, height: 2000, alt: "Marmara Haven Villa kitchen" },
      { src: wixImg("3510f9_1019755331544605aa88b119e8d96577~mv2.jpeg"), width: 1500, height: 2000, alt: "Marmara Haven Villa master bedroom" },
      { src: wixImg("3510f9_c1f78d5852a340e4903cc67d84c1783d~mv2.jpeg"), width: 1200, height: 1600, alt: "Marmara Haven Villa rooftop" },
      { src: wixImg("3510f9_beaa3916396246acabcd42c4b456bedc~mv2.jpeg"), width: 1200, height: 1600, alt: "Marmara Haven Villa terrace" },
      { src: wixImg("3510f9_8f47f822eae24c6f956ac137840326f7~mv2.jpeg"), width: 1200, height: 1600, alt: "Marmara Haven Villa sea view" }
    ],
    stats: [
      { value: "1", labelKey: "exclusiveVilla" },
      { value: "7", labelKey: "bathrooms" },
      { value: "54 m²", labelKey: "livingRoom" },
      { value: "26 m²", labelKey: "terrace" }
    ]
  }
];

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function getSortedProjects(): Project[] {
  return [...projects].sort((a, b) => a.priority - b.priority);
}
