export interface CityOption {
  value: string;
  districts: string[];
}

export const cityOptions: CityOption[] = [
  {
    value: "istanbul",
    districts: [
      "beylikduzu",
      "buyukcekmece",
      "basaksehir",
      "esenyurt",
      "bahcesehir",
      "kagithane",
      "sisli",
      "besiktas",
      "kadikoy",
      "uskudar",
      "maltepe",
      "pendik"
    ]
  },
  { value: "ankara", districts: ["cankaya", "kecioren", "yenimahalle", "etimesgut", "mamak"] },
  { value: "izmir", districts: ["konak", "karsiyaka", "bornova", "buca", "cesme"] },
  { value: "antalya", districts: ["muratpasa", "konyaalti", "kepez", "alanya", "lara"] },
  { value: "bursa", districts: ["nilufer", "osmangazi", "yildirim"] },
  { value: "trabzon", districts: ["ortahisar", "yomra", "akcaabat"] },
  { value: "yalova", districts: ["merkez", "ciftlikkoy", "cinarcik"] },
  { value: "sakarya", districts: ["adapazari", "serdivan"] },
  { value: "mersin", districts: ["mezitli", "yenisehir", "toroslar"] },
  { value: "konya", districts: ["selcuklu", "meram"] },
  { value: "other", districts: ["other"] }
];

export const propertyTypeOptions: string[] = ["2-1", "3-1", "villa", "other"];

export const conditionOptions: string[] = ["new-only", "new-or-resale"];

export const budgetOptions: string[] = [
  "50-100",
  "100-150",
  "150-200",
  "200-250",
  "250-300",
  "300-350",
  "350-400",
  "400-450",
  "450-500",
  "500-550",
  "550-600",
  "600-plus"
];

export const floorOptions: string[] = ["ground", "low", "middle", "high", "penthouse", "no-preference"];
