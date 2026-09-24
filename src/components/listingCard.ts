import { t, link } from "../i18n";
import { listingPhotoUrl, type Listing } from "../data/listings";

export function renderListingCard(listing: Listing, coverPath: string | undefined): string {
  return `
    <article class="project-card">
      <a class="project-card__media" href="${link(`/resale/${listing.id}`)}" aria-label="${listing.title}">
        ${coverPath ? `<img src="${listingPhotoUrl(coverPath)}" alt="${listing.title}" loading="lazy" />` : ""}
      </a>
      <div class="project-card__body">
        <p class="project-card__location">${[listing.district, listing.city].filter(Boolean).join(", ")}</p>
        <h3 class="project-card__title">${listing.title}</h3>
        <p class="project-card__tagline">${listing.property_type ? t(`account.propertyTypes.${listing.property_type}`) : ""}</p>
        <div class="project-card__meta">
          <div class="project-card__stat">
            <strong dir="ltr">${listing.asking_price ? listing.asking_price.toLocaleString() : "—"} ${listing.currency}</strong>
            <span>${t("resale.priceLabel")}</span>
          </div>
          <div class="project-card__stat">
            <strong dir="ltr">${listing.size_m2 ?? "—"} m²</strong>
            <span>${t("resale.sizeLabel")}</span>
          </div>
        </div>
        <a class="btn btn--outline btn--small" href="${link(`/resale/${listing.id}`)}">
          ${t("common.discoverMore")}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </a>
      </div>
    </article>
  `;
}
