// 24×24 line icons for the key-figures band on project pages, keyed by stat labelKey.
const PATHS: Record<string, string> = {
  apartments:
    '<rect x="4.5" y="2.5" width="15" height="19" rx="1"/><path d="M8.5 6.5h2M13.5 6.5h2M8.5 10h2M13.5 10h2M8.5 13.5h2M13.5 13.5h2M10.5 21.5v-4h3v4"/>',
  villas: '<path d="M2.5 11 12 3.5l9.5 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-5.5h4V21"/>',
  exclusiveVilla:
    '<path d="M2.5 11 12 3.5l9.5 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M12 11.2l1.1 2.2 2.4.3-1.8 1.7.4 2.4-2.1-1.1-2.1 1.1.4-2.4-1.8-1.7 2.4-.3z"/>',
  floors: '<path d="M12 3 21.5 8 12 13 2.5 8z"/><path d="m2.5 12 9.5 5 9.5-5"/><path d="m2.5 16 9.5 5 9.5-5"/>',
  blocksFloors: '<path d="M12 3 21.5 8 12 13 2.5 8z"/><path d="m2.5 12 9.5 5 9.5-5"/><path d="m2.5 16 9.5 5 9.5-5"/>',
  blocks:
    '<rect x="2.5" y="7" width="8" height="14.5" rx="1"/><rect x="13.5" y="2.5" width="8" height="19" rx="1"/><path d="M5.5 11h2M5.5 14.5h2M16.5 6.5h2M16.5 10h2M16.5 13.5h2"/>',
  landArea:
    '<path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5"/><path d="m7 15 3.5-4.5 2.5 3 1.5-2 2.5 3.5z"/>',
  constructionArea:
    '<path d="M4 21.5V4.5L7 2.5v19M7 4.5h13.5M7 8l13.5-3.5"/><path d="M18.5 4.5v6.5"/><rect x="16.5" y="11" width="4" height="3" rx=".5"/><path d="M2 21.5h9"/>',
  greenAndParkArea:
    '<path d="M12 21.5v-8"/><path d="M12 13.5c-3.8 0-6.3-2.4-6.3-5.5S8.2 2.5 12 2.5s6.3 2.4 6.3 5.5-2.5 5.5-6.3 5.5z"/><path d="M6 21.5h12M9.5 10l2.5 2.5 2.5-3"/>',
  grossArea: '<path d="M3 3h18v18H3z"/><path d="M8 3v3M13 3v5M18 3v3M3 8h3M3 13h5M3 18h3"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 12h8.5V3M11.5 16v5M11.5 12h9.5M16 12v-3"/>',
  villaLayout: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 12h8.5V3M11.5 16v5M11.5 12h9.5M16 12v-3"/>',
  delivery:
    '<circle cx="8" cy="15" r="4.5"/><path d="m11.2 11.8 9.3-9.3M17.5 5.5l2.5 2.5M15 8l2 2"/><circle cx="8" cy="15" r="1.2"/>',
  offices: '<rect x="2.5" y="7" width="19" height="13.5" rx="2"/><path d="M8.5 7V4.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V7M2.5 12.5h19M10.5 12.5v2h3v-2"/>',
  shops: '<path d="M3.5 9 5 4h14l1.5 5M3.5 9v11.5h17V9M3.5 9h17"/><path d="M9.5 20.5v-6h5v6"/>',
  bathrooms:
    '<path d="M3 12h18v2.5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><path d="M6 12V5a2 2 0 0 1 3.6-1.2M8 21.5l1-2M16 21.5l-1-2"/>',
  livingRoom:
    '<path d="M4.5 11V8a2.5 2.5 0 0 1 2.5-2.5h10A2.5 2.5 0 0 1 19.5 8v3"/><path d="M2.5 13a2 2 0 0 1 4 0v2h11v-2a2 2 0 0 1 4 0v5.5h-19zM5 18.5V21M19 18.5V21"/>',
  terrace:
    '<path d="M12 3.5C7 3.5 3.5 6.5 3 10h18c-.5-3.5-4-6.5-9-6.5zM12 10v11.5M8.5 21.5h7"/><path d="M3 21.5V15h18v6.5"/>'
};

const FALLBACK = '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>';

export function statIcon(labelKey: string): string {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[labelKey] ?? FALLBACK}</svg>`;
}
