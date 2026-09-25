import { t, link } from "../../i18n";
import { requireAuth, getCurrentProfile } from "../../auth/session";
import { escapeHtml } from "../../utils/html";
import {
  fetchMyListings,
  fetchCoverPhotos,
  listingPhotoUrl,
  withdrawListing,
  type Listing,
  type ListingStatus
} from "../../data/listings";

function statusLabel(status: ListingStatus): string {
  return t(`account.statusLabels.${status}`);
}

function renderRow(listing: Listing, coverPath: string | undefined): string {
  const canEdit = listing.status === "draft" || listing.status === "rejected";
  const canWithdraw = listing.status === "pending_review" || listing.status === "approved";

  return `
    <article class="listing-row" data-id="${listing.id}">
      <div class="listing-row__media">
        ${coverPath ? `<img src="${listingPhotoUrl(coverPath)}" alt="${escapeHtml(listing.title)}" loading="lazy" />` : ""}
      </div>
      <div class="listing-row__body">
        <span class="status-badge status-badge--${listing.status}">${statusLabel(listing.status)}</span>
        <h3>${escapeHtml(listing.title)}</h3>
        <p class="listing-row__meta">${escapeHtml([listing.district, listing.city].filter(Boolean).join(", "))}</p>
        ${listing.status === "rejected" && listing.rejection_reason ? `<p class="listing-row__rejection"><strong>${t("account.rejectionReasonLabel")}:</strong> ${escapeHtml(listing.rejection_reason)}</p>` : ""}
      </div>
      <div class="listing-row__actions">
        ${listing.status === "approved" ? `<a class="btn btn--outline btn--small" href="${link(`/resale/${listing.id}`)}">${t("account.viewButton")}</a>` : ""}
        ${canEdit ? `<a class="btn btn--outline btn--small" href="${link(`/account/listings/${listing.id}/edit`)}">${t("account.editButton")}</a>` : ""}
        ${canWithdraw ? `<button type="button" class="btn btn--outline btn--small" data-withdraw="${listing.id}">${t("account.withdrawButton")}</button>` : ""}
      </div>
    </article>
  `;
}

export function renderAccountDashboard(main: HTMLElement): void {
  if (!requireAuth(main)) return;

  const profile = getCurrentProfile();

  main.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("account.heroEyebrow")}</p>
        <h1>${t("account.heroTitle")}</h1>
        <p class="page-hero__subtitle">${profile ? t("account.welcomeBack", { name: escapeHtml(profile.full_name) || "" }) : ""}</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-header-row">
          <h2 class="section-title">${t("account.myListingsTitle")}</h2>
          <a class="btn btn--primary" href="${link("/account/listings/new")}">${t("account.addListingButton")}</a>
        </div>
        <div id="listing-list" class="listing-list"></div>
        <p class="project-grid__empty" id="listing-empty" hidden>${t("account.noListingsText")}</p>
      </div>
    </section>
  `;

  const requestId = crypto.randomUUID();
  main.dataset.requestId = requestId;

  const listEl = main.querySelector<HTMLElement>("#listing-list")!;
  const emptyEl = main.querySelector<HTMLElement>("#listing-empty")!;

  fetchMyListings()
    .then(async (listings) => {
      if (main.dataset.requestId !== requestId) return;
      const covers = await fetchCoverPhotos(listings.map((l) => l.id));
      if (main.dataset.requestId !== requestId) return;

      emptyEl.hidden = listings.length > 0;
      listEl.innerHTML = listings.map((l) => renderRow(l, covers[l.id])).join("");

      listEl.querySelectorAll<HTMLButtonElement>("[data-withdraw]").forEach((btn) => {
        btn.addEventListener("click", () => {
          btn.disabled = true;
          withdrawListing(btn.dataset.withdraw!).then(() => renderAccountDashboard(main));
        });
      });
    })
    .catch((err) => {
      console.error(err);
    });
}
