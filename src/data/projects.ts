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
  kind: "apartment" | "villa" | "office";
  /** Room layout as sold in Türkiye, e.g. "3+1"; for offices "closed" or "open". */
  layout: string;
  /** Plan variant letter from the catalog, e.g. "A". */
  variant?: string;
  gross: string;
  net?: string;
  /** Saleable gross area (Turkish "satışa esas brüt"), when the catalog quotes it. */
  saleable?: string;
  garden?: string;
  floors?: number;
  planTypes?: number;
  /** Price range as quoted by the team, shown as written (e.g. "$200,000 – $250,000"). */
  price?: string;
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
  /** Instalment plan confirmed by the owner (2026-10-14): down payment % and the months the balance is spread over. */
  paymentPlan?: { downPercent: number; months: number };
  /** Setting, taken from the project's own description: by the sea (or sea views), green and calm, or city. Used by "Find My Project". */
  lifestyle?: Lifestyle[];
  /** Ad landing page: adds an "I'm interested" button to the hero. */
  landing?: boolean;
  /** Street address from the catalog, shown as written. */
  address?: string;
  coverImage: ProjectImage;
  gallery: ProjectImage[];
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
    // No price list from the developer yet.
    price: "on-request",
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
    coverImage: img("casablu-vadi", "project-aerial", 2000, 855, "CasaBlu Vadi blocks beside Beylikdüzü Yaşam Vadisi and the Marmara Sea, aerial view"),
    gallery: [
      img("casablu-vadi", "aerial-valley-sea", 2000, 1415, "CasaBlu Vadi between Yaşam Vadisi and the Marmara Sea, with Ambarlı in the distance"),
      img("casablu-vadi", "living-sea-sunset", 2000, 1100, "CasaBlu Vadi living room opening onto a sea-view terrace at sunset"),
      img("casablu-vadi", "living-terrace", 2000, 1146, "CasaBlu Vadi living room and terrace above the sea"),
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
    // Catalog plan pages: "satışa esas brüt" as gross, and net area. The 5+1 type and one 4+1 type are on catalog
    // pages not read yet; one 6+1 type's saleable area is cut off in the catalog itself (hence "+").
    residences: [
      { kind: "apartment", layout: "2+1", gross: "102.51 – 192.56 m²", net: "56.80 – 98.25 m²", planTypes: 7 },
      { kind: "apartment", layout: "3+1", gross: "155.94 – 250.92 m²", net: "100.00 – 148.15 m²", planTypes: 13 },
      { kind: "apartment", layout: "4+1", gross: "194.15 – 382.87 m²", net: "126.25 – 223.15 m²" },
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
