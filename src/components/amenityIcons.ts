import type { AmenityKey } from "../data/projects";

// 24×24 line icons drawn with currentColor, one per amenity.
const PATHS: Record<AmenityKey, string> = {
  elevator: '<rect x="4" y="2.5" width="16" height="19" rx="1.5"/><path d="M12 2.5v19M7 9.5l1.5-2 1.5 2M14 7.5l1.5 2 1.5-2"/>',
  underfloorHeating:
    '<path d="M2.5 20.5h19"/><path d="M5 17.5c1.2 0 1.2-1.2 2.4-1.2s1.2 1.2 2.4 1.2 1.2-1.2 2.4-1.2 1.2 1.2 2.4 1.2 1.2-1.2 2.4-1.2 1.2 1.2 2.4 1.2"/><path d="M8 13c-.9-1.3.9-2.2 0-3.5M12 13c-.9-1.3.9-2.2 0-3.5M16 13c-.9-1.3.9-2.2 0-3.5M8 6.5c-.9-1.3.9-2.2 0-3.5M12 6.5c-.9-1.3.9-2.2 0-3.5M16 6.5c-.9-1.3.9-2.2 0-3.5"/>',
  fireplace:
    '<path d="M3 21.5V6h18v15.5M1.5 6h21M1.5 3h21v3"/><path d="M7 21.5V11h10v10.5"/><path d="M12 19.5c-1.6 0-2.5-1-2.5-2.3 0-1.6 1.5-2.2 1.8-3.7 1.4.9 3.2 2.1 3.2 3.9 0 1.2-1 2.1-2.5 2.1z"/>',
  waterWell: '<path d="M12 2.5c3 3.8 5.5 6.9 5.5 10a5.5 5.5 0 0 1-11 0c0-3.1 2.5-6.2 5.5-10z"/><path d="M12 21.5v-3.5M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  flexBasement:
    '<rect x="2.5" y="4" width="19" height="13" rx="1.5"/><path d="m10 8 5 2.5-5 2.5z"/><path d="M8 21h8M12 17v4"/>',
  playground: '<path d="M4 21V8l4-4 4 4v13M4 12h8"/><path d="M12 12c3 0 5.5 2 8 7M16 21h5"/><circle cx="8" cy="8.5" r="1"/>',
  sportsCourt: '<rect x="2.5" y="5" width="19" height="14" rx="1.5"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.8"/><path d="M2.5 9.5h3v5h-3M21.5 9.5h-3v5h3"/>',
  joggingTrack:
    '<circle cx="14" cy="4" r="1.8"/><path d="m9 21 2.5-5.5 3 2.5V22M6 11.5 9 8l4 1.5 2.5 3 3 .5"/><path d="m11.5 15.5 1.5-5.5"/>',
  separatePools:
    '<circle cx="7" cy="4.5" r="1.6"/><circle cx="17" cy="4.5" r="1.6"/><path d="M7 6.5v5M4.8 8.5h4.4M17 6.5v5M15 14l2-2.5 2 2.5"/><path d="M12 3v11"/><path d="M2 17.5c1.7 0 1.7-1.2 3.3-1.2s1.7 1.2 3.4 1.2 1.7-1.2 3.3-1.2 1.7 1.2 3.4 1.2 1.7-1.2 3.3-1.2 1.6 1.2 3.3 1.2"/><path d="M2 21c1.7 0 1.7-1.2 3.3-1.2S7 21 8.7 21s1.7-1.2 3.3-1.2 1.7 1.2 3.4 1.2 1.7-1.2 3.3-1.2S20.3 21 22 21"/>',
  cctv: '<path d="M3.5 7.5 17 3.5l1.6 5.4-13.5 4z"/><path d="m18.6 8.9 2.4-.7M10.5 11.4l1.2 3.6H6.5M6.5 12.5V20M3.5 20h6"/>',
  cleaning: '<path d="M14.5 3 10 12M7 12h7l2.5 9H4.5z"/><path d="M8.5 16.5v4.5M12 16.5v4.5"/><path d="M18.5 4.5v3M17 6h3M20.5 10v2M19.5 11h2"/>',
  buildQuality:
    '<path d="M12 2.5 14.6 7l5 .9-3.5 3.7.7 5.1L12 14.5l-4.8 2.2.7-5.1L4.4 7.9l5-.9z"/><path d="M8 21.5h8"/>',
  spa: '<path d="M8 2.5c-.9 1.3.9 2.2 0 3.5M12 2.5c-.9 1.3.9 2.2 0 3.5M16 2.5c-.9 1.3.9 2.2 0 3.5"/><path d="M3.5 21h17M5 21v-6.5a7 7 0 0 1 14 0V21"/><path d="M9.5 21v-3a2.5 2.5 0 0 1 5 0v3"/>',
  insulation: '<path d="M3 11 12 3.5l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M8.5 13.5c1.2 0 1.2 1.5 2.3 1.5s1.2-1.5 2.4-1.5 1.2 1.5 2.3 1.5M8.5 17.5c1.2 0 1.2 1.5 2.3 1.5s1.2-1.5 2.4-1.5 1.2 1.5 2.3 1.5"/>',
  privatePool:
    '<rect x="3" y="9.5" width="18" height="11" rx="2"/><path d="M5.5 14.5c1.1 0 1.1-1 2.2-1s1.1 1 2.2 1 1.1-1 2.1-1 1.1 1 2.2 1 1.1-1 2.2-1 1.1 1 2.1 1M5.5 18c1.1 0 1.1-1 2.2-1s1.1 1 2.2 1 1.1-1 2.1-1 1.1 1 2.2 1 1.1-1 2.2-1 1.1 1 2.1 1"/><path d="M15 9.5V4.5a1.5 1.5 0 0 1 3 0"/>',
  seaView:
    '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/><path d="M4 21c1.3 0 1.3-.9 2.7-.9s1.3.9 2.6.9 1.3-.9 2.7-.9 1.3.9 2.6.9 1.3-.9 2.7-.9 1.3.9 2.7.9"/>',
  rooftopTerrace: '<path d="M3 21V11h18v10"/><path d="M1.5 11 12 4l10.5 7"/><path d="M7 21v-5h4v5M14.5 14.5h4v3h-4z"/>',
  masterSuite: '<path d="M3 19v-7.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2V19M3 15.5h18M3 19v2M21 19v2"/><path d="M6 9.5V6.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 6.5v3"/>',
  equippedKitchen:
    '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M8 6h.01M11 6h.01M16 6h1"/><rect x="7" y="12" width="10" height="6" rx="1"/>',
  outdoorPool:
    '<path d="M8 14V5.5a2 2 0 0 1 4 0M14 14V5.5a2 2 0 0 1 4 0M8 8.5h6M8 11.5h6"/><path d="M2 17.5c1.7 0 1.7-1.2 3.3-1.2s1.7 1.2 3.4 1.2 1.7-1.2 3.3-1.2 1.7 1.2 3.4 1.2 1.7-1.2 3.3-1.2 1.6 1.2 3.3 1.2"/><path d="M2 21c1.7 0 1.7-1.2 3.3-1.2S7 21 8.7 21s1.7-1.2 3.3-1.2 1.7 1.2 3.4 1.2 1.7-1.2 3.3-1.2S20.3 21 22 21"/>',
  fitness: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  sauna:
    '<path d="M8 2.5c-.9 1.3.9 2.2 0 3.5M12 2.5c-.9 1.3.9 2.2 0 3.5M16 2.5c-.9 1.3.9 2.2 0 3.5"/><rect x="3" y="9" width="18" height="11.5" rx="1.5"/><path d="M3 14.5h18M7 20.5v-6M17 20.5v-6"/>',
  hamam: '<path d="M3.5 21h17M5 21v-8a7 7 0 0 1 14 0v8"/><path d="M12 6V2.5M9.5 21v-4a2.5 2.5 0 0 1 5 0v4"/>',
  smartHome:
    '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M8.8 14.2a4.5 4.5 0 0 1 6.4 0M10.7 16.4a1.8 1.8 0 0 1 2.6 0"/>',
  indoorParking: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9.5 17V7h3.5a3 3 0 0 1 0 6H9.5"/>',
  privateParking: '<path d="M3 21V9.5L12 4l9 5.5V21"/><path d="M6.5 21v-7.5h11V21M6.5 17h11"/>',
  evCharging: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>',
  security: '<path d="M12 2.5 20 5.5v6.2c0 4.6-3.4 8.4-8 9.3-4.6-.9-8-4.7-8-9.3V5.5z"/><path d="m8.5 12 2.4 2.4 4.6-4.9"/>',
  landscaping: '<path d="M12 21.5v-7"/><path d="M12 14.5c-3.9 0-6.5-2.6-6.5-5.9S8.1 2.5 12 2.5s6.5 2.8 6.5 6.1-2.6 5.9-6.5 5.9z"/><path d="M8.5 21.5h7"/>',
  privateGarden: '<path d="M4.5 21v-9.5l2-2.5 2 2.5V21M10 21v-9.5l2-2.5 2 2.5V21M15.5 21v-9.5l2-2.5 2 2.5V21M2.5 15h19"/>',
  seaViewTerrace:
    '<circle cx="12" cy="9" r="3.2"/><path d="M12 2.5v1.3M6 9H4.5M19.5 9H18M7.6 4.6l.9.9M16.4 4.6l-.9.9"/><path d="M2 16c1.7 0 1.7-1.2 3.3-1.2s1.7 1.2 3.4 1.2 1.7-1.2 3.3-1.2 1.7 1.2 3.4 1.2 1.7-1.2 3.3-1.2S20.3 16 22 16"/><path d="M2 19.8c1.7 0 1.7-1.2 3.3-1.2s1.7 1.2 3.4 1.2 1.7-1.2 3.3-1.2 1.7 1.2 3.4 1.2 1.7-1.2 3.3-1.2 1.6 1.2 3.3 1.2"/>',
  generator: '<rect x="3" y="7" width="18" height="12.5" rx="2"/><path d="M12.8 9.5 10 13.8h4l-2.8 4.2M7 7V4.5M17 7V4.5"/>',
  retail: '<path d="M3.5 9 5 4h14l1.5 5M3.5 9v11.5h17V9M3.5 9h17"/><path d="M9.5 20.5v-6h5v6"/>',
  airConditioning: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="M9.5 4 12 6.3 14.5 4M9.5 20 12 17.7l2.5 2.3"/>'
};

export function amenityIcon(key: AmenityKey): string {
  return `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[key]}</svg>`;
}
