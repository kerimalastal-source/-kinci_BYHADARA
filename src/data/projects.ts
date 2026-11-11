export type ProjectStatus = "new-launch" | "ongoing" | "delivered";

export type Lifestyle = "sea" | "nature" | "city";

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
  | "airConditioning"
  | "indoorPool"
  | "pilates"
  | "concierge"
  | "lounge"
  | "meetingRooms"
  | "cafe"
  | "cinemaRoom"
  | "gameRoom"
  | "seafront"
  | "hotelServices"
  | "yachtMooring"
  | "seismicDesign"
  | "palaceGardens"
  | "seaBridge"
  | "cultureCentre";

/** One residence type, shown as a card in the project's "Residences" section. */
export interface Residence {
  /** "loft": the developer's own loft/villa type (e.g. Büyükyalı's Fişekhane lofts); not counted as a villa. */
  kind: "apartment" | "villa" | "office" | "loft";
  /** Concept or collection name shown as written above the title, e.g. "FENDI Casa". */
  label?: string;
  /** Room layout as sold in Türkiye, e.g. "3+1"; for offices "closed" or "open". */
  layout: string;
  /** Plan variant letter from the catalog, e.g. "A". */
  variant?: string;
  /** Omitted when the developer has not published the plans (the card then shows the layout and price only). */
  gross?: string;
  net?: string;
  /** Saleable gross area (Turkish "satışa esas brüt"), when the catalog quotes it. */
  saleable?: string;
  garden?: string;
  floors?: number;
  planTypes?: number;
  /** Price range as quoted by the team, shown as written (e.g. "$200,000 – $250,000"). */
  price?: string;
  /** `price` is a starting price: shown as "From $380,000". */
  priceFrom?: boolean;
  /** One sample floor plan for this type, shown at the top of the card (opens in the lightbox). */
  plan?: ProjectImage;
}

/** Gross/net area of one level; its name and features live in projectsData.<slug>.floorPlan (same order). */
export interface ProjectVideo {
  /** Self-hosted MP4s under public/videos/<slug>/: a light one for phones, a sharper one for larger screens. */
  sources: { small: string; large: string };
  /** Phone footage (9:16). */
  vertical?: boolean;
  poster: ProjectImage;
}

export interface FloorLevel {
  /** Left out for a card that shows a view rather than a level (e.g. the rooftop sea view). */
  gross?: string;
  net?: string;
  /** Photo shown at the top of the level's card. */
  image?: ProjectImage;
  /** Adds a "sea view" tag on the photo. */
  seaView?: boolean;
}

/** Legal and technical facts a project card can confirm (labels in projectDetail.verified.labels, values per project in projectsData.<slug>.verified). */
export type VerifiedKey =
  | "titleDeed"
  | "citizenship"
  | "permit"
  | "iskan"
  | "completed"
  | "earthquake"
  | "encumbrance"
  | "residence"
  | "warranty";

export interface ProjectVerified {
  /** "2026-09-27": when the team last confirmed the facts. */
  updated: string;
  /** Only facts the team confirmed, in display order. */
  items: VerifiedKey[];
  /** Copies of the documents can be sent on request. */
  documents?: boolean;
}

export interface Project {
  slug: string;
  district: string;
  /** The Istanbul district drawn on the location map when `district` is a neighbourhood (e.g. Ispartakule in Avcılar). */
  mapDistrict?: string;
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
  /** "on-request" shows "Price: On request"; any other value is shown as written (e.g. "$1,250,000"). */
  price?: string;
  /** `price` is a starting price: shown as "From $380,000". */
  priceFrom?: boolean;
  /** The developer's prices exclude VAT and contract costs (the price notes say so instead of "VAT included"). */
  priceExcludesVat?: boolean;
  /** Each residence card shows one sample plan; a note under the cards says other plans and options exist. */
  residencesMoreOptions?: boolean;
  /** Instalment plan confirmed by the owner (2026-10-14): down payment % and the months the balance is spread over
   * (`monthsTo` when it depends on the unit, e.g. 12 to 24 months). */
  paymentPlan?: PaymentPlan;
  /** Setting, taken from the project's own description: by the sea (or sea views), green and calm, or city. Used by "Find My Project". */
  lifestyle?: Lifestyle[];
  /** Ad landing page: adds an "I'm interested" button to the hero. */
  landing?: boolean;
  /** Street address from the catalog, shown as written. */
  address?: string;
  coverImage: ProjectImage;
  gallery: ProjectImage[];
  /** Villa photos (exterior first) for the "Villas" filter on the projects page; only for projects that sell villas. */
  villaPhotos?: ProjectImage[];
  /** Real photos of the construction site, shown in their own dated section after the gallery (never mixed with renders). */
  siteProgress?: { date: string; photos: ProjectImage[] };
  stats: ProjectStat[];
  residences?: Residence[];
  /** Level-by-level breakdown, shown as a "Floor by Floor" section. */
  floorPlan?: FloorLevel[];
  /** Video tour, served from the site itself; `poster` shows until the video starts. */
  video?: ProjectVideo;
  amenities?: AmenityKey[];
  /** "Verified Project Card": facts confirmed by the team (never filled in from marketing copy). */
  verified?: ProjectVerified;
}

export interface PaymentPlan {
  downPercent: number;
  months: number;
  monthsTo?: number;
}

/** The months of a payment plan as shown: "30", or "12 – 24". */
export const planMonths = (plan: PaymentPlan): string => (plan.monthsTo ? `${plan.months} – ${plan.monthsTo}` : String(plan.months));

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

/** Projects that sell villas: the single private villa, villa communities and mixed projects with a villa type. */
export function hasVillas(p: Project): boolean {
  return p.slug.includes("villa") || !!p.residences?.some((r) => r.kind === "villa");
}

export const projects: Project[] = [
  {
    slug: "beylikduzu-living",
    district: "Beylikdüzü",
    city: "Istanbul",
    status: "new-launch",
    paymentPlan: { downPercent: 30, months: 30 },
    lifestyle: ["city"],
    timeline: "2025 – 2028",
    priority: 0,
    developer: "Lotus Yapı Proje",
    // Prices from the owner on 2026-09-30 (VAT included, 4% title deed fee not included); per layout in residences.
    price: "$200,000 – $420,000",
    // Renders from the developer's project page (lotusyapiproje.com, owner's request 2026-10-19).
    coverImage: img("beylikduzu-living", "aerial-main", 1920, 1080, "Lotus Yaşam aerial view of the blocks and landscaped courtyard in Beylikdüzü"),
    gallery: [
      img("beylikduzu-living", "street-entrance", 1920, 1080, "Lotus Yaşam main entrance and street shops"),
      img("beylikduzu-living", "central-garden", 1920, 1080, "Lotus Yaşam central garden between the blocks"),
      img("beylikduzu-living", "garden-pergola", 1920, 1080, "Lotus Yaşam garden terrace with pergola and water feature"),
      img("beylikduzu-living", "playground", 1300, 731, "Lotus Yaşam children's play area and lawns"),
      img("beylikduzu-living", "street-shops", 1300, 731, "Lotus Yaşam street shops on the ground floor"),
      img("beylikduzu-living", "night-view", 1920, 871, "Lotus Yaşam blocks and shops at night"),
      img("beylikduzu-living", "balcony", 1920, 1079, "Lotus Yaşam balcony overlooking the courtyard"),
      img("beylikduzu-living", "living-room-new", 1300, 731, "Lotus Yaşam living room"),
      img("beylikduzu-living", "kitchen-new", 1300, 731, "Lotus Yaşam kitchen and dining area"),
      img("beylikduzu-living", "master-bedroom", 1300, 731, "Lotus Yaşam master bedroom"),
      img("beylikduzu-living", "aerial-sea", 1920, 1080, "Lotus Yaşam aerial view towards the Sea of Marmara")
    ],
    stats: [
      // 308 homes and 82 street shops, October 2025 to June 2028: the developer's project page (2026-10-19).
      { value: "308", labelKey: "apartments" },
      { value: "2028", labelKey: "delivery" },
      { value: "82", labelKey: "shops" },
      { value: "18", labelKey: "blocks" },
      { value: "21,000 m²", labelKey: "landArea" }
    ],
    residences: [
      { kind: "apartment", layout: "2+1", gross: "100 – 109 m²", price: "$200,000 – $250,000" },
      { kind: "apartment", layout: "3+1", gross: "134 – 167 m²", price: "$250,000 – $300,000" },
      { kind: "apartment", layout: "4+1", gross: "194 – 197 m²", price: "$350,000 – $420,000" }
    ],
    amenities: community(["playground", "sportsCourt", "joggingTrack"])
  },
  {
    slug: "diamond-marin",
    district: "Beylikdüzü",
    city: "Istanbul",
    status: "new-launch",
    paymentPlan: { downPercent: 30, months: 30 },
    lifestyle: ["sea"],
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
      { src: "/images/projects/diamond-marin/fitness-center.jpg", width: 509, height: 362, alt: "Diamond Marin fitness center" },
      { src: "/images/projects/diamond-marin/facade-sunset.jpg", width: 1700, height: 1141, alt: "Diamond Marin facade at sunset" },
      { src: "/images/projects/diamond-marin/entrance-gate.jpg", width: 1700, height: 1141, alt: "Diamond Marin entrance between the two blocks" },
      { src: "/images/projects/diamond-marin/aerial-district.jpg", width: 1700, height: 1141, alt: "Diamond Marin aerial view of the neighbourhood and the sea" }
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
    slug: "sea-pearl-atakoy",
    district: "Bakırköy",
    city: "Istanbul",
    status: "delivered",
    lifestyle: ["sea", "city"],
    unitsAvailable: true,
    // Between Diamond Marin and Lotus Şişli in the list (owner, 2026-10-13: a new luxury project to market).
    priority: 1.5,
    developer: "Kuzu İnşaat",
    // The developer's 2023 price list excludes VAT and may be out of date, so the page asks for the price until the owner confirms one.
    price: "on-request",
    address: "Zeytinlik Mah., Rauf Orbay Cad., Ataköy Sahil Yolu No:1, Bakırköy / İstanbul",
    // Facts from the owner's project notes (2026-10-13) over the developer's older catalog; photos from the developer's folders.
    coverImage: img("sea-pearl-atakoy", "dusk-coast", 2000, 1333, "Sea Pearl Ataköy towers on the Marmara coast at dusk"),
    gallery: [
      img("sea-pearl-atakoy", "aerial-coast", 2000, 1213, "Sea Pearl Ataköy aerial view with its coastline, lagoon and gardens"),
      img("sea-pearl-atakoy", "palace-gardens", 2000, 1454, "Sea Pearl Ataköy Ottoman-style gardens opening onto the sea"),
      img("sea-pearl-atakoy", "gardens-night", 2000, 1243, "Sea Pearl Ataköy gardens and lagoon lit at night"),
      img("sea-pearl-atakoy", "night-aerial", 2000, 1333, "Sea Pearl Ataköy blocks and gardens at night, aerial view"),
      img("sea-pearl-atakoy", "balcony-view", 2000, 1333, "View from a Sea Pearl Ataköy balcony over the gardens to the sea"),
      img("sea-pearl-atakoy", "terrace-sea", 2000, 1335, "Sea Pearl Ataköy garden terrace above the Marmara Sea"),
      img("sea-pearl-atakoy", "terrace-dinner", 2000, 1333, "Dinner on a Sea Pearl Ataköy terrace at sunset"),
      img("sea-pearl-atakoy", "living-room", 2000, 1335, "Sea Pearl Ataköy 4.5+1 living room with sea view"),
      img("sea-pearl-atakoy", "master-bedroom", 2000, 1335, "Sea Pearl Ataköy master bedroom opening onto a sea-view terrace"),
      img("sea-pearl-atakoy", "bedroom-sea", 2000, 1335, "Sea Pearl Ataköy bedroom with the sea beyond the garden"),
      img("sea-pearl-atakoy", "dining-room", 2000, 1335, "Sea Pearl Ataköy dining room facing the sea"),
      img("sea-pearl-atakoy", "open-kitchen", 2000, 1335, "Sea Pearl Ataköy open kitchen and living area with sea view"),
      img("sea-pearl-atakoy", "sea-terrace", 2000, 931, "Sea Pearl Ataköy wide terrace above the shore"),
      img("sea-pearl-atakoy", "from-the-sea", 1474, 1243, "Sea Pearl Ataköy seen from the Marmara Sea")
    ],
    stats: [
      { value: "631", labelKey: "apartments" },
      { value: "1,200 m", labelKey: "coastline" },
      { value: "4 × 20", labelKey: "blocksFloors" },
      { value: "55,000 m²", labelKey: "landArea" },
      { value: "1+1 – 4.5+1", labelKey: "layout" }
    ],
    // Areas from the developer's price list; the largest 4.5+1 (398 m²) from the owner's notes.
    residences: [
      { kind: "apartment", layout: "1+1", gross: "88 – 104 m²" },
      { kind: "apartment", layout: "2+1", gross: "117 – 270 m²" },
      { kind: "apartment", layout: "3+1", gross: "193 – 204 m²" },
      { kind: "apartment", layout: "3.5+1", gross: "235 – 277 m²" },
      { kind: "apartment", layout: "4+1", gross: "237 – 276 m²" },
      { kind: "apartment", layout: "4.5+1", gross: "248 – 398 m²" }
    ],
    // Owner's notes: residents-only seafront, yacht mooring, a gym in every block, JW Marriott offers (not free use).
    amenities: [
      "seafront",
      "seaView",
      "yachtMooring",
      "palaceGardens",
      "fitness",
      "hotelServices",
      "seismicDesign",
      "playground"
    ]
  },
  {
    slug: "buyukyali",
    district: "Zeytinburnu",
    city: "Istanbul",
    status: "delivered",
    lifestyle: ["sea", "city"],
    unitsAvailable: true,
    // Right after Sea Pearl Ataköy (owner, 2026-10-13: another project to market).
    priority: 1.6,
    developer: "Özak GYO · Ziylan · Yenigün",
    // Owner, 2026-11-10: the developer's "Price & sqm ranges 2026" list (Drive folder "Büyükyalı"), USD, VAT
    // included; payment plan 50% down and 12 monthly instalments. The list says prices may change.
    price: "$1,079,000 – $3,859,000",
    paymentPlan: { downPercent: 50, months: 12 },
    address: "Kazlıçeşme, Kennedy Cad. No:52, Zeytinburnu / İstanbul",
    // Facts from the developer's catalog and project page (ozakgyo.com/tr/proje/buyukyali, 2026-10-13); photos from both.
    coverImage: img("buyukyali", "sea-skyline", 1573, 790, "Büyükyalı towers on the Kazlıçeşme coast seen across the water"),
    gallery: [
      img("buyukyali", "fisekhane-entrance", 1560, 720, "Büyükyalı entrance and the restored Fişekhane building"),
      img("buyukyali", "gardens-aerial", 1550, 750, "Büyükyalı landscaped gardens and courtyards from above"),
      img("buyukyali", "sea-gardens", 1550, 750, "Büyükyalı gardens running down towards the Marmara Sea"),
      img("buyukyali", "pool-sea", 1657, 948, "Büyükyalı outdoor pool and gardens facing the sea"),
      img("buyukyali", "facade-sea", 1550, 750, "Büyükyalı block facade above the coast and the sea"),
      img("buyukyali", "promenade", 1570, 864, "Büyükyalı pedestrian promenade and blocks with sea views"),
      img("buyukyali", "fisekhane-square", 1158, 945, "Büyükyalı square in front of the historic Fişekhane"),
      img("buyukyali", "loft-living", 1550, 750, "Büyükyalı loft living room inside the restored Fişekhane"),
      img("buyukyali", "loft-courtyard", 1036, 948, "Büyükyalı loft terrace opening onto the courtyard"),
      img("buyukyali", "fendi-pool", 750, 670, "Infinity pool on the roof terrace of the Büyükyalı FENDI Casa block"),
      img("buyukyali", "fendi-living", 999, 948, "Büyükyalı furnished by FENDI Casa living room with sea view"),
      img("buyukyali", "balcony-sea", 1657, 948, "Büyükyalı apartment balcony overlooking the Marmara Sea"),
      img("buyukyali", "living-sea", 1657, 948, "Büyükyalı apartment living room with sea view"),
      img("buyukyali", "garden-pool", 1550, 750, "Büyükyalı garden pool and seating area")
    ],
    stats: [
      { value: "1,540", labelKey: "apartments" },
      { value: "15", labelKey: "blocks" },
      { value: "111,000 m²", labelKey: "landArea" },
      { value: "59", labelKey: "shops" },
      { value: "1+1 – 5+1", labelKey: "layout" }
    ],
    // Area and price ranges per type from the developer's 2026 list (owner, 2026-11-10).
    residences: [
      { kind: "apartment", layout: "2+1", gross: "134 – 223 m²", price: "$1,079,000 – $1,660,000" },
      { kind: "apartment", layout: "3+1", gross: "175 – 344 m²", price: "$1,491,000 – $2,549,000" },
      { kind: "apartment", layout: "4+1", gross: "227.54 – 364.10 m²", price: "$2,192,000 – $3,833,000" },
      { kind: "apartment", label: "FENDI Casa", layout: "2+1", gross: "142 – 312.16 m²", price: "$1,587,000 – $1,740,000" },
      { kind: "apartment", label: "FENDI Casa", layout: "4+1", gross: "326.32 – 517.87 m²", price: "$3,126,000 – $3,859,000" },
      { kind: "loft", layout: "Loft", gross: "376 – 426 m²", price: "$2,433,000 – $3,603,000" }
    ],
    // Developer's site: a residents-only bridge to the shore, Büyükyalı Club (pools, hamam, sauna, tennis), 7/24 concierge, Fişekhane culture centre.
    amenities: [
      "seaBridge",
      "seaView",
      "outdoorPool",
      "indoorPool",
      "spa",
      "sportsCourt",
      "concierge",
      "cultureCentre",
      "landscaping",
      "retail",
      "playground",
      "seismicDesign"
    ]
  },
  {
    slug: "casablu-vadi",
    district: "Beylikdüzü",
    city: "Istanbul",
    status: "ongoing",
    // Owner, 2026-10-18: under construction, delivery November 2027, 30/30 instalments, eligible for citizenship.
    paymentPlan: { downPercent: 30, months: 30 },
    lifestyle: ["sea", "nature"],
    unitsAvailable: true,
    priority: 1.7,
    developer: "Mutlu İnşaat",
    price: "on-request",
    // Facts, areas and images from the developer's catalog ("CasaBlu Vadi Katolog", Drive).
    coverImage: img("casablu-vadi", "blocks-aerial", 2000, 1092, "CasaBlu Vadi low-rise residential blocks around a landscaped central garden, aerial view"),
    gallery: [
      img("casablu-vadi", "courtyard-night", 2000, 1415, "CasaBlu Vadi blocks and landscaped courtyard lit at night"),
      img("casablu-vadi", "facade-dusk", 1174, 687, "CasaBlu Vadi residential block and garden pavilion at dusk"),
      img("casablu-vadi", "a1-entrance", 1778, 1015, "Entrance of CasaBlu Vadi block A1 with its garden path"),
      img("casablu-vadi", "aerial-valley-sea", 2000, 1415, "CasaBlu Vadi between Yaşam Vadisi and the Marmara Sea, with Ambarlı in the distance"),
      img("casablu-vadi", "aerial-sea", 1180, 1298, "Aerial view of CasaBlu Vadi with the Marmara Sea beyond"),
      img("casablu-vadi", "terrace-sunset", 1778, 977, "CasaBlu Vadi terrace with a sea view at sunset"),
      img("casablu-vadi", "living-sea-sunset", 2000, 1100, "CasaBlu Vadi living room opening onto a sea-view terrace at sunset"),
      img("casablu-vadi", "living-terrace", 2000, 1146, "CasaBlu Vadi living room and terrace above the sea"),
      img("casablu-vadi", "living-night", 1728, 1901, "CasaBlu Vadi living room and sea-view terrace in the evening"),
      img("casablu-vadi", "bedroom-sea", 1179, 657, "CasaBlu Vadi bedroom with sea view and walk-in wardrobe"),
      img("casablu-vadi", "kitchen-dining", 1179, 657, "CasaBlu Vadi kitchen and dining area with sea view"),
      img("casablu-vadi", "indoor-pool", 727, 668, "CasaBlu Vadi indoor swimming pool"),
      img("casablu-vadi", "fitness", 748, 1023, "CasaBlu Vadi fitness centre"),
      img("casablu-vadi", "hamam", 750, 919, "CasaBlu Vadi Turkish bath")
    ],
    stats: [
      { value: "71", labelKey: "apartments" },
      { value: "2027", labelKey: "delivery" },
      { value: "7", labelKey: "blocks" },
      { value: "17,263 m²", labelKey: "constructionArea" },
      { value: "2+1 – 6+1", labelKey: "layout" }
    ],
    // Catalog plan pages: "satışa esas brüt" as gross, and net area. The 5+1 (Tip 6) and one 6+1 type have their
    // saleable area cut off in the catalog itself (5+1: net only; 6+1: "+").
    residences: [
      { kind: "apartment", layout: "2+1", gross: "102.51 – 192.56 m²", net: "56.80 – 98.25 m²", planTypes: 7 },
      { kind: "apartment", layout: "3+1", gross: "155.94 – 250.92 m²", net: "100.00 – 148.15 m²", planTypes: 13 },
      { kind: "apartment", layout: "4+1", gross: "194.15 – 382.87 m²", net: "126.25 – 223.15 m²", planTypes: 9 },
      { kind: "apartment", layout: "5+1", net: "220.40 m²", garden: "21.50 m²", floors: 2 },
      { kind: "apartment", layout: "6+1", gross: "363.80 m²+", net: "215.40 – 240.85 m²", planTypes: 2 }
    ],
    amenities: [
      "seaView",
      "seaViewTerrace",
      "privateGarden",
      "indoorPool",
      "fitness",
      "hamam",
      "sauna",
      "playground",
      "joggingTrack",
      "landscaping",
      "indoorParking",
      "security"
    ]
  },
  {
    slug: "vadi-panorama",
    district: "Başakşehir",
    city: "Istanbul",
    status: "ongoing",
    // Owner, 2026-10-22: delivery December 2028, 40% down and the balance over 48 months, price on request;
    // developer as on Emlak Konut's project page ("Emlak Konut güvencesiyle, Binbay & Enam iş birliği").
    paymentPlan: { downPercent: 40, months: 48 },
    lifestyle: ["nature", "city"],
    unitsAvailable: true,
    priority: 1.8,
    developer: "Emlak Konut · Binbay · Enam",
    address: "Vadi Panorama Evleri, Kayabaşı, Başakşehir, İstanbul",
    price: "on-request",
    // Facts from emlakkonut.com.tr (project 20366) and vadipanoramaevleri.com; images from the project site.
    coverImage: img("vadi-panorama", "aerial-site", 1680, 945, "Vadi Panorama aerial view: towers, low-rise blocks, 12 villas and the central garden in Başakşehir"),
    gallery: [
      img("vadi-panorama", "valley-panorama", 1680, 900, "Vadi Panorama towers and terraced blocks above the valley"),
      img("vadi-panorama", "central-garden", 1680, 927, "Vadi Panorama central garden with children's play area and walking track"),
      img("vadi-panorama", "towers-dusk", 1680, 798, "Vadi Panorama towers at dusk"),
      img("vadi-panorama", "garden-terrace", 1680, 945, "Vadi Panorama garden-floor homes with private lawns"),
      img("vadi-panorama", "low-rise-block", 1680, 945, "Vadi Panorama low-rise block with terraces"),
      img("vadi-panorama", "living-room", 1680, 916, "Vadi Panorama living room"),
      img("vadi-panorama", "master-bedroom", 1680, 865, "Vadi Panorama master bedroom"),
      img("vadi-panorama", "kitchen-dining", 1411, 1024, "Vadi Panorama kitchen with dining corner"),
      img("vadi-panorama", "kitchen", 1410, 1027, "Vadi Panorama kitchen with built-in appliances"),
      img("vadi-panorama", "private-hamam", 1920, 1080, "Vadi Panorama private hamam basin inside the apartment bathroom"),
      img("vadi-panorama", "bedroom-suite", 1920, 1080, "Vadi Panorama bedroom suite")
    ],
    villaPhotos: [
      img("vadi-panorama", "villas-front", 1130, 445, "Vadi Panorama 5+1 detached villas with private gardens"),
      img("vadi-panorama", "villas-aerial", 660, 430, "Vadi Panorama villa lane seen from above"),
      img("vadi-panorama", "villa-plan-ground", 804, 852, "Vadi Panorama 5+1 villa ground floor plan with garden"),
      img("vadi-panorama", "villa-plan-first", 691, 748, "Vadi Panorama 5+1 villa first floor plan"),
      img("vadi-panorama", "villas-row", 1923, 445, "Vadi Panorama row of 5+1 detached villas with private gardens")
    ],
    stats: [
      { value: "268", labelKey: "apartments" },
      { value: "2028", labelKey: "delivery" },
      { value: "12", labelKey: "villas" },
      { value: "26", labelKey: "shops" },
      { value: "2+1 – 5+1", labelKey: "layout" }
    ],
    // Floor plans on vadipanoramaevleri.com (Emlak Konut, Kayabaşı parcel 970-2): net excludes balconies;
    // gross is "satışa esas brüt". The 5+1 villa plans are villas no. 1-6 (basement, ground and first floor).
    residences: [
      { kind: "apartment", layout: "2+1", gross: "125.69 – 128.65 m²", net: "78.50 – 80.12 m²", planTypes: 2 },
      { kind: "apartment", layout: "3+1", gross: "158.09 – 194.21 m²", net: "100.30 – 124.10 m²", planTypes: 4 },
      { kind: "apartment", layout: "4+1", gross: "201.09 – 205.04 m²", net: "130.14 – 133.50 m²", planTypes: 2 },
      { kind: "apartment", layout: "5+1", gross: "251.41 m²", net: "180.82 m²" },
      { kind: "villa", layout: "5+1", gross: "268.49 m²", net: "210.05 m²", garden: "175.03 – 248.72 m²", floors: 3 }
    ],
    amenities: [
      "privateGarden",
      "smartHome",
      "underfloorHeating",
      "hamam",
      "equippedKitchen",
      "playground",
      "sportsCourt",
      "joggingTrack",
      "landscaping",
      "retail"
    ]
  },
  {
    slug: "mesa-yenikent",
    district: "Başakşehir",
    city: "Istanbul",
    status: "ongoing",
    // Owner, 2026-10-22: no payment plan, price on request, eligible for citizenship. Mesa's press release
    // (21 Oct 2026, carried by Emlak Kulisi, Yeni Şafak, Konut Trend...): about 4,000 homes in 5 phases, phase 1 of
    // 843 homes planned for delivery in June 2028; the new phase (Çınar, 300 homes) has no published date.
    lifestyle: ["nature", "city"],
    unitsAvailable: true,
    priority: 1.9,
    developer: "Mesa Mesken",
    address: "Mesa Yenikent, Başakşehir, İstanbul",
    price: "on-request",
    // Facts from mesayenikent.com, its e-catalogue and the 2026 investor brochure; images from the project site.
    coverImage: img("mesa-yenikent", "cover-park", 1680, 950, "Mesa Yenikent central park with ponds and walking paths between low-rise blocks in Başakşehir"),
    gallery: [
      img("mesa-yenikent", "central-park", 1680, 950, "Mesa Yenikent landscaped park with pond and seating terraces"),
      img("mesa-yenikent", "terrace-view", 1680, 945, "Mesa Yenikent terrace overlooking the gardens and ponds"),
      img("mesa-yenikent", "garden-floor", 1680, 945, "Mesa Yenikent garden-floor home with a private lawn"),
      img("mesa-yenikent", "buildings-gardens", 1680, 1050, "Mesa Yenikent low-rise blocks with balconies and gardens"),
      img("mesa-yenikent", "water-walkway", 1680, 1050, "Mesa Yenikent walkway beside a landscaped pond"),
      img("mesa-yenikent", "street-cafes", 1680, 1050, "Mesa Yenikent street with cafés and shops at ground level"),
      img("mesa-yenikent", "evening-terrace", 1680, 1200, "Mesa Yenikent terrace in the evening above the lit gardens"),
      img("mesa-yenikent", "indoor-pool", 1600, 893, "Mesa Yenikent indoor swimming pool"),
      img("mesa-yenikent", "living-room", 1680, 934, "Mesa Yenikent living room with wide windows"),
      img("mesa-yenikent", "bedroom", 1680, 840, "Mesa Yenikent bedroom opening onto the balcony"),
      img("mesa-yenikent", "sunset-balcony", 1680, 950, "Mesa Yenikent balcony view over the gardens at sunset")
    ],
    stats: [
      { value: "4,000", labelKey: "apartments" },
      { value: "2028", labelKey: "delivery" },
      { value: "2,000,000 m²", labelKey: "landArea" },
      { value: "1,000,000 m²", labelKey: "greenAndParkArea" },
      { value: "2+1 – 6.5+1", labelKey: "layout" }
    ],
    // Floor plans: Ladin phase from the e-catalogue (2026), Çınar (new phase) from the plans page. Net includes
    // balconies ("Net Alan (Balkon Dahil)"); gross is "satışa esas brüt". 4.5+2 and 6.5+1 are two-level homes.
    residences: [
      { kind: "apartment", layout: "2+1", gross: "83.54 – 118.33 m²", net: "52.59 – 80.85 m²", planTypes: 2 },
      { kind: "apartment", layout: "3+1", gross: "143.10 – 264.96 m²", net: "90.09 – 181.03 m²", planTypes: 4 },
      { kind: "apartment", layout: "3.5+1", gross: "229.51 m²", net: "156.81 m²" },
      { kind: "apartment", layout: "4+1", gross: "230.47 – 233.17 m²", net: "157.47 – 159.31 m²", planTypes: 2 },
      { kind: "apartment", layout: "4.5+2", gross: "305.94 m²", net: "209.03 m²", floors: 2 },
      { kind: "apartment", layout: "6.5+1", gross: "410.67 m²", net: "280.59 m²", floors: 2 }
    ],
    amenities: [
      "privateGarden",
      "smartHome",
      "indoorPool",
      "fitness",
      "sauna",
      "playground",
      "sportsCourt",
      "joggingTrack",
      "landscaping",
      "evCharging",
      "retail",
      "seismicDesign"
    ]
  },
  {
    slug: "tual-comfort",
    // Shown as Ispartakule (owner, 2026-10-23); the map draws its district, Avcılar.
    district: "Ispartakule",
    mapDistrict: "Avcılar",
    city: "Istanbul",
    status: "delivered",
    // Owner, 2026-10-23: ready to move in, title deeds ready, eligible for citizenship; prices per layout below.
    lifestyle: ["nature", "city"],
    unitsAvailable: true,
    priority: 1.95,
    developer: "Dağ Holding",
    address: "Tual Comfort, Ispartakule, Avcılar, İstanbul",
    // Prices from the owner on 2026-10-23 (by view and size).
    price: "$150,000 – $450,000",
    // Facts and images from the developer's site (tualcomfort.com); 480 homes in 6 blocks of up to 21 floors from
    // its listing (Emlak Platform), the blocks A1, A2, B1, B2, C and D from the site plans on the floor plans.
    coverImage: img("tual-comfort", "towers-entrance", 1680, 1228, "Tual Comfort residential towers and entrance in Ispartakule"),
    gallery: [
      img("tual-comfort", "central-garden", 1680, 1228, "Tual Comfort central garden and playgrounds between the blocks"),
      img("tual-comfort", "towers-park", 1680, 1228, "Tual Comfort towers seen from the park"),
      img("tual-comfort", "gate", 1680, 1228, "Tual Comfort main gate and security entrance"),
      img("tual-comfort", "courtyard-balcony", 1680, 1228, "Tual Comfort view from a balcony over the landscaped courtyard"),
      img("tual-comfort", "living-room", 1680, 945, "Tual Comfort living and dining room"),
      img("tual-comfort", "kitchen", 1680, 945, "Tual Comfort fitted kitchen"),
      img("tual-comfort", "bedroom", 1680, 945, "Tual Comfort master bedroom"),
      img("tual-comfort", "kids-room", 1680, 945, "Tual Comfort children's bedroom")
    ],
    stats: [
      { value: "480", labelKey: "apartments" },
      { value: "6", labelKey: "blocks" },
      { value: "21", labelKey: "floors" },
      { value: "1+1 – 4+1", labelKey: "layout" }
    ],
    // Floor plans on tualcomfort.com, rounded: gross is "satışa esas brüt" (1+1 69.54, 2+1 103.93–130.42,
    // 3+1 162.18–171.42, 4+1 188.54), net 1+1 39.66, 3+1 104.87–107.93 and 4+1 123.80.
    residences: [
      { kind: "apartment", layout: "1+1", gross: "70 m²", net: "40 m²", price: "$150,000 – $200,000" },
      { kind: "apartment", layout: "2+1", gross: "104 – 130 m²", planTypes: 3, price: "$200,000 – $250,000" },
      { kind: "apartment", layout: "3+1", gross: "162 – 171 m²", net: "105 – 108 m²", planTypes: 3, price: "$250,000 – $300,000" },
      { kind: "apartment", layout: "4+1", gross: "189 m²", net: "124 m²", price: "$300,000 – $450,000" }
    ],
    amenities: [
      "indoorPool",
      "fitness",
      "spa",
      "playground",
      "sportsCourt",
      "landscaping",
      "indoorParking",
      "evCharging",
      "retail"
    ]
  },
  {
    slug: "hayat-flora",
    district: "Küçükçekmece",
    city: "Istanbul",
    status: "ongoing",
    // Owner, 2026-10-23: under construction, Emlak Konut guarantee, eligible for citizenship, starting prices per
    // layout below (by view and size), prices include VAT; 30% down and the balance over 30 months (owner, same day).
    // Delivery February 2029 from the developer's FAQ (ozakgyo.com).
    paymentPlan: { downPercent: 30, months: 30 },
    lifestyle: ["sea", "city"],
    unitsAvailable: true,
    priority: 1.96,
    developer: "Özak GYO · Emlak Konut",
    address: "Hayat Flora, İstasyon Mah., Halkalı, Küçükçekmece, İstanbul",
    price: "$380,000",
    priceFrom: true,
    // Facts from emlakkonut.com.tr (Hayat Flora: 1,382 homes, 46 shops, 1,428 units), ozakgyo.com (21 blocks of
    // ground + 13 floors on about 92,440 m², 2,318 parking spaces, revenue-sharing model) and its catalogue;
    // images from the developer's site and landing page.
    coverImage: img("hayat-flora", "aerial-sea", 1680, 1047, "Hayat Flora aerial view in Halkalı, Küçükçekmece, with the Sea of Marmara and Lake Küçükçekmece behind"),
    // Gallery renders: 1920 px versions of the developer's originals (Drive folder «Hayat Flora», owner 2026-11-10),
    // plus street-avenue and entrance-gate from the developer's site. The aerials over 6 MB do not download from Drive.
    gallery: [
      img("hayat-flora", "aerial-night", 1920, 1218, "Hayat Flora blocks at night above Lake Küçükçekmece and the sea"),
      img("hayat-flora", "pool", 1920, 1440, "Hayat Flora outdoor swimming pool with sun loungers"),
      img("hayat-flora", "pool-evening", 1920, 1440, "Hayat Flora social facility café and pool terrace in the evening"),
      img("hayat-flora", "gardens-aerial", 1920, 1280, "Hayat Flora landscaped gardens, pool and play areas seen from above"),
      img("hayat-flora", "garden-homes", 1920, 1280, "Hayat Flora ground-floor home with a private garden"),
      img("hayat-flora", "playground", 1920, 1280, "Hayat Flora children's playground between the blocks"),
      img("hayat-flora", "street-avenue", 1550, 750, "Hayat Flora blocks with shops on the avenue"),
      img("hayat-flora", "entrance-gate", 1680, 1047, "Hayat Flora main entrance and security gate"),
      img("hayat-flora", "rooftop-terrace", 1920, 1080, "Hayat Flora rooftop duplex terrace looking towards the sea"),
      img("hayat-flora", "living-room", 1920, 1039, "Hayat Flora living and dining room with lake and sea views"),
      img("hayat-flora", "living-room-2", 1920, 1225, "Hayat Flora living room"),
      img("hayat-flora", "kitchen", 1920, 1409, "Hayat Flora kitchen with a dining corner and a view of the lake"),
      img("hayat-flora", "bedroom", 1920, 1364, "Hayat Flora master bedroom with a walk-in wardrobe"),
      img("hayat-flora", "kids-room", 1920, 1409, "Hayat Flora children's bedroom")
    ],
    stats: [
      { value: "1,382", labelKey: "apartments" },
      { value: "2029", labelKey: "delivery" },
      { value: "46", labelKey: "shops" },
      { value: "92,440 m²", labelKey: "landArea" },
      { value: "1+1 – 4+1", labelKey: "layout" }
    ],
    // Starting prices from the owner (2026-10-23); the developer has not published floor plans or areas.
    residences: [
      { kind: "apartment", layout: "2+1", price: "$380,000", priceFrom: true },
      { kind: "apartment", layout: "3+1", price: "$450,000", priceFrom: true },
      { kind: "apartment", layout: "4+1", price: "$500,000", priceFrom: true }
    ],
    amenities: [
      "outdoorPool",
      "fitness",
      "sauna",
      "lounge",
      "playground",
      "sportsCourt",
      "joggingTrack",
      "landscaping",
      "privateGarden",
      "indoorParking",
      "security",
      "retail",
      "seismicDesign"
    ]
  },
  {
    slug: "gokturk-kemer-evleri",
    district: "Eyüpsultan",
    city: "Istanbul",
    status: "ongoing",
    // Owner, 2026-10-23: add this Emlak Konut project; eligible for citizenship, no price shown, no known delivery date.
    lifestyle: ["nature"],
    unitsAvailable: true,
    priority: 1.97,
    developer: "Emlak Konut · Ziraat GYO",
    address: "Göktürk Kemer Evleri, Göktürk Merkez Mah., Eyüpsultan, İstanbul",
    price: "on-request",
    // Facts from the project site gokturkkemerevleri.emlakkonut.com.tr (414 homes and 81 villas on 329,321.30 m²,
    // 1+1 to 5+1 homes and 5+1 / 6+1 villas, amenities, Istanbul Airport 15 minutes) and emlakkonut.com.tr; the
    // Ziraat Bankası and Ziraat GYO partnership from Emlak Konut's sales announcement. Renders from the Emlak Konut
    // project page; its construction photos were left out.
    coverImage: img("gokturk-kemer-evleri", "pond-blocks", 1680, 790, "Göktürk Kemer Evleri low-rise blocks around a landscaped pond"),
    gallery: [
      img("gokturk-kemer-evleri", "entrance-avenue", 1680, 790, "Göktürk Kemer Evleri main entrance and tree-lined avenue"),
      img("gokturk-kemer-evleri", "street-blocks", 1680, 790, "Göktürk Kemer Evleri low-rise apartment blocks along a green street"),
      img("gokturk-kemer-evleri", "pond-view", 1680, 790, "Göktürk Kemer Evleri blocks and gardens by the pond"),
      img("gokturk-kemer-evleri", "villa-pool", 1600, 1000, "Göktürk Kemer Evleri villa with a private pool and garden"),
      img("gokturk-kemer-evleri", "villa-stone-pool", 1600, 1000, "Göktürk Kemer Evleri stone-clad villa with a pool and pergola"),
      img("gokturk-kemer-evleri", "villa-white-pool", 1600, 1000, "Göktürk Kemer Evleri white villa with a garden pool"),
      img("gokturk-kemer-evleri", "villa-front", 1600, 1000, "Göktürk Kemer Evleri villa street front"),
      img("gokturk-kemer-evleri", "living-room", 1600, 1000, "Göktürk Kemer Evleri living room with a fireplace"),
      img("gokturk-kemer-evleri", "kitchen", 1600, 1000, "Göktürk Kemer Evleri kitchen with an island"),
      img("gokturk-kemer-evleri", "bedroom", 1600, 1000, "Göktürk Kemer Evleri bedroom"),
      img("gokturk-kemer-evleri", "bathroom", 1600, 1000, "Göktürk Kemer Evleri bathroom with a freestanding bath")
    ],
    villaPhotos: [
      img("gokturk-kemer-evleri", "villa-pool", 1600, 1000, "Göktürk Kemer Evleri villa with a private pool and garden"),
      img("gokturk-kemer-evleri", "villa-stone-pool", 1600, 1000, "Göktürk Kemer Evleri stone-clad villa with a pool and pergola"),
      img("gokturk-kemer-evleri", "villa-terrace-pool", 1600, 1000, "Göktürk Kemer Evleri villa terrace and pool"),
      img("gokturk-kemer-evleri", "villa-white-pool", 1600, 1000, "Göktürk Kemer Evleri white villa with a garden pool"),
      img("gokturk-kemer-evleri", "villa-front", 1600, 1000, "Göktürk Kemer Evleri villa street front"),
      img("gokturk-kemer-evleri", "villa-garden", 1600, 1000, "Göktürk Kemer Evleri villa garden and terrace"),
      img("gokturk-kemer-evleri", "villa-hall", 1600, 1000, "Göktürk Kemer Evleri villa entrance hall and staircase"),
      img("gokturk-kemer-evleri", "living-room", 1600, 1000, "Göktürk Kemer Evleri living room with a fireplace")
    ],
    stats: [
      { value: "414", labelKey: "apartments" },
      { value: "81", labelKey: "villas" },
      { value: "329,321 m²", labelKey: "landArea" },
      { value: "1+1 – 5+1", labelKey: "layout" }
    ],
    // From the floor plans on the project site: "satışa esas brüt" as gross and the net area without balconies or
    // terraces; villa gardens include the pool and pergola. Villas: plan Tip 1-A (5+1) and Tip 4 (6+1).
    residences: [
      { kind: "apartment", layout: "1+1", gross: "71.12 – 72.28 m²", net: "47.02 – 47.84 m²", planTypes: 2 },
      { kind: "apartment", layout: "2+1", gross: "90.66 – 147.03 m²", net: "62.02 – 102.34 m²", planTypes: 7 },
      { kind: "apartment", layout: "3+1", gross: "151.65 – 210.60 m²", net: "102.10 – 148.55 m²", planTypes: 10 },
      { kind: "apartment", layout: "4+1", gross: "201.24 – 265.67 m²", net: "142.16 – 185.91 m²", planTypes: 3 },
      { kind: "apartment", layout: "5+1", gross: "248.20 – 401.76 m²", net: "173.90 – 263.45 m²", planTypes: 3 },
      { kind: "villa", layout: "5+1", gross: "375.52 m²", net: "289.22 m²", garden: "359 – 636 m²", floors: 3 },
      { kind: "villa", layout: "6+1", gross: "536.96 m²", net: "424.74 m²", garden: "680 – 702 m²", floors: 3 }
    ],
    amenities: [
      "outdoorPool",
      "fitness",
      "hamam",
      "sauna",
      "cafe",
      "playground",
      "joggingTrack",
      "landscaping",
      "privatePool",
      "privateGarden",
      "indoorParking"
    ]
  },
  {
    slug: "alya-city-veliefendi",
    district: "Zeytinburnu",
    city: "Istanbul",
    status: "ongoing",
    // Owner, 2026-10-25: keys soon (no date), eligible for citizenship; cheapest 1+1 from $165,000 and 2+1 from
    // $238,000, 3+1 on request; 50% down and the balance over 12 to 24 months, cash and instalment prices differ.
    paymentPlan: { downPercent: 50, months: 12, monthsTo: 24 },
    lifestyle: ["city"],
    unitsAvailable: true,
    priority: 1.98,
    developer: "BOSS4 İnşaat",
    address: "Veliefendi, Ahmet Yesevi Cad. No: 2, Zeytinburnu, İstanbul",
    price: "$165,000",
    priceFrom: true,
    // Facts from the developer's presentation (128,259 m² project, 778 homes: 85 1+1, 282 2+1 open kitchen, 285 2+1
    // closed kitchen, 126 3+1), its site plan (12 blocks A, B1, B2, C, D1, D2, E1, E2, F1, F2, G1, G2) and the
    // distances on its location images; renders from the project folder (the shop street is called Alya Meydan).
    coverImage: img("alya-city-veliefendi", "towers", 1600, 759, "Alya City Veliefendi residential blocks and entrance in Zeytinburnu"),
    gallery: [
      img("alya-city-veliefendi", "gateway", 1600, 748, "Alya City Veliefendi entrance arch to the Alya Meydan shop street"),
      img("alya-city-veliefendi", "plaza", 1600, 759, "Alya City Veliefendi plaza with a fountain, cafés and shops"),
      img("alya-city-veliefendi", "street-shops", 1600, 752, "Alya City Veliefendi blocks with a market and cafés on the street"),
      img("alya-city-veliefendi", "gateway-street", 1600, 816, "Alya City Veliefendi pedestrian street lined with shops and trees"),
      img("alya-city-veliefendi", "site-plan", 1680, 1194, "Alya City Veliefendi site plan with its 12 blocks and gardens")
    ],
    stats: [
      { value: "778", labelKey: "apartments" },
      { value: "12", labelKey: "blocks" },
      { value: "128,259 m²", labelKey: "projectArea" },
      { value: "1+1 – 3+1", labelKey: "layout" }
    ],
    // From the floor plans: "satış brüt" as gross and the net area without the balcony. 2+1: 11 open-kitchen plans
    // (85.09 – 114.34 m²) and 10 closed-kitchen plans (118.28 – 143.12 m²).
    residences: [
      { kind: "apartment", layout: "1+1", gross: "59.49 – 76.52 m²", net: "35.31 – 45.72 m²", planTypes: 3, price: "$165,000", priceFrom: true },
      { kind: "apartment", layout: "2+1", gross: "85.09 – 143.12 m²", net: "51.26 – 87.33 m²", planTypes: 21, price: "$238,000", priceFrom: true },
      { kind: "apartment", layout: "3+1", gross: "152.20 – 180.74 m²", net: "96.51 – 113.27 m²", planTypes: 5 }
    ],
    amenities: [
      "indoorPool",
      "fitness",
      "sauna",
      "gameRoom",
      "meetingRooms",
      "playground",
      "sportsCourt",
      "joggingTrack",
      "landscaping",
      "indoorParking",
      "retail"
    ]
  },
  {
    slug: "alya-konutlari-merkezefendi",
    district: "Zeytinburnu",
    city: "Istanbul",
    status: "ongoing",
    // Owner, 2026-10-25: delivery 2026, title deeds ready, eligible for citizenship and residence; 50% down and the
    // balance over 24 months; no price given. 9 blocks of 5 to 7 floors, 467 homes and 15 shops on about 18,000 m²
    // (17,928.53 m² on the title deed), 1+1 to 7+1 and duplexes.
    paymentPlan: { downPercent: 50, months: 24 },
    lifestyle: ["city"],
    unitsAvailable: true,
    priority: 1.99,
    developer: "BOSS4 İnşaat",
    address: "Merkezefendi Mah., Sabri Ülker Sk. No: 38, Zeytinburnu, İstanbul",
    price: "on-request",
    // Drone photos of the built blocks, renders and the sample apartment from the project folder; the developer's
    // presentation (Cevizlibağ tram 600 m, Koç University Hospital 1.9 km). The plans have no published price list.
    coverImage: img("alya-konutlari-merkezefendi", "aerial-blocks", 1680, 945, "Alya Konutları Merkezefendi completed blocks in Zeytinburnu, drone view"),
    gallery: [
      img("alya-konutlari-merkezefendi", "aerial-courtyards", 1680, 945, "Alya Konutları Merkezefendi blocks and courtyards from above"),
      img("alya-konutlari-merkezefendi", "aerial-wide", 1680, 945, "Alya Konutları Merkezefendi among the green neighbourhood of Merkezefendi, drone view"),
      img("alya-konutlari-merkezefendi", "aerial-gardens", 1080, 608, "Alya Konutları Merkezefendi landscaped gardens and play areas between the blocks"),
      img("alya-konutlari-merkezefendi", "pool-render", 1080, 608, "Alya Konutları Merkezefendi garden pool and pergolas between the blocks"),
      img("alya-konutlari-merkezefendi", "cafe-render", 1080, 608, "Alya Konutları Merkezefendi café pavilion and plaza"),
      img("alya-konutlari-merkezefendi", "living-room", 1680, 1120, "Alya Konutları Merkezefendi sample apartment living room"),
      img("alya-konutlari-merkezefendi", "bedroom", 1680, 1120, "Alya Konutları Merkezefendi sample apartment master bedroom"),
      img("alya-konutlari-merkezefendi", "kitchen", 1680, 1120, "Alya Konutları Merkezefendi sample apartment kitchen")
    ],
    stats: [
      { value: "467", labelKey: "apartments" },
      { value: "15", labelKey: "shops" },
      { value: "2026", labelKey: "delivery" },
      { value: "18,000 m²", labelKey: "landArea" },
      { value: "1+1 – 7+1", labelKey: "layout" }
    ],
    amenities: [
      "indoorPool",
      "fitness",
      "hamam",
      "sauna",
      "playground",
      "landscaping",
      "joggingTrack",
      "security",
      "cctv",
      "indoorParking",
      "elevator",
      "insulation",
      "seismicDesign"
    ]
  },
  {
    slug: "referans-besiktas",
    district: "Beşiktaş",
    city: "Istanbul",
    status: "ongoing",
    // Owner, 2026-10-25: price on request, eligible for citizenship; delivery as in the Drive files (the
    // developer's September 2026 offer: January 2027); 295 homes approved by the owner (not in the developer files).
    // Owner, 2026-10-25: same plan as Referans Pendik for all Referans projects (40% down, 24 to 36 months).
    paymentPlan: { downPercent: 40, months: 24, monthsTo: 36 },
    lifestyle: ["city"],
    unitsAvailable: true,
    priority: 1.991,
    // A TOKİ revenue-sharing project: buyers' payments go to TOKİ collateral accounts (developer's catalogue).
    developer: "Kiler GYO · TOKİ",
    address: "Abbasağa, Beşiktaş, İstanbul",
    price: "on-request",
    // Renders from referansbesiktas.com and its e-catalogue (kilergyo.com): 10 low-rise blocks A–J around a central
    // garden, 900 m² of shared facilities. Architect İki Design Group, interiors Metex Design, landscape Spiga.
    coverImage: img("referans-besiktas", "aerial-sea-view", 1680, 1050, "Referans Beşiktaş blocks around a landscaped courtyard in Abbasağa with the Bosphorus beyond"),
    gallery: [
      img("referans-besiktas", "aerial-courtyard", 1680, 933, "Referans Beşiktaş central garden courtyard framed by the residential blocks"),
      img("referans-besiktas", "central-garden", 1680, 988, "Referans Beşiktaş central garden with water features and walking paths"),
      img("referans-besiktas", "ornamental-pool", 1680, 1050, "Referans Beşiktaş ornamental pool with fountains and blossoming trees"),
      img("referans-besiktas", "landscaped-courtyard", 1680, 933, "Referans Beşiktaş landscaped courtyard with seating areas and greenery"),
      img("referans-besiktas", "main-entrance", 1680, 1050, "Referans Beşiktaş illuminated main entrance at dusk"),
      img("referans-besiktas", "rooftop-terraces-dusk", 1680, 933, "Referans Beşiktaş rooftop terraces of the upper-floor homes at dusk"),
      img("referans-besiktas", "night-aerial-garden", 1680, 1400, "Referans Beşiktaş lit garden paths and ornamental pool at night"),
      img("referans-besiktas", "indoor-pool", 800, 756, "Referans Beşiktaş residents' indoor swimming pool"),
      img("referans-besiktas", "living-room", 1290, 825, "Referans Beşiktaş sample living and dining room"),
      img("referans-besiktas", "master-bedroom", 1145, 825, "Referans Beşiktaş sample master bedroom with balcony doors"),
      img("referans-besiktas", "site-plan", 1112, 884, "Referans Beşiktaş site plan with blocks A to J and the central garden")
    ],
    stats: [
      { value: "295", labelKey: "apartments" },
      { value: "10", labelKey: "blocks" },
      { value: "2027", labelKey: "delivery" },
      { value: "900 m²", labelKey: "communityArea" },
      { value: "1+1 – 5.5+2", labelKey: "layout" }
    ],
    // From the developer's plan sheets and catalogue: the unit's own gross area ("bağımsız bölüm brüt") and the net
    // area including the balcony. Duplexes have private terraces; the 5.5+2 penthouse has a 129.7 m² roof terrace.
    residences: [
      { kind: "apartment", layout: "1+1", gross: "49.90 – 56.80 m²", net: "42.40 – 47.80 m²", planTypes: 4 },
      { kind: "apartment", layout: "2+1", gross: "105.30 – 109.20 m²", net: "91.60 – 95.20 m²", planTypes: 2 },
      { kind: "apartment", layout: "2+1", gross: "97.80 – 108.80 m²", net: "82.20 – 90.30 m²", floors: 2, planTypes: 4 },
      { kind: "apartment", layout: "3+1", gross: "160.80 m²", net: "141.90 m²" },
      { kind: "apartment", layout: "3+1", gross: "166.10 m²", net: "142.70 m²", floors: 2 },
      { kind: "apartment", layout: "4+1", gross: "181.80 m²", net: "159.40 m²" },
      { kind: "apartment", layout: "5.5+2", gross: "282.20 m²", net: "224.30 m²", floors: 2 }
    ],
    amenities: ["indoorPool", "fitness", "sauna", "hamam", "landscaping", "playground", "security", "cctv"]
  },
  {
    slug: "referans-pendik",
    district: "Pendik",
    city: "Istanbul",
    status: "ongoing",
    // Owner, 2026-10-25: eligible for citizenship. Delivery August 2027 (owner, 2026-11-10).
    // Payment plan from a sales-office story the owner sent (2026-10-25): 40% down, balance over 24 to 36 months.
    paymentPlan: { downPercent: 40, months: 24, monthsTo: 36 },
    lifestyle: ["sea", "nature"],
    unitsAvailable: true,
    priority: 1.992,
    // Kiler GYO in partnership with İLBANK (developer's short notes; both logos on the site and catalogue).
    developer: "Kiler GYO · İLBANK",
    address: "Dolayoba, Pendik, İstanbul",
    // Developer's price list "Kas.26" (November 2026, Drive folder REFERANS PENDİK): starting prices per type,
    // excluding VAT, contract and other costs; Kiler GYO may change prices and campaigns.
    price: "$325,000",
    priceFrom: true,
    priceExcludesVat: true,
    residencesMoreOptions: true,
    // Facts from the developer's short notes and catalogue (686 homes, 78,620 m² project area, 35,000 m² of
    // landscaping) and renders from referanspendik.net.tr. The lake on the site plan belongs to the neighbouring park.
    coverImage: img("referans-pendik", "blocks-sea-view", 1680, 1186, "Referans Pendik low-rise blocks among gardens with a view of the Sea of Marmara and the Princes' Islands"),
    gallery: [
      img("referans-pendik", "night-overview", 1680, 1179, "Referans Pendik residential blocks and commercial street on the hillside in the evening"),
      img("referans-pendik", "street-to-the-sea", 1680, 1274, "Referans Pendik tree-lined street leading down towards the sea"),
      img("referans-pendik", "sunset-courtyard", 1680, 822, "Referans Pendik courtyard between the blocks at sunset with the sea on the horizon"),
      img("referans-pendik", "terrace-sea-view", 1680, 1030, "Referans Pendik private terrace overlooking Pendik marina and the sea"),
      img("referans-pendik", "kids-park-landscape", 1680, 1177, "Referans Pendik landscaped children's park and walking paths"),
      img("referans-pendik", "pergola-garden-evening", 1680, 1271, "Referans Pendik pergola garden and walking paths in the evening"),
      img("referans-pendik", "indoor-pool-pavilion", 1680, 1120, "Referans Pendik glass indoor-pool pavilion in the gardens"),
      img("referans-pendik", "indoor-pool", 1625, 1142, "Referans Pendik residents' indoor swimming pool"),
      img("referans-pendik", "living-room", 1680, 1175, "Referans Pendik sample living room"),
      img("referans-pendik", "master-bedroom", 1626, 1142, "Referans Pendik sample master bedroom with a walk-in wardrobe"),
      img("referans-pendik", "commercial-street", 1680, 671, "Referans Pendik commercial street with cafés and shops")
    ],
    siteProgress: {
      date: "2026-03",
      photos: [
        img("referans-pendik", "site-2026-03-blocks-sea", 1920, 1079, "Referans Pendik completed residential blocks on site with Pendik and the sea behind, March 2026"),
        img("referans-pendik", "site-2026-03-facades", 1920, 1079, "Referans Pendik blocks with finished façades on the construction site, March 2026"),
        img("referans-pendik", "site-2026-03-hillside-blocks", 1920, 1079, "Referans Pendik blocks under construction on the hillside, March 2026"),
        img("referans-pendik", "site-2026-03-blocks-aerial", 1920, 1079, "Aerial view of the Referans Pendik blocks and site works, March 2026"),
        img("referans-pendik", "site-2026-03-frame-sea", 1920, 1079, "Referans Pendik concrete frame under construction with a sea view, March 2026"),
        img("referans-pendik", "site-2026-03-foundations", 1920, 1079, "Referans Pendik foundation works for the next blocks, March 2026")
      ]
    },
    stats: [
      { value: "686", labelKey: "apartments" },
      { value: "2027", labelKey: "delivery" },
      { value: "78,620 m²", labelKey: "projectArea" },
      { value: "35,000 m²", labelKey: "greenAndParkArea" },
      { value: "2+1 – 4+1", labelKey: "layout" }
    ],
    // Owner, 2026-11-10: one sample plan per type and a note that other options exist. Areas per type are the
    // min-max "m²" of the November 2026 price list (the plan sheets' "daire kat brüt alanı", e.g. 4+1 A = 191.08 m²);
    // 2.5+1 is not on the price list, so its card shows its own plan sheet (F-2.5+1 Tip 1, garden 174.13 m²).
    residences: [
      { kind: "apartment", layout: "2+1", gross: "82 – 183 m²", price: "$325,000", priceFrom: true, plan: img("referans-pendik", "plan-2-1", 1299, 1482, "Referans Pendik sample 2+1 floor plan (type 2+1 A) with a private garden and terrace") },
      { kind: "apartment", layout: "2.5+1", gross: "127.12 m²", garden: "174.13 m²", plan: img("referans-pendik", "plan-2-5-1", 1600, 1103, "Referans Pendik sample 2.5+1 garden-floor plan with a terrace and private garden") },
      { kind: "apartment", layout: "3+1", gross: "131 – 223 m²", price: "$498,000", priceFrom: true, plan: img("referans-pendik", "plan-3-1", 1600, 1060, "Referans Pendik sample 3+1 floor plan (type 3+1 A) with a terrace and private garden") },
      { kind: "apartment", layout: "4+1", gross: "179 – 191 m²", price: "$714,000", priceFrom: true, plan: img("referans-pendik", "plan-4-1", 1600, 1232, "Referans Pendik sample 4+1 floor plan (type 4+1 A) with a balcony") }
    ],
    amenities: ["indoorPool", "fitness", "sauna", "hamam", "landscaping", "playground", "sportsCourt", "joggingTrack", "indoorParking", "retail", "seaView"]
  },
  {
    slug: "referans-beylikduzu",
    district: "Beylikdüzü",
    city: "Istanbul",
    status: "delivered",
    // Owner, 2026-10-25: price on request, eligible for citizenship. Completed (developer's 2024 stock-exchange
    // filing and the delivered-flat photos).
    // Owner, 2026-10-25: same plan as Referans Pendik for all Referans projects (40% down, 24 to 36 months).
    paymentPlan: { downPercent: 40, months: 24, monthsTo: 36 },
    lifestyle: ["city", "nature"],
    unitsAvailable: true,
    priority: 1.993,
    developer: "Kiler GYO",
    address: "Kavaklı, Kocatepe Cad., Beylikdüzü, İstanbul",
    price: "on-request",
    // Facts from the developer's short notes, catalogue and plan sheets (709 homes, 18 shops on Kocatepe Caddesi,
    // 8 blocks A1, A2, B1, B2, C1, C2, C3, D on 31,000 m², 70% landscaped) and referansbeylikduzu.com.
    coverImage: img("referans-beylikduzu", "courtyard-pools-aerial", 1600, 1003, "Referans Beylikdüzü completed central courtyard with pools, gardens and residential towers"),
    gallery: [
      img("referans-beylikduzu", "towers-central-garden", 1680, 933, "Referans Beylikdüzü towers around a landscaped central garden with fountains"),
      img("referans-beylikduzu", "terrace-garden-view", 1680, 1050, "Referans Beylikdüzü terrace overlooking the central garden and pools"),
      img("referans-beylikduzu", "garden-duplex-pool", 1406, 765, "Referans Beylikdüzü garden duplexes beside a decorative pool"),
      img("referans-beylikduzu", "outdoor-pool-lounge", 1305, 603, "Referans Beylikdüzü outdoor pool and lounge building at dusk"),
      img("referans-beylikduzu", "playground-real", 1680, 1119, "Referans Beylikdüzü children's playground among trees in the completed complex"),
      img("referans-beylikduzu", "street-shops", 1375, 642, "Referans Beylikdüzü street-front shops at the base of the blocks"),
      img("referans-beylikduzu", "living-room-render", 1680, 700, "Referans Beylikdüzü sample living and dining room"),
      img("referans-beylikduzu", "living-dining-render", 1406, 765, "Referans Beylikdüzü open living room with dining area"),
      img("referans-beylikduzu", "kitchen-real", 1680, 1120, "Referans Beylikdüzü kitchen in a delivered apartment"),
      img("referans-beylikduzu", "living-room-real", 1680, 1120, "Referans Beylikdüzü living room in a delivered garden-floor apartment"),
      img("referans-beylikduzu", "entrance-gate", 1680, 577, "Referans Beylikdüzü main entrance gate")
    ],
    stats: [
      { value: "709", labelKey: "apartments" },
      { value: "18", labelKey: "shops" },
      { value: "8", labelKey: "blocks" },
      { value: "31,000 m²", labelKey: "landArea" },
      { value: "2+1 – 5+1", labelKey: "layout" }
    ],
    // From the developer's plan sheets ("genel brüt", without allocated gardens and terraces, as gross; net without
    // balconies) and catalogue (3+1, 3.5+1 and the garden duplexes). Duplexes are garden, terrace or penthouse homes.
    residences: [
      { kind: "apartment", layout: "2+1", gross: "94.70 – 164.45 m²", net: "61.15 – 94.15 m²", planTypes: 7 },
      { kind: "apartment", layout: "2+1", gross: "124.29 – 163.91 m²", net: "84.59 – 99.67 m²", floors: 2, planTypes: 8 },
      { kind: "apartment", layout: "3+1", gross: "182 m²", net: "120.70 m²" },
      { kind: "apartment", layout: "3+1", gross: "219 m²", net: "122.80 m²", floors: 2 },
      { kind: "apartment", layout: "3.5+1", gross: "191 m²", net: "121.90 m²" },
      { kind: "apartment", layout: "4+1", gross: "199.43 – 214.74 m²", net: "134.20 – 137.76 m²", planTypes: 7 },
      { kind: "apartment", layout: "4+1", gross: "227.25 – 243.85 m²", net: "141.82 – 156.51 m²", floors: 2, planTypes: 2 },
      { kind: "apartment", layout: "4.5+1", gross: "227.33 – 238 m²", net: "146.65 – 147.90 m²", planTypes: 2 },
      { kind: "apartment", layout: "4.5+1", gross: "262.64 – 304 m²", net: "163.30 – 167.90 m²", floors: 2, planTypes: 3 },
      { kind: "apartment", layout: "5+1", gross: "266.49 m²", net: "166.30 – 168.54 m²" },
      { kind: "apartment", layout: "5+1", gross: "290.71 m²", net: "184.73 m²", floors: 2 }
    ],
    amenities: [
      "outdoorPool",
      "indoorPool",
      "hamam",
      "sauna",
      "fitness",
      "sportsCourt",
      "joggingTrack",
      "playground",
      "cafe",
      "lounge",
      "landscaping",
      "indoorParking",
      "security",
      "retail"
    ]
  },
  {
    slug: "dragos",
    district: "Maltepe",
    city: "Istanbul",
    status: "ongoing",
    // Owner, 2026-11-10: add Özak Dragos from the Drive folder «DRAGOS»; under construction, delivery March 2027 (owner,
    // same day), eligible for citizenship. Prices, areas and the payment plan from «OZAK DRAGOS OCT2026» (price list:
    // 10% VAT included, may be updated).
    paymentPlan: { downPercent: 50, months: 24 },
    lifestyle: ["sea", "city"],
    unitsAvailable: true,
    priority: 1.994,
    developer: "Özak GYO",
    address: "Özak Dragos, Maltepe, İstanbul",
    price: "$360,000 – $849,000",
    // Facts from the developer's digital catalogue (TR/EN/AR): about 16,000 m² on two facing plots, 5 blocks,
    // 458 apartments 1+1 to 3+1, two outdoor pools, a social facility per plot (pool, fitness, café, lounge, sauna,
    // play areas), M4 metro within walking distance, opposite Maltepe Piazza and Maltepe Park, Maltepe coast 5 minutes.
    // Images: the developer's full-size renders (Drive «OUTSİDE» / «İNSİDE»), resized to 1920 px.
    coverImage: img("dragos", "aerial-islands-dusk", 1920, 1438, "Özak Dragos blocks in Maltepe at dusk with the Princes' Islands and the Sea of Marmara behind"),
    gallery: [
      img("dragos", "aerial-islands", 1920, 1440, "Özak Dragos in central Maltepe with a view of the Princes' Islands"),
      img("dragos", "blocks-street", 1920, 1200, "Özak Dragos residential blocks along the avenue"),
      img("dragos", "balcony-islands", 1920, 1080, "Özak Dragos balcony looking out over the Princes' Islands"),
      img("dragos", "balcony-sunset", 1920, 1080, "Özak Dragos balcony at sunset with a view of the sea and the islands"),
      img("dragos", "pool", 1920, 1198, "Özak Dragos outdoor swimming pool with sun loungers"),
      img("dragos", "gardens-walk", 1920, 1196, "Özak Dragos landscaped gardens and walking path between the blocks"),
      img("dragos", "garden-path", 1920, 1536, "Özak Dragos garden path leading to a block entrance"),
      img("dragos", "central-lawn", 1920, 1599, "Özak Dragos central lawn and gardens"),
      img("dragos", "garden-terrace", 1920, 1467, "Özak Dragos garden terrace with seating"),
      img("dragos", "playground", 1920, 1196, "Özak Dragos children's playground and pool between the blocks"),
      img("dragos", "gardens-evening", 1920, 1196, "Özak Dragos gardens in the evening"),
      img("dragos", "entrance-sign", 1920, 1216, "Özak Dragos main entrance"),
      img("dragos", "living-room-sea", 1920, 806, "Özak Dragos living and dining room with a sea view"),
      img("dragos", "living-room", 1920, 961, "Özak Dragos living room with a dining area"),
      img("dragos", "kitchen", 1920, 1920, "Özak Dragos kitchen with a balcony and a sea view"),
      img("dragos", "master-bedroom", 1920, 1920, "Özak Dragos master bedroom with a walk-in wardrobe"),
      img("dragos", "kids-room", 1920, 1372, "Özak Dragos children's bedroom with a view of the islands"),
      img("dragos", "residents-lounge", 1920, 1232, "Özak Dragos residents' lounge"),
      img("dragos", "cafe", 1920, 1279, "Özak Dragos social facility café"),
      img("dragos", "fitness", 1920, 1152, "Özak Dragos fitness centre")
    ],
    stats: [
      { value: "458", labelKey: "apartments" },
      { value: "2027", labelKey: "delivery" },
      { value: "5", labelKey: "blocks" },
      { value: "16,000 m²", labelKey: "landArea" },
      { value: "1+1 – 3+1", labelKey: "layout" }
    ],
    // Price list «PRICE & SQM RANGES 2026» (October 2026).
    residences: [
      { kind: "apartment", layout: "1+1", gross: "68.19 – 86.40 m²", price: "$360,000 – $399,000" },
      { kind: "apartment", layout: "2+1", gross: "98 – 213.64 m²", price: "$480,000 – $677,000" },
      { kind: "apartment", layout: "3+1", gross: "153 – 218.92 m²", price: "$670,000 – $849,000" }
    ],
    amenities: [
      "seaView",
      "outdoorPool",
      "fitness",
      "sauna",
      "cafe",
      "lounge",
      "playground",
      "sportsCourt",
      "landscaping"
    ]
  },
  {
    slug: "lotus-sisli",
    district: "Şişli",
    city: "Istanbul",
    status: "ongoing",
    paymentPlan: { downPercent: 30, months: 30 },
    lifestyle: ["city"],
    unitsAvailable: true,
    // December 2024 to December 2026 and 3 street shops: the developer's page (2026-10-19).
    timeline: "2024 – 2026",
    priority: 2,
    developer: "Lotus Yapı Proje",
    address: "Kaptan Paşa Mah., Piyale Paşa Blv., Okmeydanı Cad., Şişli / İstanbul",
    coverImage: img("lotus-sisli", "tower-night", 1200, 1263, "Lotus Şişli towers at dusk"),
    gallery: [
      img("lotus-sisli", "aerial-city", 1265, 1164, "Lotus Şişli in the heart of Şişli, aerial view"),
      img("lotus-sisli", "tower-day", 849, 1162, "Lotus Şişli tower and street-front shops"),
      img("lotus-sisli", "tower-garden", 948, 1263, "Lotus Şişli two 18-storey blocks"),
      img("lotus-sisli", "twin-towers", 1257, 1106, "Lotus Şişli entrance and retail podium"),
      img("lotus-sisli", "apartment-living", 1600, 1068, "Lotus Şişli apartment living room and kitchen"),
      img("lotus-sisli", "living-room", 1600, 670, "Lotus Şişli apartment interior"),
      img("lotus-sisli", "penthouse-terrace", 1600, 671, "Lotus Şişli penthouse terrace over the city"),
      img("lotus-sisli", "office-interior", 1600, 671, "Lotus Şişli office interior"),
      img("lotus-sisli", "aerial-towers", 1920, 1200, "Lotus Şişli towers from above in the Şişli skyline"),
      img("lotus-sisli", "rooftop-night", 1920, 960, "Lotus Şişli rooftop at night"),
      img("lotus-sisli", "meeting-room", 1920, 1080, "Lotus Şişli meeting room")
    ],
    stats: [
      { value: "320", labelKey: "homeOffices" },
      { value: "2 × 18", labelKey: "blocksFloors" },
      { value: "35,342 m²", labelKey: "constructionArea" },
      { value: "1+1 · 2+1", labelKey: "layout" },
      { value: "2026", labelKey: "delivery" }
    ],
    residences: [
      { kind: "apartment", layout: "1+1", gross: "57.56 m²", net: "43.41 m²", saleable: "75.97 m²" },
      { kind: "apartment", layout: "2+1", gross: "83.75 m²", net: "63.16 m²", saleable: "110.53 m²" },
      { kind: "office", layout: "closed", gross: "57.56 m²", net: "43.41 m²", saleable: "75.97 m²" },
      { kind: "office", layout: "open", gross: "83.75 m²", net: "63.16 m²", saleable: "110.53 m²" }
    ],
    amenities: [
      "indoorPool",
      "fitness",
      "pilates",
      "hamam",
      "sauna",
      "concierge",
      "lounge",
      "meetingRooms",
      "cafe",
      "cinemaRoom",
      "gameRoom",
      "indoorParking",
      "security",
      "cctv",
      "retail"
    ]
  },
  {
    slug: "lotus-manzara-guzelce",
    district: "Büyükçekmece",
    city: "Istanbul",
    status: "delivered",
    lifestyle: ["sea", "nature"],
    unitsAvailable: true,
    // October 2023 to December 2025 and ~12,000 m² built: the developer's page (2026-10-19).
    timeline: "2023 – 2025",
    priority: 3,
    developer: "Lotus Yapı Proje",
    address: "Güzelce Mah., Hukukçular Cad. No:14, Büyükçekmece / İstanbul",
    coverImage: img("lotus-manzara-guzelce", "villa-exterior", 1166, 640, "Lotus Manzara Güzelce detached villa exterior"),
    gallery: [
      img("lotus-manzara-guzelce", "completed-villas", 1920, 1080, "Lotus Manzara Güzelce completed villas, photographed on site"),
      img("lotus-manzara-guzelce", "completed-garden-lane", 1920, 1080, "Lotus Manzara Güzelce completed villas and garden lane"),
      img("lotus-manzara-guzelce", "completed-villa-row", 1920, 1080, "Lotus Manzara Güzelce row of completed villas"),
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
    villaPhotos: [
      img("lotus-manzara-guzelce", "completed-villas", 1920, 1080, "Lotus Manzara Güzelce completed villas, photographed on site"),
      img("lotus-manzara-guzelce", "villa-row", 1331, 640, "Lotus Manzara Güzelce villas with private gardens"),
      img("lotus-manzara-guzelce", "aerial-villas", 1500, 640, "Lotus Manzara Güzelce aerial view of the villas"),
      img("lotus-manzara-guzelce", "living-room", 1286, 640, "Lotus Manzara Güzelce living room"),
      img("lotus-manzara-guzelce", "kitchen", 1286, 640, "Lotus Manzara Güzelce kitchen")
    ],
    stats: [
      { value: "32", labelKey: "villas" },
      { value: "12,855 m²", labelKey: "landArea" },
      { value: "6+2", labelKey: "villaLayout" },
      { value: "343 m²", labelKey: "grossArea" },
      { value: "12,000 m²", labelKey: "constructionArea" }
    ],
    residences: [{ kind: "villa", layout: "6+2", gross: "343.15 m²", net: "298.43 m²", floors: 3 }],
    amenities: community(["seaViewTerrace", "privateGarden", "spa"], VILLA_SWAP)
  },
  {
    slug: "lotus-manzara-beylikduzu",
    district: "Beylikdüzü",
    city: "Istanbul",
    status: "delivered",
    lifestyle: ["sea"],
    unitsAvailable: true,
    // 5,600 m² land, ~5,500 m² built, January to December 2023: the developer's page (2026-10-19).
    timeline: "2023",
    priority: 4,
    developer: "Lotus Yapı Proje",
    address: "Dereağzı Mah., Şenyurt Cad. No:35, Beylikdüzü / İstanbul",
    coverImage: img("lotus-manzara-beylikduzu", "villas-entrance", 1920, 955, "Lotus Manzara Beylikdüzü villas and gated entrance"),
    gallery: [
      img("lotus-manzara-beylikduzu", "completed-aerial", 1920, 1280, "Lotus Manzara Beylikdüzü completed villas from the air"),
      img("lotus-manzara-beylikduzu", "twin-villas", 1778, 1000, "Lotus Manzara Beylikdüzü twin villas"),
      img("lotus-manzara-beylikduzu", "aerial-render", 1778, 1000, "Lotus Manzara Beylikdüzü villas among the trees"),
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
    villaPhotos: [
      img("lotus-manzara-beylikduzu", "completed-aerial", 1920, 1280, "Lotus Manzara Beylikdüzü completed villas from the air"),
      img("lotus-manzara-beylikduzu", "villa-type-a", 1043, 1036, "Lotus Manzara Beylikdüzü type A detached villa"),
      img("lotus-manzara-beylikduzu", "villa-type-b", 1043, 1012, "Lotus Manzara Beylikdüzü type B twin villas"),
      img("lotus-manzara-beylikduzu", "twin-villas", 1778, 1000, "Lotus Manzara Beylikdüzü twin villas"),
      img("lotus-manzara-beylikduzu", "living-room", 1920, 993, "Lotus Manzara Beylikdüzü living room")
    ],
    stats: [
      { value: "16", labelKey: "villas" },
      { value: "5,600 m²", labelKey: "landArea" },
      { value: "5+2", labelKey: "villaLayout" },
      { value: "303 – 322 m²", labelKey: "grossArea" },
      { value: "5,500 m²", labelKey: "constructionArea" }
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
    lifestyle: ["sea", "nature"],
    unitsAvailable: true,
    // Seafront, ~10,000 m² built, October 2023 to June 2025: the developer's page (2026-10-19).
    timeline: "2023 – 2025",
    priority: 5,
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
      { value: "3+1 · 5+2", labelKey: "layout" },
      { value: "10,000 m²", labelKey: "constructionArea" }
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
    lifestyle: ["sea"],
    unitsAvailable: true,
    priority: 6,
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
    developer: "Lotus Yapı Proje",
    status: "delivered",
    lifestyle: ["nature", "city"],
    unitsAvailable: true,
    timeline: "2023 – 2025",
    priority: 7,
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
    developer: "Lotus Yapı Proje",
    status: "delivered",
    lifestyle: ["city"],
    soldOut: true,
    // February 2021 to December 2023, 6,800 m² land, ~35,200 m² built, 3 blocks × 11 floors: the developer's page (2026-10-19).
    timeline: "2021 – 2023",
    priority: 8,
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
      { value: "47", labelKey: "shops" },
      { value: "3 × 11", labelKey: "blocksFloors" },
      { value: "35,200 m²", labelKey: "constructionArea" }
    ],
    amenities: community()
  },
  {
    slug: "lotus-koru-1",
    district: "Beylikdüzü",
    city: "Istanbul",
    developer: "Lotus Yapı Proje",
    status: "delivered",
    lifestyle: ["nature"],
    soldOut: true,
    timeline: "2022 – 2024",
    priority: 9,
    coverImage: img("lotus-koru-1", "residential-exterior", 1600, 923, "Lotus Koru 1 residential exterior"),
    gallery: [
      img("lotus-koru-1", "low-rise-residential-concept", 2000, 1333, "Lotus Koru 1 low-rise residential concept"),
      img("lotus-koru-1", "green-living-project", 2000, 1462, "Lotus Koru 1 green living project"),
      img("lotus-koru-1", "nature-inspired-residences", 2000, 1429, "Lotus Koru 1 nature-inspired residences"),
      img("lotus-koru-1", "landscape-focused-housing", 1600, 1142, "Lotus Koru 1 landscape-focused housing"),
      img("lotus-koru-1", "green-focused-residential-project", 1600, 800, "Lotus Koru 1 green-focused residential project"),
      img("lotus-koru-1", "modern-green-community", 1600, 1142, "Lotus Koru 1 modern green community"),
      img("lotus-koru-1", "gardens-pool", 1733, 1000, "Lotus Koru 1 gardens and pool between the blocks"),
      img("lotus-koru-1", "sports-court", 1733, 1000, "Lotus Koru 1 sports court, pool and walking path")
    ],
    stats: [
      // 10,500 m² land (6,500 m² landscaped + 7,000 m² park), 10 blocks × 5 floors, 27 shops, ~33,000 m² built: the developer's page (2026-10-19).
      { value: "144", labelKey: "apartments" },
      { value: "27", labelKey: "shops" },
      { value: "10 × 5", labelKey: "blocksFloors" },
      { value: "33,000 m²", labelKey: "constructionArea" },
      { value: "13,500 m²", labelKey: "greenAndParkArea" }
    ],
    amenities: community()
  },
  {
    slug: "marmara-haven-villa",
    district: "Büyükçekmece",
    city: "Istanbul",
    status: "delivered",
    lifestyle: ["sea"],
    timeline: "2024 – 2026",
    // The one project HADARA developed itself (owner, 2026-10-10); every other project is marketed for its developer.
    developer: "HADARA Real Estate",
    // Prices from the owner on 2026-09-30 (VAT included, 4% title deed fee not included).
    price: "$1,550,000 – $1,650,000",
    landing: true,
    // Confirmed by the owner on 2026-09-27 (no monthly fee answer, so no "aidat" row).
    verified: {
      updated: "2026-09-27",
      items: ["titleDeed", "citizenship", "permit", "iskan", "completed", "earthquake", "encumbrance", "residence", "warranty"],
      documents: true
    },
    priority: 10,
    // Owner's photos, 2026-10-10: the page opens on the same dusk shot as the villa's ads.
    coverImage: img("marmara-haven-villa", "dusk-pool", 1200, 1600, "Marmara Haven Villa at dusk with its private pool"),
    gallery: [
      img("marmara-haven-villa", "drone", 2000, 1500, "Marmara Haven Villa aerial view with pool and terrace"),
      img("marmara-haven-villa", "aerial-top", 2000, 1500, "Marmara Haven Villa plot seen from above"),
      img("marmara-haven-villa", "sunset", 1500, 2000, "Sunset over the Sea of Marmara from Marmara Haven Villa"),
      img("marmara-haven-villa", "entrance", 1500, 2000, "Marmara Haven Villa entrance with marble floor"),
      img("marmara-haven-villa", "living-sea", 1500, 2000, "Marmara Haven Villa living room opening onto the terrace"),
      img("marmara-haven-villa", "living-fireplace", 1500, 2000, "Marmara Haven Villa living room with fireplace"),
      img("marmara-haven-villa", "kitchen-island", 1500, 2000, "Marmara Haven Villa kitchen with island"),
      img("marmara-haven-villa", "bedroom-sea", 1500, 2000, "Marmara Haven Villa bedroom with sea view"),
      img("marmara-haven-villa", "bedroom-2", 1500, 2000, "Marmara Haven Villa bedroom"),
      img("marmara-haven-villa", "bathroom", 1500, 2000, "Marmara Haven Villa bathroom"),
      img("marmara-haven-villa", "hall", 1500, 2000, "Marmara Haven Villa entrance hall"),
      img("marmara-haven-villa", "attic", 1200, 1600, "Marmara Haven Villa roof floor room with sea view"),
      img("marmara-haven-villa", "roof-terrace", 1200, 1600, "Marmara Haven Villa rooftop terrace"),
      img("marmara-haven-villa", "balcony-pool", 1500, 2000, "Marmara Haven Villa pool and sea view from the balcony"),
      img("marmara-haven-villa", "pool-deck", 1200, 1600, "Marmara Haven Villa wooden deck by the pool"),
      img("marmara-haven-villa", "garden-wide", 2000, 1500, "Marmara Haven Villa garden and pool"),
      img("marmara-haven-villa", "drone-front", 2000, 1500, "Marmara Haven Villa front with pool, aerial view"),
      img("marmara-haven-villa", "side-entrance", 1200, 1600, "Marmara Haven Villa side entrance with a glimpse of the sea"),
      img("marmara-haven-villa", "exterior-facade", 1200, 1600, "Marmara Haven Villa exterior facade"),
      img("marmara-haven-villa", "private-pool", 1500, 2000, "Marmara Haven Villa private pool")
    ],
    villaPhotos: [
      img("marmara-haven-villa", "drone", 2000, 1500, "Marmara Haven Villa aerial view with pool and terrace"),
      img("marmara-haven-villa", "dusk-pool", 1200, 1600, "Marmara Haven Villa at dusk with its private pool"),
      img("marmara-haven-villa", "living-sea", 1500, 2000, "Marmara Haven Villa living room opening onto the terrace"),
      img("marmara-haven-villa", "roof-terrace", 1200, 1600, "Marmara Haven Villa rooftop terrace"),
      img("marmara-haven-villa", "private-pool", 1500, 2000, "Marmara Haven Villa private pool")
    ],
    stats: [
      { value: "637 m²", labelKey: "landArea" },
      { value: "576.63 m²", labelKey: "grossArea" },
      { value: "5", labelKey: "bedrooms" },
      { value: "7", labelKey: "bathrooms" },
      { value: "4", labelKey: "floors" }
    ],
    video: {
      sources: {
        small: "/videos/marmara-haven-villa/tour-540.mp4",
        large: "/videos/marmara-haven-villa/tour-720.mp4"
      },
      vertical: true,
      poster: img("marmara-haven-villa", "drone-front", 2000, 1500, "Marmara Haven Villa video tour")
    },
    floorPlan: [
      { gross: "138.62 m²", net: "105.40 m²", image: img("marmara-haven-villa", "basement-room", 1500, 2000, "Marmara Haven Villa basement level") },
      { gross: "223.37 m²", net: "108.60 m²", image: img("marmara-haven-villa", "living-sea", 1500, 2000, "Marmara Haven Villa ground floor living room") },
      { gross: "143.19 m²", net: "126.21 m²", image: img("marmara-haven-villa", "bedroom-sea", 1500, 2000, "Marmara Haven Villa first floor bedroom") },
      {
        gross: "103.66 m²",
        net: "82.82 m²",
        image: img("marmara-haven-villa", "attic", 1200, 1600, "Marmara Haven Villa roof floor with sea view"),
        seaView: true
      },
      {
        image: img("marmara-haven-villa", "terrace", 1200, 1600, "Marmara Sea in daylight seen from the Marmara Haven Villa roof terrace"),
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
