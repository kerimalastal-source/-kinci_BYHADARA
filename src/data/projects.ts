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

export type AmenityKey =
  | "separatePools"
  | "elevator"
  | "underfloorHeating"
  | "fireplace"
  | "waterWell"
  | "flexBasement"
  | "playground"
  | "sportsCourt"
  | "joggingTrack"
  | "cctv"
  | "cleaning"
  | "buildQuality"
  | "spa"
  | "insulation"
  | "privatePool"
  | "seaView"
  | "rooftopTerrace"
  | "masterSuite"
  | "equippedKitchen"
  | "outdoorPool"
  | "fitness"
  | "sauna"
  | "hamam"
  | "smartHome"
  | "indoorParking"
  | "privateParking"
  | "evCharging"
  | "security"
  | "landscaping"
  | "privateGarden"
  | "seaViewTerrace"
  | "generator"
  | "retail"
  | "airConditioning";

/** One residence type, shown as a card in the project's "Residences" section. */
export interface Residence {
  kind: "apartment" | "villa";
  /** Room layout as sold in Türkiye, e.g. "3+1". */
  layout: string;
  /** Plan variant letter from the catalog, e.g. "A". */
  variant?: string;
  gross: string;
  net?: string;
  garden?: string;
  floors?: number;
  planTypes?: number;
}

/** Gross/net area of one level; its name and features live in projectsData.<slug>.floorPlan (same order). */
export interface FloorLevel {
  gross: string;
  net: string;
  /** Photo shown at the top of the level's card. */
  image?: ProjectImage;
  /** Adds a "sea view" tag on the photo. */
  seaView?: boolean;
}

export interface Project {
  slug: string;
  district: string;
  city: string;
  status: ProjectStatus;
  /** Omitted when the developer has not published start/delivery dates. */
  timeline?: string;
  priority: number;
  /** Completed or ongoing project that still has units for sale — shows an extra badge. */
  unitsAvailable?: boolean;
  /** Every unit has been sold — shows a "Sold Out" badge instead. */
  soldOut?: boolean;
  /** Developer brand(s), shown as a proper noun in every language. */
  developer?: string;
  /** Street address from the catalog, shown as written. */
  address?: string;
  coverImage: ProjectImage;
  gallery: ProjectImage[];
  stats: ProjectStat[];
  residences?: Residence[];
  /** Level-by-level breakdown, shown as a "Floor by Floor" section. */
  floorPlan?: FloorLevel[];
  amenities?: AmenityKey[];
}

/** Shared services of every residential community (all projects except the single villa), per the owner. */
const COMMUNITY: AmenityKey[] = [
  "separatePools",
  "fitness",
  "indoorParking",
  "security",
  "cctv",
  "cleaning",
  "landscaping",
  "generator",
  "buildQuality"
];

/**
 * Community services plus project-specific extras. `swap` replaces a shared item
 * (e.g. private garages) or drops it with `null` (e.g. no pools).
 */
const community = (extras: AmenityKey[] = [], swap: Partial<Record<AmenityKey, AmenityKey | null>> = {}): AmenityKey[] => [
  ...COMMUNITY.flatMap((a) => {
    const replacement = swap[a];
    if (replacement === null) return [];
    return [replacement ?? a];
  }),
  ...extras
];

/** The villa communities have private garages and no pools (confirmed by the owner). */
const VILLA_SWAP = { indoorParking: "privateParking", separatePools: null } as const;

const img = (slug: string, file: string, width: number, height: number, alt: string): ProjectImage => ({
  src: `/images/projects/${slug}/${file}.jpg`,
  width,
  height,
  alt
});

export const projects: Project[] = [
  {
    slug: "beylikduzu-living",
    district: "Beylikdüzü",
    city: "Istanbul",
    status: "new-launch",
    timeline: "2026 – 2028",
    priority: 0,
    developer: "Lotus Yapı Proje",
    coverImage: img("beylikduzu-living", "courtyard-gardens", 1193, 671, "Beylikdüzü Living landscaped courtyard between the residential blocks"),
    gallery: [
      img("beylikduzu-living", "street-facade", 1193, 612, "Beylikdüzü Living residential blocks from the street"),
      img("beylikduzu-living", "garden-terrace", 1193, 671, "Beylikdüzü Living ground-floor garden terrace"),
      img("beylikduzu-living", "living-room", 1191, 670, "Beylikdüzü Living living room"),
      img("beylikduzu-living", "living-room-2", 1191, 670, "Beylikdüzü Living living room with media wall"),
      img("beylikduzu-living", "entrance-hall", 1191, 670, "Beylikdüzü Living entrance hall"),
      img("beylikduzu-living", "kitchen", 1191, 670, "Beylikdüzü Living kitchen and dining area"),
      img("beylikduzu-living", "bathroom", 972, 843, "Beylikdüzü Living bathroom"),
      img("beylikduzu-living", "site-plan", 1202, 864, "Beylikdüzü Living site plan with blocks A to F"),
      img("beylikduzu-living", "aerial-view", 1193, 671, "Beylikdüzü Living aerial view towards the sea")
    ],
    stats: [
      { value: "21,000 m²", labelKey: "landArea" },
      { value: "2028", labelKey: "delivery" },
      { value: "18", labelKey: "blocks" },
      { value: "2+1 · 3+1 · 4+1", labelKey: "layout" }
    ],
    residences: [
      { kind: "apartment", layout: "2+1", gross: "100 – 109 m²" },
      { kind: "apartment", layout: "3+1", gross: "134 – 167 m²" },
      { kind: "apartment", layout: "4+1", gross: "194 – 197 m²" }
    ],
    amenities: community(["playground", "sportsCourt", "joggingTrack"])
  },
  {
    slug: "diamond-marin",
    district: "Beylikdüzü",
    city: "Istanbul",
    status: "new-launch",
    priority: 1,
    developer: "Yıltaş × Lotus Yapı",
    coverImage: {
      src: "/images/projects/diamond-marin/aerial-sea-view.jpg",
      width: 1920,
      height: 1288,
      alt: "Diamond Marin aerial view with the sea and West Istanbul Marina"
    },
    gallery: [
      { src: "/images/projects/diamond-marin/street-view.jpg", width: 1327, height: 927, alt: "Diamond Marin two blocks and entrance at dusk" },
      { src: "/images/projects/diamond-marin/facade.jpg", width: 1448, height: 1086, alt: "Diamond Marin building facade" },
      { src: "/images/projects/diamond-marin/facade-side.jpg", width: 773, height: 461, alt: "Diamond Marin side facade" },
      { src: "/images/projects/diamond-marin/balcony-pool-view.jpg", width: 585, height: 670, alt: "Diamond Marin balcony overlooking the pool" },
      { src: "/images/projects/diamond-marin/living-room.jpg", width: 1297, height: 924, alt: "Diamond Marin living room" },
      { src: "/images/projects/diamond-marin/living-dining.jpg", width: 757, height: 517, alt: "Diamond Marin living and dining area" },
      { src: "/images/projects/diamond-marin/kitchen.jpg", width: 774, height: 423, alt: "Diamond Marin kitchen" },
      { src: "/images/projects/diamond-marin/master-bedroom.jpg", width: 1920, height: 1366, alt: "Diamond Marin master bedroom" },
      { src: "/images/projects/diamond-marin/kids-bedroom.jpg", width: 775, height: 429, alt: "Diamond Marin bedroom with study corner" },
      { src: "/images/projects/diamond-marin/dressing-room.jpg", width: 1159, height: 632, alt: "Diamond Marin dressing room" },
      { src: "/images/projects/diamond-marin/fitness-center.jpg", width: 509, height: 362, alt: "Diamond Marin fitness center" }
    ],
    stats: [
      { value: "58", labelKey: "apartments" },
      { value: "2027", labelKey: "delivery" },
      { value: "2", labelKey: "blocks" },
      { value: "3+1", labelKey: "layout" },
      { value: "117 – 143 m²", labelKey: "grossArea" }
    ],
    residences: [{ kind: "apartment", layout: "3+1", gross: "117.60 – 143.08 m²", planTypes: 5 }],
    amenities: community(["smartHome", "airConditioning", "insulation"])
  },
  {
    slug: "lotus-manzara-guzelce",
    district: "Büyükçekmece",
    city: "Istanbul",
    status: "delivered",
    unitsAvailable: true,
    priority: 2,
    developer: "Lotus Yapı Proje",
    address: "Güzelce Mah., Hukukçular Cad. No:14, Büyükçekmece / İstanbul",
    coverImage: img("lotus-manzara-guzelce", "villa-exterior", 1166, 640, "Lotus Manzara Güzelce detached villa exterior"),
    gallery: [
      img("lotus-manzara-guzelce", "aerial-villas", 1500, 640, "Lotus Manzara Güzelce aerial view of the villas"),
      img("lotus-manzara-guzelce", "aerial-masterplan", 1335, 640, "Lotus Manzara Güzelce masterplan among the trees"),
      img("lotus-manzara-guzelce", "villa-row", 1331, 640, "Lotus Manzara Güzelce villas with private gardens"),
      img("lotus-manzara-guzelce", "street-view", 1360, 640, "Lotus Manzara Güzelce street view"),
      img("lotus-manzara-guzelce", "private-parking", 1331, 640, "Lotus Manzara Güzelce private covered parking"),
      img("lotus-manzara-guzelce", "living-room", 1286, 640, "Lotus Manzara Güzelce living room"),
      img("lotus-manzara-guzelce", "master-bedroom", 1285, 640, "Lotus Manzara Güzelce master bedroom"),
      img("lotus-manzara-guzelce", "kitchen", 1286, 640, "Lotus Manzara Güzelce kitchen"),
      img("lotus-manzara-guzelce", "entrance-staircase", 1285, 640, "Lotus Manzara Güzelce entrance and staircase"),
      img("lotus-manzara-guzelce", "bathroom", 1285, 640, "Lotus Manzara Güzelce bathroom"),
      img("lotus-manzara-guzelce", "site-plan", 1160, 640, "Lotus Manzara Güzelce site plan from above")
    ],
    stats: [
      { value: "32", labelKey: "villas" },
      { value: "12,855 m²", labelKey: "landArea" },
      { value: "6+2", labelKey: "villaLayout" },
      { value: "343 m²", labelKey: "grossArea" }
    ],
    residences: [{ kind: "villa", layout: "6+2", gross: "343.15 m²", net: "298.43 m²", floors: 3 }],
    amenities: community(["seaViewTerrace", "privateGarden", "spa"], VILLA_SWAP)
  },
  {
    slug: "lotus-manzara-beylikduzu",
    district: "Beylikdüzü",
    city: "Istanbul",
    status: "delivered",
    unitsAvailable: true,
    priority: 3,
    developer: "Lotus Yapı Proje",
    address: "Dereağzı Mah., Şenyurt Cad. No:35, Beylikdüzü / İstanbul",
    coverImage: img("lotus-manzara-beylikduzu", "villas-entrance", 1920, 955, "Lotus Manzara Beylikdüzü villas and gated entrance"),
    gallery: [
      img("lotus-manzara-beylikduzu", "aerial-sea-view", 1920, 1121, "Lotus Manzara Beylikdüzü villas from above with the Marmara Sea"),
      img("lotus-manzara-beylikduzu", "aerial-villas", 1920, 693, "Lotus Manzara Beylikdüzü aerial view of the villas"),
      img("lotus-manzara-beylikduzu", "villa-type-a", 1043, 1036, "Lotus Manzara Beylikdüzü type A detached villa"),
      img("lotus-manzara-beylikduzu", "villa-type-b", 1043, 1012, "Lotus Manzara Beylikdüzü type B twin villas"),
      img("lotus-manzara-beylikduzu", "street-view", 1920, 955, "Lotus Manzara Beylikdüzü street view"),
      img("lotus-manzara-beylikduzu", "private-parking", 1920, 957, "Lotus Manzara Beylikdüzü private covered parking"),
      img("lotus-manzara-beylikduzu", "living-room", 1920, 993, "Lotus Manzara Beylikdüzü living room"),
      img("lotus-manzara-beylikduzu", "master-bedroom", 1920, 993, "Lotus Manzara Beylikdüzü master bedroom"),
      img("lotus-manzara-beylikduzu", "kitchen", 1920, 992, "Lotus Manzara Beylikdüzü kitchen"),
      img("lotus-manzara-beylikduzu", "entrance-staircase", 1920, 992, "Lotus Manzara Beylikdüzü entrance and staircase"),
      img("lotus-manzara-beylikduzu", "site-plan", 1273, 728, "Lotus Manzara Beylikdüzü site plan with villas A1–A8 and B1–B8")
    ],
    stats: [
      { value: "16", labelKey: "villas" },
      { value: "5,500 m²", labelKey: "landArea" },
      { value: "5+2", labelKey: "villaLayout" },
      { value: "303 – 322 m²", labelKey: "grossArea" }
    ],
    residences: [
      { kind: "villa", layout: "5+2", variant: "A", gross: "322.15 m²", garden: "247 m²", floors: 3 },
      { kind: "villa", layout: "5+2", variant: "B", gross: "303.40 m²", garden: "178 m²", floors: 3 }
    ],
    amenities: community(["seaViewTerrace", "privateGarden", "spa"], VILLA_SWAP)
  },
  {
    slug: "lotus-yali",
    district: "Büyükçekmece",
    city: "Istanbul",
    status: "delivered",
    unitsAvailable: true,
    priority: 4,
    developer: "Lotus Yapı Proje",
    address: "Mimarsinan Mah., İnönü 2 Cad. No:111, Büyükçekmece / İstanbul",
    coverImage: img("lotus-yali", "sunset-aerial", 1781, 1000, "Lotus Yalı at sunset above the Marmara Sea"),
    gallery: [
      img("lotus-yali", "view-from-sea", 1521, 1000, "Lotus Yalı seen from the sea"),
      img("lotus-yali", "site-plan", 1778, 1000, "Lotus Yalı site plan with blocks A to H"),
      img("lotus-yali", "aerial-sea-view", 1781, 1000, "Lotus Yalı aerial view on the Büyükçekmece coast")
    ],
    stats: [
      { value: "48", labelKey: "apartments" },
      { value: "8,600 m²", labelKey: "landArea" },
      { value: "8", labelKey: "blocks" },
      { value: "3+1 · 5+2", labelKey: "layout" }
    ],
    residences: [
      { kind: "apartment", layout: "3+1", gross: "137.30 – 146.35 m²" },
      { kind: "apartment", layout: "5+2", gross: "247.65 m²" }
    ],
    amenities: community(["spa", "seaView", "playground"])
  },
  {
    slug: "cadde-ispartakule",
    district: "Avcılar",
    city: "Istanbul",
    status: "delivered",
    unitsAvailable: true,
    priority: 5,
    developer: "MH Grup İnşaat",
    address: "Ispartakule, Eski İstanbul Cad. No:75, Avcılar / İstanbul",
    coverImage: img("cadde-ispartakule", "tower-avenue", 1920, 1329, "Cadde Ispartakule residential tower and retail avenue"),
    gallery: [
      img("cadde-ispartakule", "garden-pond", 1920, 1329, "Cadde Ispartakule landscaped garden with pond"),
      img("cadde-ispartakule", "retail-avenue", 1878, 1300, "Cadde Ispartakule street-level shops"),
      img("cadde-ispartakule", "terrace-view", 1920, 1080, "Cadde Ispartakule terrace with sea and lake views"),
      img("cadde-ispartakule", "tower-park", 1894, 1311, "Cadde Ispartakule tower from the park"),
      img("cadde-ispartakule", "hamam", 1600, 1066, "Cadde Ispartakule Turkish bath"),
      img("cadde-ispartakule", "fitness", 1920, 1280, "Cadde Ispartakule fitness center"),
      img("cadde-ispartakule", "sauna", 939, 1408, "Cadde Ispartakule sauna"),
      img("cadde-ispartakule", "smart-home", 1920, 1176, "Cadde Ispartakule smart home system")
    ],
    stats: [
      { value: "78", labelKey: "apartments" },
      { value: "12", labelKey: "shops" },
      { value: "2+1 · 3+1", labelKey: "layout" },
      { value: "106 – 151 m²", labelKey: "grossArea" }
    ],
    residences: [
      { kind: "apartment", layout: "2+1", gross: "106.30 – 108.56 m²", net: "89.66 – 91.92 m²" },
      { kind: "apartment", layout: "3+1", gross: "132.83 – 150.61 m²", net: "116.19 – 133.97 m²" }
    ],
    amenities: community(["smartHome", "spa", "evCharging"])
  },
  {
    slug: "lotus-koru-2",
    district: "Beylikdüzü",
    city: "Istanbul",
    status: "delivered",
    unitsAvailable: true,
    timeline: "2023 – 2025",
    priority: 6,
    coverImage: img("lotus-koru-2", "landscaped-grounds", 1733, 1000, "Lotus Koru 2 landscaped grounds"),
    gallery: [
      img("lotus-koru-2", "urban-living-concept", 1500, 1000, "Lotus Koru 2 urban living concept"),
      img("lotus-koru-2", "central-location", 1733, 1000, "Lotus Koru 2 central location"),
      img("lotus-koru-2", "residential-blocks", 1600, 1133, "Lotus Koru 2 residential blocks")
    ],
    stats: [
      { value: "204", labelKey: "apartments" },
      { value: "13 × 5", labelKey: "blocksFloors" },
      { value: "40,000 m²", labelKey: "constructionArea" },
      { value: "17,500 m²", labelKey: "greenAndParkArea" }
    ],
    amenities: community()
  },
  {
    slug: "lotus-istanbul",
    district: "Beylikdüzü",
    city: "Istanbul",
    status: "delivered",
    unitsAvailable: true,
    timeline: "2022 – 2024",
    priority: 7,
    coverImage: img("lotus-istanbul", "mixed-use-development", 1707, 1280, "Lotus Istanbul mixed-use development"),
    gallery: [
      img("lotus-istanbul", "premium-mixed-use-project", 1677, 1000, "Lotus Istanbul premium mixed-use project"),
      img("lotus-istanbul", "iconic-urban-development", 2000, 1287, "Lotus Istanbul iconic urban development"),
      img("lotus-istanbul", "luxury-living-concept", 1494, 1000, "Lotus Istanbul luxury living concept"),
      img("lotus-istanbul", "modern-mixed-use-landmark", 2000, 1333, "Lotus Istanbul modern mixed-use landmark"),
      img("lotus-istanbul", "exclusive-investment-opportunity", 2000, 1333, "Lotus Istanbul exclusive investment opportunity"),
      img("lotus-istanbul", "contemporary-urban-project", 1707, 1280, "Lotus Istanbul contemporary urban project")
    ],
    stats: [
      { value: "102", labelKey: "offices" },
      { value: "62", labelKey: "apartments" },
      { value: "47", labelKey: "shops" }
    ],
    amenities: community()
  },
  {
    slug: "lotus-koru-1",
    district: "Beylikdüzü",
    city: "Istanbul",
    status: "delivered",
    soldOut: true,
    timeline: "2022 – 2024",
    priority: 8,
    coverImage: img("lotus-koru-1", "residential-exterior", 1600, 923, "Lotus Koru 1 residential exterior"),
    gallery: [
      img("lotus-koru-1", "low-rise-residential-concept", 2000, 1333, "Lotus Koru 1 low-rise residential concept"),
      img("lotus-koru-1", "green-living-project", 2000, 1462, "Lotus Koru 1 green living project"),
      img("lotus-koru-1", "nature-inspired-residences", 2000, 1429, "Lotus Koru 1 nature-inspired residences"),
      img("lotus-koru-1", "landscape-focused-housing", 1600, 1142, "Lotus Koru 1 landscape-focused housing"),
      img("lotus-koru-1", "green-focused-residential-project", 1600, 800, "Lotus Koru 1 green-focused residential project"),
      img("lotus-koru-1", "modern-green-community", 1600, 1142, "Lotus Koru 1 modern green community")
    ],
    stats: [
      { value: "144", labelKey: "apartments" },
      { value: "5", labelKey: "floors" }
    ],
    amenities: community()
  },
  {
    slug: "marmara-haven-villa",
    district: "Büyükçekmece",
    city: "Istanbul",
    status: "delivered",
    timeline: "2024 – 2025",
    priority: 9,
    coverImage: img("marmara-haven-villa", "exterior-facade", 1200, 1600, "Marmara Haven Villa exterior facade"),
    gallery: [
      img("marmara-haven-villa", "main-facade", 2000, 1500, "Marmara Haven Villa main facade"),
      img("marmara-haven-villa", "side-view", 1500, 2000, "Marmara Haven Villa side view"),
      img("marmara-haven-villa", "private-pool", 1500, 2000, "Marmara Haven Villa private pool"),
      img("marmara-haven-villa", "living-room", 1500, 2000, "Marmara Haven Villa living room"),
      img("marmara-haven-villa", "kitchen", 1500, 2000, "Marmara Haven Villa kitchen"),
      img("marmara-haven-villa", "master-bedroom", 1500, 2000, "Marmara Haven Villa master bedroom"),
      img("marmara-haven-villa", "rooftop", 1200, 1600, "Marmara Haven Villa rooftop"),
      img("marmara-haven-villa", "terrace", 1200, 1600, "Marmara Haven Villa terrace"),
      img("marmara-haven-villa", "sea-view", 1200, 1600, "Marmara Haven Villa sea view")
    ],
    stats: [
      { value: "637 m²", labelKey: "landArea" },
      { value: "576.63 m²", labelKey: "grossArea" },
      { value: "5", labelKey: "bedrooms" },
      { value: "7", labelKey: "bathrooms" },
      { value: "4", labelKey: "floors" }
    ],
    floorPlan: [
      { gross: "138.62 m²", net: "105.40 m²", image: img("marmara-haven-villa", "side-view", 1500, 2000, "Marmara Haven Villa basement level") },
      { gross: "223.37 m²", net: "108.60 m²", image: img("marmara-haven-villa", "living-room", 1500, 2000, "Marmara Haven Villa ground floor living room") },
      { gross: "143.19 m²", net: "126.21 m²", image: img("marmara-haven-villa", "master-bedroom", 1500, 2000, "Marmara Haven Villa first floor bedroom") },
      {
        gross: "103.66 m²",
        net: "82.82 m²",
        image: img("marmara-haven-villa", "terrace", 1200, 1600, "Marmara Haven Villa rooftop terrace with sea view"),
        seaView: true
      }
    ],
    amenities: [
      "privatePool",
      "seaView",
      "rooftopTerrace",
      "elevator",
      "smartHome",
      "underfloorHeating",
      "fireplace",
      "waterWell",
      "flexBasement",
      "masterSuite",
      "equippedKitchen",
      "buildQuality"
    ]
  }
];

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function getSortedProjects(): Project[] {
  return [...projects].sort((a, b) => a.priority - b.priority);
}
