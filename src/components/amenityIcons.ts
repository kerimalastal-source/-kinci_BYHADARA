import type { AmenityKey } from "../data/projects";

// 24×24 line icons drawn with currentColor, one per amenity.
const PATHS: Record<AmenityKey, string> = {
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
