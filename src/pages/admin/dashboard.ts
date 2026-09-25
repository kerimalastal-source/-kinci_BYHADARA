import { t, link } from "../../i18n";
import { requireAdmin } from "../../auth/session";
import { escapeHtml } from "../../utils/html";
import { fetchPendingListings, fetchCoverPhotos, listingPhotoUrl, type Listing } from "../../data/listings";

function renderRow(listing: Listing, coverPath: string | undefined): string {
  return `
    <article class="listing-row" data-id="${listing.id}">
      <div class="listing-row__media">
        ${coverPath ? `<img src="${listingPhotoUrl(coverPath)}" alt="${escapeHtml(listing.title)}" loading="lazy" />` : ""}
      </div>
      <div class="listing-row__body">
        <span class="status-badge status-badge--${listing.status}">${t(`account.statusLabels.${listing.status}`)}</span>
        <h3>${escapeHtml(listing.title)}</h3>
        <p class="listing-row__meta">${escapeHtml([listing.district, listing.city].filter(Boolean).join(", "))} · <span dir="ltr">${listing.asking_price?.toLocaleString() ?? ""} ${listing.currency}</span></p>
      </div>
      <div class="listing-row__actions">
        <a class="btn btn--primary btn--small" href="${link(`/admin/listings/${listing.id}`)}">${t("admin.reviewButton")}</a>
      </div>
    </article>
  `;
}

export function renderAdminDashboard(main: HTMLElement): void {
  if (!requireAdmin(main)) return;

  main.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("admin.heroEyebrow")}</p>
        <h1>${t("admin.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("admin.heroSubtitle")}</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">${t("admin.queueTitle")}</h2>
        <div id="queue-list" class="listing-list"></div>
        <p class="project-grid__empty" id="queue-empty" hidden>${t("admin.noQueueItems")}</p>
      </div>
    </section>
  `;

  const requestId = crypto.randomUUID();
  main.dataset.requestId = requestId;

  const listEl = main.querySelector<HTMLElement>("#queue-list")!;
  const emptyEl = main.querySelector<HTMLElement>("#queue-empty")!;

  fetchPendingListings()
    .then(async (listings) => {
      if (main.dataset.requestId !== requestId) return;
      const covers = await fetchCoverPhotos(listings.map((l) => l.id));
      if (main.dataset.requestId !== requestId) return;
      emptyEl.hidden = listings.length > 0;
      listEl.innerHTML = listings.map((l) => renderRow(l, covers[l.id])).join("");
    })
    .catch((err) => console.error(err));
}
